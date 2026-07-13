// Knowledge Base Search Utility
// Provides server-side access to IndexedDB knowledge chunks

import { DBChangeListener } from "./db";
import { knowledgeSearchService } from "./knowledge-search-service";

const DB_NAME = "AfiaKnowledgeDB";
const STORE_NAME = "knowledge_chunks";
const DB_VERSION = 2;

export interface KnowledgeChunk {
  id: string;
  section: string;
  content: string;
  source: string;
  dateAdded: string;
  isAuthority?: boolean;
  type?: "protocol" | "guideline" | "reference";
  keywords?: string[];
  // Optional vector embedding for semantic search
  embedding?: number[];
}

const listeners = new Set<DBChangeListener>();

function notify() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: DBChangeListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () => reject("Failed to open Knowledge Database");
  });
}

export const knowledgeDB = {
  subscribe,
  
  getAll: async (): Promise<KnowledgeChunk[]> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) return resolve([]);
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  add: async (chunk: KnowledgeChunk) => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(chunk);
      request.onsuccess = () => {
        notify();
        if (typeof window !== 'undefined') knowledgeSearchService.refresh();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  delete: async (id: string) => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => {
        notify();
        if (typeof window !== 'undefined') knowledgeSearchService.refresh();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },
  
  addAll: async (chunks: KnowledgeChunk[]) => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      transaction.oncomplete = () => {
        notify();
        if (typeof window !== 'undefined') knowledgeSearchService.refresh();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
      
      chunks.forEach(chunk => store.put(chunk));
    });
  },

  count: async (): Promise<number> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) return resolve(0);
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  clear: async (): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) return resolve();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => {
        notify();
        if (typeof window !== 'undefined') knowledgeSearchService.refresh();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },
  
  getStats: async (): Promise<{ total: number; embedded: number }> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) return resolve({ total: 0, embedded: 0 });
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        const total = countRequest.result;
        let embedded = 0;
        
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value.embedding && Array.isArray(cursor.value.embedding) && cursor.value.embedding.length > 0) {
              embedded++;
            }
            cursor.continue();
          } else {
            resolve({ total, embedded });
          }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      };
      countRequest.onerror = () => reject(countRequest.error);
    });
  },

  search: async (query: string): Promise<KnowledgeChunk[]> => {
    // Optimized: Use Web Worker for non-blocking search
    if (typeof window !== 'undefined') {
      try {
        const results = await knowledgeSearchService.search(query, 5);
        return results;
      } catch (e) {
        console.warn("Worker search failed, falling back to main thread:", e);
        // Fallback continues below...
      }
    }

    // Re-use existing logic but via this method
    const allChunks = await knowledgeDB.getAll();
    
    // Simple keyword-based ranking
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    // Medical term mapping for common conditions
    const termMappings: Record<string, string[]> = {
      "ringworm": ["tinea", "tinea corporis", "fungal infection", "dermatophyte", "tinea cruris", "tinea capitis", "tinea pedis", "tinea versicolor", "dermatophytosis"],
      "itching": ["pruritus", "pruritic", "skin irritation", "pruritus ani", "vaginal itching", "pruritic rash", "itchy skin"],
      "malaria": ["plasmodium", "falciparum", "vivax", "malariae", "ovale", "malaria treatment", "antimalarial"],
      "uti": ["urinary tract infection", "cystitis", "pyelonephritis", "urethritis", "dysuria", "urinary infection", "bladder infection"],
      "headache": ["cephalgia", "migraine", "tension headache", "sinus headache", "head pain", "cephalalgia"],
      "diarrhea": ["gastroenteritis", "loose stools", "watery stools", "enteritis", "diarrhoea", "stool looseness"],
      "skin": ["dermatological", "dermatology", "cutaneous", "skin disease", "skin condition", "rash", "dermatitis"],
      "fungal": ["fungus", "mycotic", "mycosis", "antifungal", "yeast infection"]
    };
    
    // Expand search terms with medical mappings
    const expandedTerms: string[] = [];
    searchTerms.forEach(term => {
      expandedTerms.push(term);
      if (termMappings[term]) {
        expandedTerms.push(...termMappings[term]);
      }
    });

    const matches = allChunks
      .map(chunk => {
        let score = 0;
        const content = chunk.content.toLowerCase();
        const section = chunk.section.toLowerCase();
        
        expandedTerms.forEach(term => {
          if (content.includes(term)) score += 1;
          if (section.includes(term)) score += 2; // Weight titles higher
          
          // Bonus for exact phrase matches
          if (content.includes(query.toLowerCase())) score += 3;
          if (section.includes(query.toLowerCase())) score += 4;
        });

        // Boost official protocols (GHS/NHIS) as primary source of truth
        if (chunk.source.toLowerCase().includes('ghs') || chunk.source.toLowerCase().includes('nhis') || chunk.isAuthority) {
          score *= 1.5; 
        }
        
        return { chunk, score };
      })
      .filter(item => item.score >= 1) // Keep threshold at 1 but with better scoring
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Return top 5 most relevant chunks
      .map(item => item.chunk);

    return matches;
  }
};

