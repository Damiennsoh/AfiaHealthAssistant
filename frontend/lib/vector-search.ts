import type { KnowledgeChunk } from "./knowledge-base";

const DB_NAME = "AfiaKnowledgeDB";
const STORE_NAME = "knowledge_chunks";

export interface VectorSearchResult {
  chunk: KnowledgeChunk;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

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

export async function vectorSearch(
  queryVector: number[],
  maxResults: number = 5
): Promise<VectorSearchResult[]> {
  if (!queryVector || queryVector.length === 0) return [];
  if (typeof indexedDB === "undefined") return [];

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME);

    request.onerror = () => {
      console.error("Failed to open Knowledge Database for vector search");
      resolve([]);
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve([]);
        return;
      }

      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onerror = () => {
        console.error("Failed to retrieve knowledge chunks for vector search");
        resolve([]);
      };

      getAllRequest.onsuccess = () => {
        const allChunks = getAllRequest.result as KnowledgeChunk[];
        const withEmbeddings = allChunks.filter(
          (c) => Array.isArray(c.embedding) && c.embedding.length === queryVector.length
        );

        const scored = withEmbeddings
          .map((chunk) => {
            const score = cosineSimilarity(queryVector, chunk.embedding as number[]);
            return { chunk, score };
          })
          .filter((item) => item.score > 0);

        scored.sort((a, b) => b.score - a.score);
        resolve(scored.slice(0, maxResults));
      };
    };
  });
}

