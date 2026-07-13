/**
 * AFIA BROWSER VECTOR ENGINE (STRICT OFFLINE-FIRST)
 * Purpose: Handles embedding GHS clinical protocols directly in the browser.
 * Fixes the 0/2000 issue by using atomic batch transactions.
 * Implements Offline-First by leveraging browser cache for the model.
 * 
 * CRITICAL: Uses dynamic imports to prevent Transformers.js from being bundled
 * at module load time, which causes "Cannot convert undefined or null to object" errors.
 */

const DB_NAME = "AfiaKnowledgeDB";
const STORE_NAME = "knowledge_chunks";
const DB_VERSION = 2;

/**
 * MAIN-THREAD FALLBACK
 * Step I from DeepSeek recovery plan: Bypass Web Worker when it fails
 * This runs embeddings directly in the main thread as a fallback
 */
export async function embedChunksMainThread(
  chunks: { id: string; content: string }[],
  onProgress?: (current: number, total: number) => void
): Promise<{ id: string; embedding: number[]; success: boolean }[]> {
  try {
    console.log("[MAIN-THREAD FALLBACK] Starting embedding in main thread...");
    
    // Configure environment
    await configureTransformersEnv();
    const { pipeline } = await import("@xenova/transformers");
    
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
    const results: { id: string; embedding: number[]; success: boolean }[] = [];
    const BATCH_SIZE = 5; // Smaller batches for main thread to avoid blocking UI
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          try {
            if (!chunk.content || !chunk.content.trim()) {
              return { id: chunk.id, embedding: [], success: false };
            }
            
            const output = await embedder(chunk.content, { pooling: 'mean', normalize: true });
            const vectorArray = Array.from(output.data as any).map(v => Number(v));
            
            return { id: chunk.id, embedding: vectorArray, success: true };
          } catch (err) {
            console.error(`[MAIN-THREAD FALLBACK] Error embedding chunk ${chunk.id}:`, err);
            return { id: chunk.id, embedding: [], success: false };
          }
        })
      );
      
      results.push(...batchResults);
      
      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, chunks.length), chunks.length);
      }
      
      // Yield to main thread to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    console.log(`[MAIN-THREAD FALLBACK] Completed ${results.filter(r => r.success).length}/${chunks.length} chunks`);
    return results;
  } catch (error) {
    console.error("[MAIN-THREAD FALLBACK] Fatal error:", error);
    throw error;
  }
}
async function configureTransformersEnv() {
    // Dynamic import - only loads when function is called
    const { env } = await import("@xenova/transformers");
    
    // Disable local model loading (prevents 'fs' and 'path' requirements)
    env.allowLocalModels = false;
    
    // Enable Browser Cache Storage for the models
    env.useBrowserCache = true;

    // Use CDN path for WASM to avoid bundler resolution issues
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/';
    
    // Disable proxy to prevent BigInt serialization issues
    env.backends.onnx.wasm.proxy = false;
    
    return env;
}

/**
 * The core migration function with WORKER + MAIN-THREAD FALLBACK
 * Step I from DeepSeek: Try worker first, fall back to main thread if it fails
 */