/**
 * Searches the local IndexedDB for guidelines relevant to the user's query.
 * This function provides server-side access to client-side knowledge base.
 */
export async function searchLocalKnowledge(query: string): Promise<KnowledgeChunk[]> {
  return knowledgeDB.search(query);
}

/**
 * Formats knowledge chunks for AI prompt context with country-specific guidance
 */
export function formatKnowledgeForAI(chunks: KnowledgeChunk[], countryCode: 'GH' | 'ZW' = 'GH'): string {
  if (chunks.length === 0) return "";
  
  // Determine which guidelines are being used
  const hasGHS = chunks.some(chunk => chunk.source.toLowerCase().includes('ghs') || chunk.source.toLowerCase().includes('stg'));
  const hasNHIS = chunks.some(chunk => chunk.source.toLowerCase().includes('nhis'));
  const hasEDLIZ = chunks.some(chunk => chunk.source.toLowerCase().includes('edliz') || chunk.source.toLowerCase().includes('zimbabwe') || chunk.source.toLowerCase().includes('mohcc'));
  
  let header = "";
  let instructions = "";
  
  if (countryCode === 'ZW' && hasEDLIZ) {
    header = "=== ZIMBABWE ESSENTIAL MEDICINES LIST & STANDARD TREATMENT GUIDELINES (EDLIZ) ===";
    instructions = `INSTRUCTIONS: Use the above EDLIZ protocols as your primary reference. Cite as "According to the Zimbabwe EDLIZ 8th Edition, 2020" or "Based on the MOHCC Clinical Guidelines" when using these protocols.`;
  } else if (countryCode === 'GH') {
    if (hasGHS) {
      header = "=== GHANA HEALTH SERVICE STANDARD TREATMENT GUIDELINES (GHS STG) ===";
      instructions = `INSTRUCTIONS: Use the above GHS protocols as your primary reference. Cite as "According to the GHS STG 7th Edition, 2017" or "Based on the GHS Clinical Guidelines" when using these protocols.`;
    }
    if (hasNHIS) {
      header = header ? header + "\n=== NATIONAL HEALTH INSURANCE SCHEME MEDICINES LIST (NHIS ML) ===" : "=== NATIONAL HEALTH INSURANCE SCHEME MEDICINES LIST (NHIS ML) ===";
      instructions = instructions ? instructions + " Also use NHIS medicines list guidance." : `INSTRUCTIONS: Use the above NHIS medicines list as your primary reference.`;
    }
  }
  
  if (!header) {
    header = "=== CLINICAL GUIDELINES (RETRIEVED) ===";
  }
  if (!instructions) {
    instructions = "INSTRUCTIONS: Use the above clinical guidelines as your primary reference.";
  }
  
  return `
${header}
${chunks.map((chunk, index) => `
[${chunk.source.toUpperCase()} - ${chunk.section}]:
${chunk.content}
`).join('')}

${instructions} Do NOT use individual protocol numbers or technical identifiers in your response.
`;
}
