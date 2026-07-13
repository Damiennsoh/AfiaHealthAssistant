// lib/embedding-main.ts
import { pipeline, env } from '@xenova/transformers';

// Configure environment for browser
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/';
env.backends.onnx.wasm.proxy = false;

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
let embedderCache: Awaited<ReturnType<typeof createEmbedder>> | null = null;

async function createEmbedder() {
  try {
    console.log('[EMBED-MAIN] Creating embedder with model:', MODEL_NAME);
    const { pipeline } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    const embedder = await pipeline("feature-extraction", MODEL_NAME);
    console.log('[EMBED-MAIN] Embedder created successfully');
    return embedder;
  } catch (error) {
    console.error('[EMBED-MAIN] Failed to create embedder:', error);
    throw error;
  }
}

async function getEmbedder() {
  if (embedderCache) return embedderCache;
  embedderCache = await createEmbedder();
  return embedderCache;
}

/**
 * Embed text chunks on the main thread. Use for migration when the worker fails.
 * Blocks the UI during processing.
 */
export async function embedChunksMainThread(texts: string[]): Promise<number[][]> {
  try {
    console.log('[EMBED-MAIN] Starting main-thread embedding for', texts.length, 'texts');
    
    if (!texts.length) {
      console.log('[EMBED-MAIN] No texts to embed');
      return [];
    }

    const model = await getEmbedder();
    const vectors: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text || !text.trim()) {
        console.warn('[EMBED-MAIN] Skipping empty text at index', i);
        vectors.push([]);
        continue;
      }
      
      try {
        const output = await model(text, { pooling: "mean", normalize: true });
        const vector = Array.from(output.data as Float32Array).map(v => Number(v));
        vectors.push(vector);
        console.log(`[EMBED-MAIN] Embedded text ${i + 1}/${texts.length}, vector length: ${vector.length}`);
      } catch (err) {
        console.error(`[EMBED-MAIN] Error embedding text ${i}:`, err);
        vectors.push([]);
      }
    }
    
    console.log('[EMBED-MAIN] Completed embedding. Generated', vectors.filter(r => r.length > 0).length, 'vectors');
    return vectors;
  } catch (error) {
    console.error('[EMBED-MAIN] Fatal error in embedChunksMainThread:', error);
    throw error;
  }
}
