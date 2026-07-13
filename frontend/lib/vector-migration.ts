import { toast } from "sonner";
import type { KnowledgeChunk } from "./knowledge-base";

const DB_NAME = "AfiaKnowledgeDB";
const STORE_NAME = "knowledge_chunks";

export async function runVectorMigration(onProgress: (p: number) => void) {
  return new Promise(async (resolve, reject) => {
    const dbRequest = indexedDB.open(DB_NAME);
    
    dbRequest.onsuccess = async () => {
      const db = dbRequest.result;
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      
      // 1. Find chunks without embeddings
      const allChunks = await new Promise<KnowledgeChunk[]>((res) => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result as KnowledgeChunk[]);
      });

      const pendingChunks = allChunks.filter(c => !c.embedding || c.embedding.length === 0);
      
      if (pendingChunks.length === 0) {
        toast.success("All protocols are already vectorized!");
        return resolve(true);
      }

      toast.info(`Vectorizing ${pendingChunks.length} protocols...`);

      // 2. Try Web Worker with webpack worker-loader
      let worker: Worker | null = null;
      let useWorker = true;

      try {
        console.log('[MIGRATION] Attempting to load worker with webpack loader...');
        // Dynamic import to avoid bundling issues - now using the default export class
        const WorkerModule = await import('../workers/embedding.worker.js');
        worker = new WorkerModule.default();
        console.log('[MIGRATION] Worker loaded successfully');
      } catch (workerError) {
        console.warn('[MIGRATION] Worker failed to load, falling back to main-thread:', workerError);
        useWorker = false;
        
        // FALLBACK: Use main-thread embedding with explicit error logging
        console.log('[MIGRATION] Using main-thread fallback...');
        
        try {
          const { embedChunksMainThread } = await import('./embedding-main');
          const texts = pendingChunks.map(chunk => chunk.content || '');
          
          onProgress(10);
          const vectors = await embedChunksMainThread(texts);
          
          if (vectors.length === 0 || vectors.every(v => v.length === 0)) {
            console.error('[MIGRATION] Main-thread embedding produced no vectors');
            toast.error('Embedding failed: No vectors generated');
            return resolve(false);
          }
          
          // Save vectors to database
          const updateTx = db.transaction(STORE_NAME, "readwrite");
          const updateStore = updateTx.objectStore(STORE_NAME);
          
          let savedCount = 0;
          pendingChunks.forEach((chunk, index) => {
            if (vectors[index] && vectors[index].length > 0) {
              updateStore.put({ ...chunk, embedding: vectors[index] });
              savedCount++;
            }
          });

          updateTx.oncomplete = () => {
            toast.success(`Successfully embedded ${savedCount} protocols using main-thread!`);
            resolve(true);
          };
          updateTx.onerror = () => {
            toast.error("Failed to save embeddings to database");
            reject(updateTx.error);
          };
          
          return;
          
        } catch (mainThreadError: any) {
          console.error('[MIGRATION] Main-thread embedding error:', mainThreadError);
          toast.error(`Embedding failed: ${mainThreadError?.message || 'Unknown error'}`);
          return resolve(false);
        }
      }

      // If we reach here, worker is available
      if (worker) {
        worker.onmessage = async (e) => {
        const { type, current, total, results, error, message } = e.data;

        if (type === 'status') {
          console.log("Worker:", message);
          onProgress?.(10);
        }
        
        if (type === 'progress') {
          const progress = 10 + Math.round((current / total) * 80);
          onProgress(progress);
        }

        if (type === 'complete') {
          // 3. Save results back to DB
          const updateTx = db.transaction(STORE_NAME, "readwrite");
          const updateStore = updateTx.objectStore(STORE_NAME);
          
          let savedCount = 0;
          results.forEach((res: any) => {
            if (res.success && res.embedding) {
              const original = allChunks.find(c => c.id === res.id);
              if (original) {
                updateStore.put({ ...original, embedding: res.embedding });
                savedCount++;
              }
            }
          });

          updateTx.oncomplete = () => {
            toast.success(`Successfully embedded ${savedCount} protocols!`);
            worker?.terminate();
            resolve(true);
          };
          updateTx.onerror = () => {
            toast.error("Failed to save embeddings to database");
            worker?.terminate();
            reject(updateTx.error);
          };
        }

        if (type === 'error') {
          toast.error("Vector Engine Error: " + error);
          worker?.terminate();
          reject(error);
        }
      };
    }

      if (worker) {
        worker.onerror = (err) => {
          console.error('[MIGRATION] Worker error:', err);
          toast.error("Worker initialization failed");
          worker?.terminate();
          reject(err);
        };

        // Send chunks with IDs for the worker format
        const chunksWithIds = pendingChunks.map(chunk => ({
          id: chunk.id,
          text: chunk.content
        }));

        worker.postMessage({ 
          type: 'EMBED_CHUNKS', 
          chunks: chunksWithIds, 
          batchSize: 25 
        });
      }
    };

    dbRequest.onerror = () => {
      toast.error("Failed to open database");
      reject(dbRequest.error);
    };
  });
};
