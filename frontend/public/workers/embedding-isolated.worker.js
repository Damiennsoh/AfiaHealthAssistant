/**
 * STANDALONE EMBEDDING WORKER
 * Isolated from main bundle to prevent Transformers.js initialization errors
 */

/* eslint-disable no-restricted-globals */

let embedderInstance = null;

async function getEmbedder() {
  if (embedderInstance) return embedderInstance;
  // Dynamic import INSIDE the worker (completely isolated)
  const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1");
  // Configure for browser
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/';
  env.backends.onnx.wasm.proxy = false;
  self.postMessage({ type: 'status', message: 'Loading AI Model...' });
  embedderInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  self.postMessage({ type: 'status', message: 'Model Ready' });
  return embedderInstance;
}

// This worker runs in complete isolation from the main application bundle
self.onmessage = async (event) => {
  const { type } = event.data || {};
  try {
    if (type === 'EMBED_CHUNKS') {
      const { chunks, batchSize = 10 } = event.data;
      const embedder = await getEmbedder();
      const results = [];
      const total = chunks.length;
      for (let i = 0; i < total; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (chunk) => {
            try {
              if (!chunk.text || !chunk.text.trim()) {
                return { id: chunk.id, success: false, error: 'Empty text' };
              }
              const output = await embedder(chunk.text, { pooling: 'mean', normalize: true });
              const vectorArray = Array.from(output.data).map(v => Number(v));
              return { id: chunk.id, embedding: vectorArray, success: true };
            } catch (err) {
              return { id: chunk.id, success: false, error: err.message };
            }
          })
        );
        results.push(...batchResults);
        self.postMessage({ type: 'progress', current: Math.min(i + batchSize, total), total });
      }
      self.postMessage({ type: 'complete', results });
      return;
    }
    if (type === 'EMBED_QUERY') {
      const { text } = event.data;
      const embedder = await getEmbedder();
      if (!text || !text.trim()) {
        self.postMessage({ type: 'error', error: 'Empty text' });
        return;
      }
      const output = await embedder(text, { pooling: 'mean', normalize: true });
      const vec = Array.from(output.data).map(v => Number(v));
      self.postMessage({ type: 'complete', results: [{ id: 'query', embedding: vec, success: true }] });
      return;
    }
    self.postMessage({ type: 'error', error: 'Unknown message type' });
  } catch (error) {
    self.postMessage({ type: 'error', error: error?.message || 'Worker error' });
  }
};
