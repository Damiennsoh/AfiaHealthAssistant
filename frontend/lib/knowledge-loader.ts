// lib/knowledge-loader.ts
import { openDB } from 'idb';

const DB_NAME = 'AfiaKnowledgeDB';
const STORE_NAME = 'knowledge_chunks';
const DB_VERSION = 2;

export interface KnowledgeChunk {
  id: string;
  section: string;
  content: string;
  source: string;
  sourceShortName?: string;
  documentType: 'protocol' | 'formulary' | 'guideline' | 'reference';
  authority: 'ghs' | 'who' | 'nhis' | 'mohcc' | 'custom';
  countryCode?: 'GH' | 'ZW' | string;
  color?: string;
  dateAdded: string;
  dateEmbedded?: string;
  embedding: number[]; // Pre-computed embedding
  metadata?: {
    version?: string;
    year?: number;
    page?: number;
    keywords?: string[];
  };
}

// Initialize database
export const initKnowledgeDB = async () => {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('source', 'source');
        store.createIndex('authority', 'authority');
        store.createIndex('documentType', 'documentType');
        store.createIndex('dateAdded', 'dateAdded');
      }
    },
  });
  return db;
};

// Also export as initDB to match usage in knowledge-admin.tsx
export const initDB = initKnowledgeDB;

// Load pre-computed knowledge base
export const loadPrecomputedKnowledge = async (onProgress?: (progress: number) => void) => {
  console.log('📚 Loading pre-computed knowledge base...');
  
  try {
    // Fetch the pre-computed embeddings
    const response = await fetch('/data/complete-knowledge-base.json');
    if (!response.ok) {
      throw new Error(`Failed to load knowledge base: ${response.status}`);
    }
    
    const rawChunks = await response.json();
    console.log(`✅ Loaded ${rawChunks.length} chunks from embeddings file`);
    
    // Transform raw chunks to match KnowledgeChunk interface
    const chunks: KnowledgeChunk[] = rawChunks.map((c: any) => {
      // Determine metadata based on source, but preserve fields from c if available
      let authority: 'ghs' | 'who' | 'nhis' | 'mohcc' | 'custom' = c.authority || 'custom';
      let documentType: 'protocol' | 'formulary' | 'guideline' | 'reference' = c.documentType || 'reference';
      let sourceShortName = c.sourceShortName || c.source;
      let color = c.color || '#888888';
      let section = c.section || 'General';
      let year = c.metadata?.year || 2024;
      let countryCode = c.countryCode;

      if (!c.authority) {
        if (c.source && (c.source.includes('STG') || c.source.includes('GHS'))) {
          authority = 'ghs';
          documentType = 'guideline';
          sourceShortName = 'GHS STG';
          color = '#2e7d32'; // Green
          year = 2017;
          countryCode = countryCode || 'GH';
        } else if (c.source && c.source.includes('NHIS')) {
          authority = 'nhis';
          documentType = 'formulary';
          sourceShortName = 'NHIS ML';
          color = '#1565c0'; // Blue
          year = 2025;
          countryCode = countryCode || 'GH';
        } else if (c.source && (c.source.includes('EDLIZ') || c.source.includes('Zimbabwe') || c.source.includes('MOHCC'))) {
          authority = 'mohcc';
          documentType = 'guideline';
          sourceShortName = 'MOHCC EDLIZ';
          color = '#d32f2f'; // Red for Zimbabwe
          year = 2020;
          countryCode = countryCode || 'ZW';
        }
      }

      return {
        id: c.id,
        content: c.content,
        source: c.source || 'unknown',
        embedding: c.embedding,
        // Enriched fields
        section: section,
        sourceShortName: sourceShortName,
        documentType: documentType,
        authority: authority,
        countryCode: countryCode,
        color: color,
        dateAdded: new Date().toISOString(),
        dateEmbedded: new Date().toISOString(),
        metadata: {
          ...c.metadata,
          year: year
        }
      };
    });

    // Open database
    const db = await initKnowledgeDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Clear existing data (optional - you might want to keep existing)
    // await store.clear(); 
    
    // Save chunks in batches to show progress
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await Promise.all(batch.map(chunk => store.put(chunk)));
      
      const progress = Math.round(((i + batch.length) / chunks.length) * 100);
      onProgress?.(progress);
      console.log(`   Progress: ${progress}%`);
    }
    
    await tx.done;
    
    console.log(`✅ Successfully saved ${chunks.length} chunks to IndexedDB`);
    
    // Load and return stats
    const stats = await getKnowledgeStats();
    return { success: true, count: chunks.length, stats };
    
  } catch (error: any) {
    console.error('❌ Failed to load knowledge base:', error);
    return { success: false, error: error.message };
  }
};

// Get knowledge base statistics
export const getKnowledgeStats = async () => {
  try {
    const db = await initKnowledgeDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    // Use cursor instead of getAll() to avoid loading everything into memory
    const stats = {
      total: 0,
      byCountry: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      byAuthority: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      withEmbeddings: 0,
      lastUpdated: new Date().toISOString()
    };
    
    let cursor = await store.openCursor();
    
    while (cursor) {
      const chunk = cursor.value;
      stats.total++;
      
      // Count embeddings
      if (chunk.embedding && chunk.embedding.length > 0) {
        stats.withEmbeddings++;
      }
      
      // Count by country
      if (chunk.countryCode) {
        stats.byCountry[chunk.countryCode] = (stats.byCountry[chunk.countryCode] || 0) + 1;
      }
      
      // Count by source
      if (chunk.source) {
        stats.bySource[chunk.source] = (stats.bySource[chunk.source] || 0) + 1;
      }
      
      // Count by authority
      if (chunk.authority) {
        stats.byAuthority[chunk.authority] = (stats.byAuthority[chunk.authority] || 0) + 1;
      }
      
      // Count by type
      if (chunk.documentType) {
        stats.byType[chunk.documentType] = (stats.byType[chunk.documentType] || 0) + 1;
      }
      
      cursor = await cursor.continue();
    }
    
    return stats;
    
  } catch (error) {
    console.error('Failed to get stats:', error);
    return null;
  }
};

// Check if knowledge base is loaded
export const isKnowledgeLoaded = async () => {
  try {
    const db = await initKnowledgeDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const count = await store.count();
    return count > 0;
  } catch {
    return false;
  }
};
