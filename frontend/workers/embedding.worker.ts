/* eslint-disable no-restricted-globals */
// Dedicated embedding worker for semantic search.
// Runs Transformers.js in a separate thread so the UI stays responsive.
// Improved version with batch processing and progress reporting.

import { pipeline, env } from "@xenova/transformers";

// Skip local model check to prevent CORS issues in some environments
env.allowLocalModels = false;

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

let embedder: any | null = null;

async function getEmbedder() {
  if (!embedder) {
    self.postMessage({ type: 'status', message: 'Loading AI Model (approx. 30MB)...' });
    embedder = await pipeline("feature-extraction", MODEL_NAME);
    self.postMessage({ type: 'status', message: 'Model Ready' });
  }
  return embedder;
}

type WorkerInMessage =
  | { type: "EMBED_CHUNKS"; chunks: Array<{id: string, text: string}>; batchSize?: number }
  | { type: "EMBED_QUERY"; text: string };

type WorkerOutMessage =
  | { type: "status"; message: string }
  | { type: "progress"; current: number; total: number }
  | { type: "complete"; results: Array<{id: string, embedding?: number[], success: boolean, error?: string}> }
  | { type: "error"; error: string };

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const data = event.data;

  try {
    if (data.type === "EMBED_CHUNKS") {
      const generate = await getEmbedder();
      const results = [];
      const total = data.chunks.length;
      const batchSize = data.batchSize || 25;

      for (let i = 0; i < total; i += batchSize) {
        const batch = data.chunks.slice(i, i + batchSize);
        
        // Process batch
        const batchResults = await Promise.all(
          batch.map(async (chunk) => {
            try {
              const output = await generate(chunk.text, { pooling: "mean", normalize: true });
              return { 
                id: chunk.id, 
                embedding: Array.from(output.data),
                success: true 
              };
            } catch (err: any) {
              return { id: chunk.id, success: false, error: err.message };
            }
          })
        );

        results.push(...batchResults);
        
        // Report progress to UI
        self.postMessage({ 
          type: 'progress', 
          current: Math.min(i + batchSize, total), 
          total 
        });
      }

      self.postMessage({ type: 'complete', results });
      return;
    }

    if (data.type === "EMBED_QUERY") {
      const model = await getEmbedder();
      const output = await model(data.text, { pooling: "mean", normalize: true });
      const vec = Array.from(output.data as Float32Array);

      self.postMessage({ 
        type: 'complete', 
        results: [{ id: 'query', embedding: vec, success: true }] 
      });
      return;
    }
  } catch (err: any) {
    self.postMessage({
      type: "error",
      error: err?.message || "Embedding worker encountered an error",
    });
  }
};

// Export for webpack worker-loader
export default class EmbeddingWorker extends Worker {
  constructor() {
    super(new URL('./embedding.worker.ts', import.meta.url));
  }
}
