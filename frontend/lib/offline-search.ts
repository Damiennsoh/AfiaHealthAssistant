/**
 * Offline Knowledge Base Search
 * Client-side vector search for rural clinics without internet connectivity.
 * Uses IndexedDB to store embeddings locally and performs cosine similarity search.
 */

import { KnowledgeChunk } from './knowledge-base';

const OFFLINE_DB_NAME = "OfflineKnowledgeDB";
const OFFLINE_STORE_NAME = "embeddings";

export class OfflineKnowledgeBaseSearch {
  private db: IDBDatabase | null = null;
  private loaded = false;
  private countryCode: string = 'GH';
  private embeddings: Map<string, { chunk: KnowledgeChunk; embedding: number[] }> = new Map();

  /**
   * Load offline knowledge base from the backend's offline package
   */
  async loadKnowledgeBase(countryCode: string = 'GH'): Promise<void> {
    this.countryCode = countryCode;
    
    try {
      // Step 1: Open/create IndexedDB for offline search
      this.db = await this.openOfflineDB();
      
      // Step 2: Check if we already have embeddings cached locally
      const cachedCount = await this.getCachedEmbeddingCount();
      if (cachedCount > 0) {
        console.log(`[Offline] Loaded ${cachedCount} cached embeddings for ${countryCode}`);
        this.loaded = true;
        await this.loadEmbeddingsFromDB();
        return;
      }

      // Step 3: Fetch offline package metadata from backend
      console.log(`[Offline] Downloading knowledge base for ${countryCode}...`);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/knowledge/offline-package/${countryCode}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch offline package: ${response.statusText}`);
      }

      const metadata = await response.json();
      console.log(`[Offline] Package info: ${metadata.total_chunks} chunks, embedding dimension ${metadata.embedding_dimension}`);

      // Step 4: Download the actual knowledge base JSON file
      const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL}${metadata.download_url}`;
      const dataResponse = await fetch(downloadUrl);
      
      if (!dataResponse.ok) {
        throw new Error(`Failed to download knowledge base: ${dataResponse.statusText}`);
      }

      const knowledgeData = await dataResponse.json();
      
      // Step 5: Store embeddings in IndexedDB for future use
      await this.storeEmbeddings(knowledgeData.chunks);
      
      this.loaded = true;
      console.log(`[Offline] Knowledge base loaded and cached for offline use`);
    } catch (error) {
      console.error('[Offline] Failed to load knowledge base:', error);
      this.loaded = false;
      throw error;
    }
  }

  /**
   * Open or create IndexedDB for offline search
   */
  private openOfflineDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(OFFLINE_DB_NAME, 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
          db.createObjectStore(OFFLINE_STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
      request.onerror = () => reject('Failed to open offline database');
    });
  }

  /**
   * Load all embeddings from IndexedDB into memory
   */
  private async loadEmbeddingsFromDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(OFFLINE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(OFFLINE_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result;
        this.embeddings.clear();
        results.forEach((item: any) => {
          this.embeddings.set(item.id, {
            chunk: item.chunk,
            embedding: item.embedding,
          });
        });
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store embeddings in IndexedDB
   */
  private async storeEmbeddings(chunks: any[]): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(OFFLINE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(OFFLINE_STORE_NAME);

      chunks.forEach((chunk: any) => {
        store.put({
          id: chunk.id,
          chunk: chunk,
          embedding: chunk.embedding,
        });
      });

      transaction.oncomplete = () => {
        this.embeddings.clear();
        chunks.forEach((chunk: any) => {
          this.embeddings.set(chunk.id, {
            chunk: chunk,
            embedding: chunk.embedding,
          });
        });
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get count of cached embeddings
   */
  private async getCachedEmbeddingCount(): Promise<number> {
    if (!this.db) {
      this.db = await this.openOfflineDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(OFFLINE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(OFFLINE_STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if knowledge base is loaded
   */
  isLoaded(): boolean {
    return this.loaded && this.embeddings.size > 0;
  }

  /**
   * Perform cosine similarity search on embeddings
   */
  async search(query: string, queryEmbedding?: number[], limit: number = 5): Promise<KnowledgeChunk[]> {
    if (!this.isLoaded()) {
      throw new Error('Knowledge base not loaded');
    }

    // If no embedding provided, fall back to keyword search
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return this.keywordSearch(query, limit);
    }

    // Perform vector similarity search
    const results: { chunk: KnowledgeChunk; score: number }[] = [];

    this.embeddings.forEach(({ chunk, embedding }) => {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      if (similarity > 0.3) {
        // Only keep results above similarity threshold
        results.push({ chunk, score: similarity });
      }
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.chunk);
  }

  /**
   * Fallback keyword search when embeddings are not available
   */
  private keywordSearch(query: string, limit: number): KnowledgeChunk[] {
    const searchTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const results: { chunk: KnowledgeChunk; score: number }[] = [];

    this.embeddings.forEach(({ chunk }) => {
      let score = 0;
      const content = chunk.content.toLowerCase();
      const section = chunk.section.toLowerCase();

      searchTerms.forEach((term) => {
        if (content.includes(term)) score += 1;
        if (section.includes(term)) score += 2;
      });

      if (score > 0) {
        results.push({ chunk, score });
      }
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.chunk);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}
