// Service to manage the Knowledge Search Worker
// Singleton pattern to ensure only one worker exists

import type { KnowledgeChunk } from "./knowledge-base";

type SearchResult = KnowledgeChunk & { _score: number; _vScore: number; _kScore: number };

class KnowledgeSearchService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (data: SearchResult[]) => void; reject: (err: Error) => void }>();
  private readyWaiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  private isReady = false;
  private workerError: Error | null = null;
  private requestSequence = 0;

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
        this.workerError = null;
        this.readyWaiters.splice(0).forEach(({ resolve }) => resolve());
        console.log(`[KnowledgeSearchService] Worker ready with ${count} chunks`);
      } else if (type === "RESULTS") {
        const request = this.pendingRequests.get(requestId);
        if (request) {
          request.resolve(results);
          this.pendingRequests.delete(requestId);
        }
      } else if (type === "ERROR") {
        console.error("[KnowledgeSearchService] Worker Error:", error);
        const workerError = new Error(`Knowledge search worker error: ${error?.message || error}`);
        this.workerError = workerError;
        this.readyWaiters.splice(0).forEach(({ reject }) => reject(workerError));
        this.pendingRequests.forEach(({ reject }) => reject(workerError));
        this.pendingRequests.clear();
      }
    };

    // Handle worker initialization errors
    this.worker.onerror = (event: ErrorEvent) => {
      console.error("[KnowledgeSearchService] Worker Error Event:", event.message, event.filename, event.lineno);
      const workerError = new Error(`Worker error: ${event.message}`);
      this.workerError = workerError;
      this.readyWaiters.splice(0).forEach(({ reject }) => reject(workerError));
      this.pendingRequests.forEach(({ reject }) => reject(workerError));
      this.pendingRequests.clear();
    };

    // Initialize data load
    this.worker.postMessage({ type: "INIT" });
  }

  public async search(query: string, maxResults = 5, countryCode?: 'GH' | 'ZW'): Promise<SearchResult[]> {
    if (!this.worker) this.initWorker();

    if (!this.isReady) {
      if (this.workerError) throw this.workerError;
      await new Promise<void>((resolve, reject) => {
        this.readyWaiters.push({ resolve, reject });
      });
    }

    return new Promise((resolve, reject) => {
      const requestId = `search-${++this.requestSequence}`;
      this.pendingRequests.set(requestId, { resolve, reject });

      this.worker?.postMessage({
        type: "SEARCH",
        query,
        maxResults,
        countryCode,
        requestId,
      });
    });
  }

  public refresh() {
    this.isReady = false;
    this.workerError = null;
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
