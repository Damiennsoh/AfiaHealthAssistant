// Dedicated search worker for low-latency knowledge retrieval.
// Keeps the entire knowledge base in memory (RAM) to avoid disk I/O blocking the main thread.
// Handles both keyword filtering and vector cosine similarity.

// --- Types ---
type SearchMessage = 
  | { type: 'INIT' }
  | { type: 'REFRESH' }
  | { type: 'SEARCH'; query: string; vector?: number[]; maxResults?: number };

type WorkerResponse = 
  | { type: 'READY'; count: number }
  | { type: 'RESULTS'; results: any[] }
  | { type: 'ERROR'; error: string };

// --- In-Memory Cache ---
let cachedChunks: any[] = [];
let isReady = false;

// --- Helper: Cosine Similarity ---
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- Helper: Keyword Scoring ---
function calculateKeywordScore(chunk: any, queryWords: string[]): number {
  let score = 0;
  const content = (chunk.content || '').toLowerCase();
  const section = (chunk.section || '').toLowerCase();
  const keywords = (chunk.keywords || []).map((k: string) => k.toLowerCase());
  
  // Exact phrase match bonus
  // (We'd need the full query string for this, but let's stick to word-based for speed)
  
  queryWords.forEach(word => {
    if (word.length < 2) return;
    
    // Title match (High value)
    if (section.includes(word)) score += 5;
    
    // Keyword metadata match (Medium value)
    if (keywords.some((k: string) => k.includes(word))) score += 3;
    
    // Content match (Base value)
    if (content.includes(word)) score += 1;
  });

  // Authority boost
  if (chunk.authority === 'ghs' || chunk.authority === 'nhis') {
    score *= 1.2;
  }

  return score;
}

// --- Core: Load Data from IndexedDB ---
async function loadData() {
  if (isReady) {
    self.postMessage({ type: 'READY', count: cachedChunks.length });
    return;
  }

  try {
    const dbRequest = indexedDB.open("AfiaKnowledgeDB", 2);
    
    // Handle database schema creation/upgrade
    dbRequest.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("knowledge_chunks")) {
        db.createObjectStore("knowledge_chunks", { keyPath: "id" });
      }
    };
    
    dbRequest.onerror = (e) => {
      self.postMessage({ type: 'ERROR', error: 'Failed to open KnowledgeDB' });
    };

    dbRequest.onsuccess = (e: any) => {
      const db = e.target.result;
      
      // Check if store exists; if not, we'll need to handle gracefully
      if (!db.objectStoreNames.contains("knowledge_chunks")) {
        // Store doesn't exist - this can happen if the database was created but never upgraded
        // Try to close and retry with explicit version
        db.close();
        const retryRequest = indexedDB.open("AfiaKnowledgeDB", 2);
        retryRequest.onupgradeneeded = (event: any) => {
          const retryDb = event.target.result;
          if (!retryDb.objectStoreNames.contains("knowledge_chunks")) {
            retryDb.createObjectStore("knowledge_chunks", { keyPath: "id" });
          }
        };
        retryRequest.onsuccess = (retryEvent: any) => {
          const retryDb = retryEvent.target.result;
          handleStoreRead(retryDb);
        };
        retryRequest.onerror = () => {
          self.postMessage({ type: 'ERROR', error: 'Failed to create knowledge_chunks store' });
        };
        return;
      }

      handleStoreRead(db);
    };
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', error: err.message });
  }
}

// Helper function to read from store
function handleStoreRead(db: IDBDatabase) {
  const tx = db.transaction("knowledge_chunks", "readonly");
  const store = tx.objectStore("knowledge_chunks");
  const request = store.getAll();

  request.onsuccess = () => {
    cachedChunks = request.result;
    isReady = true;
    // Optimization: Convert embeddings to Float32Array if not already
    // This speeds up math operations significantly
    cachedChunks.forEach(chunk => {
        if (Array.isArray(chunk.embedding)) {
            chunk.embedding = new Float32Array(chunk.embedding);
        }
    });
    
    self.postMessage({ type: 'READY', count: cachedChunks.length });
  };

  request.onerror = () => {
    self.postMessage({ type: 'ERROR', error: 'Failed to read chunks' });
  };
}

// --- Message Handler ---
self.onmessage = async (e: MessageEvent<SearchMessage>) => {
  const { type } = e.data;

  if (type === 'INIT' || type === 'REFRESH') {
    isReady = false; // Force reload
    await loadData();
  } 
  else if (type === 'SEARCH') {
    // Wait if not ready (simple retry logic could be better but this works for single-user flow)
    if (!isReady) await loadData();
    if (!cachedChunks.length) {
       self.postMessage({ type: 'RESULTS', results: [] });
       return;
    }

    const { query, vector, maxResults = 5 } = e.data as { query: string; vector?: number[]; maxResults?: number };
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // HYBRID SCORING STRATEGY
    // We calculate a composite score:
    // Final Score = (Vector Similarity * 0.7) + (Keyword Score Normalized * 0.3)
    // If vector is missing, we rely 100% on keyword score.

    const scoredResults = cachedChunks.map(chunk => {
      // 1. Keyword Score
      const keywordScore = calculateKeywordScore(chunk, queryWords);
      
      // 2. Vector Score
      let vectorScore = 0;
      if (vector && chunk.embedding) {
        // Convert vector to Float32Array if passed as regular array for compatibility
        const qVec = vector instanceof Float32Array ? vector : new Float32Array(vector);
        const cVec = chunk.embedding instanceof Float32Array ? chunk.embedding : new Float32Array(chunk.embedding);
        vectorScore = cosineSimilarity(qVec as any, cVec as any); // Type cast as number[] for now to satisfy TS signature
      }

      // 3. Composite Score
      // Normalize keyword score (heuristic: max expected score ~20)
      const normKeywordScore = Math.min(keywordScore / 20, 1.0);
      
      let finalScore = 0;
      if (vector) {
        // Boost semantic relevance but keep keyword grounding
        // If keyword match is 0, we still allow vector results (semantic fallback)
        finalScore = (vectorScore * 0.7) + (normKeywordScore * 0.3);
      } else {
        finalScore = normKeywordScore;
      }

      return { chunk, score: finalScore, vectorScore, keywordScore };
    });

    // Sort and Slice
    const topResults = scoredResults
      .filter(r => r.score > 0.25) // Minimum relevance threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(r => ({
        ...r.chunk,
        _score: r.score,      // Debug info
        _vScore: r.vectorScore,
        _kScore: r.keywordScore
      }));

    self.postMessage({ type: 'RESULTS', results: topResults });
  }
};
