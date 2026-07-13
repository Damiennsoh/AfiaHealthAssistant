// Service to manage the Knowledge Search Worker
// Singleton pattern to ensure only one worker exists

import type { KnowledgeChunk } from "./knowledge-base";

type SearchResult = KnowledgeChunk & { _score: number; _vScore: number; _kScore: number };

class KnowledgeSearchService {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: (data: any) => void; reject: (err: any) => void }> = new Map();
  private isReady = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initWorker();
    }
  }

  private initWorker() {
    if (this.worker) return;

    this.worker = new Worker(new URL("../workers/search.worker.ts", import.meta.url));
    
    this.worker.onmessage = (event) => {
      const { type, results, count, error, requestId } = event.data;

      if (type === "READY") {
        this.isReady = true;
        console.log(`[KnowledgeSearchService] Worker ready with ${count} chunks`);
      } else if (type === "RESULTS") {
        // Resolve the specific promise for this search
        // (For now, we assume single-threaded request/response for simplicity, 
        // or just use the last pending request if we don't implement full ID tracking)
        // A simple queue system:
        const request = this.pendingRequests.get("latest");
        if (request) {
          request.resolve(results);
          this.pendingRequests.delete("latest");
        }
      } else if (type === "ERROR") {
        console.error("[KnowledgeSearchService] Worker Error:", error);
        const request = this.pendingRequests.get("latest");
        if (request) {
            const errorMsg = error.message || error;
            request.reject(new Error(`Knowledge search worker error: ${errorMsg}`));
            this.pendingRequests.delete("latest");
        }
      }
    };

    // Handle worker initialization errors
    this.worker.onerror = (event: ErrorEvent) => {
      console.error("[KnowledgeSearchService] Worker Error Event:", event.message, event.filename, event.lineno);
      const request = this.pendingRequests.get("latest");
      if (request) {
        request.reject(new Error(`Worker error: ${event.message}`));
        this.pendingRequests.delete("latest");
      }
    };

    // Initialize data load
    this.worker.postMessage({ type: "INIT" });
  }

  public async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    if (!this.worker) this.initWorker();

    return new Promise((resolve, reject) => {
      // Store the promise handlers
      // In a real multi-concurrent system, we'd use unique IDs for each message.
      // For this single-user search bar, "latest" is sufficient (debouncing happens at UI level).
      this.pendingRequests.set("latest", { resolve, reject });

      this.worker?.postMessage({
        type: "SEARCH",
        query,
        maxResults
      });
    });
  }

  public refresh() {
    this.worker?.postMessage({ type: "REFRESH" });
  }

  public terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.isReady = false;
  }
}

// Singleton instance
export const knowledgeSearchService = new KnowledgeSearchService();