export async function processVectorsInBatches(onProgress: (percent: number, status?: string) => void): Promise<boolean> {
    try {
        console.log("Afia Engine: Starting vector processing...");
        onProgress(0, "Opening database...");
        
        // Open DB
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        // Fetch all chunks to identify "The 0/2000" problem
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const allChunks = await new Promise<any[]>((res) => {
            const req = store.getAll();
            req.onsuccess = () => res(req.result);
        });

        const pending = allChunks.filter(c => !c.embedding || (Array.isArray(c.embedding) && c.embedding.length === 0));
        
        if (pending.length === 0) {
            console.log("Afia Engine: No pending chunks found. Database is fully embedded.");
            onProgress(100, "All chunks already embedded");
            return true;
        }

        console.log(`Afia Engine: Found ${pending.length} chunks requiring embeddings.`);
        onProgress(0, `Found ${pending.length} chunks to embed...`);

        // STEP I: Try Web Worker first (DeepSeek recommendation)
        let embeddingResults: { id: string; embedding: number[]; success: boolean }[] = [];
        let useWorker = true;
        
        try {
            onProgress(0, "Loading embedding worker...");
            const worker = new Worker('/workers/embedding-isolated.worker.js');
            
            const workerPromise = new Promise<{ id: string; embedding: number[]; success: boolean }[]>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    worker.terminate();
                    reject(new Error("Worker timeout - falling back to main thread"));
                }, 30000); // 30 second timeout
                
                worker.onmessage = (event) => {
                    const { type, current, total, results, error, message } = event.data;
                    
                    if (type === 'progress') {
                        const percent = Math.round((current / total) * 50); // First 50% for worker
                        onProgress(percent, `Worker processing: ${current}/${total} chunks...`);
                    } else if (type === 'status') {
                        onProgress(0, message);
                    } else if (type === 'complete') {
                        clearTimeout(timeout);
                        resolve(results);
                    } else if (type === 'error') {
                        clearTimeout(timeout);
                        reject(new Error(error));
                    }
                };
                
                worker.onerror = (err) => {
                    clearTimeout(timeout);
                    reject(err);
                };
            });
            
            worker.postMessage({
                type: 'EMBED_CHUNKS',
                chunks: pending.map(c => ({ id: c.id, text: c.content || '' })),
                batchSize: 10
            });
            
            embeddingResults = await workerPromise;
            worker.terminate();
            
        } catch (workerError) {
            console.warn("[WORKER FAILED] Falling back to main thread:", workerError);
            useWorker = false;
            
            // STEP I FALLBACK: Use main-thread embedding
            onProgress(0, "Worker failed, using main-thread fallback...");
            embeddingResults = await embedChunksMainThread(
                pending.map(c => ({ id: c.id, content: c.content || '' })),
                (current, total) => {
                    const percent = Math.round((current / total) * 50); // First 50% for embedding
                    onProgress(percent, `Main-thread processing: ${current}/${total} chunks...`);
                }
            );
        }

        // Apply embeddings to chunks
        const successfulEmbeddings = embeddingResults.filter(r => r.success);
        console.log(`Afia Engine: Successfully generated ${successfulEmbeddings.length}/${pending.length} embeddings`);
        
        // Update chunks with embeddings
        const updatedChunks = pending.map((chunk, index) => {
            const result = embeddingResults.find(r => r.id === chunk.id);
            if (result && result.success) {
                return { ...chunk, embedding: result.embedding };
            }
            return chunk;
        });

        // Save to database (Second 50% of progress)
        const BATCH_SIZE = 10;
        for (let i = 0; i < updatedChunks.length; i += BATCH_SIZE) {
            const batch = updatedChunks.slice(i, i + BATCH_SIZE);
            
            await new Promise((resolve, reject) => {
                const saveTx = db.transaction(STORE_NAME, "readwrite");
                const saveStore = saveTx.objectStore(STORE_NAME);
                batch.forEach(item => saveStore.put(item));
                saveTx.oncomplete = resolve;
                saveTx.onerror = reject;
            });
            
            const baseProgress = 50; // First 50% was embedding
            const savePercent = Math.round(((i + batch.length) / updatedChunks.length) * 50);
            onProgress(baseProgress + savePercent, `Saving: ${Math.min(i + batch.length, updatedChunks.length)}/${updatedChunks.length} chunks...`);
        }

        console.log("Afia Engine: Processing complete. Used ", useWorker ? "Web Worker" : "Main Thread Fallback");
        onProgress(100, `Complete! Embedded ${successfulEmbeddings.length} chunks`);
        return true;
    } catch (error) {
        console.error("Afia Engine: Fatal error during migration:", error);
        onProgress(0, `Error: ${error}`);
        throw error;
    }
}
