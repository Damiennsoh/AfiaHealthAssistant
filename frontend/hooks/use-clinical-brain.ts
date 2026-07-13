"use client";

import { useEffect, useRef, useState } from "react";
import { performHybridSearch } from "@/lib/hybrid-search";

const EMBEDDINGS_ENABLED = (process.env.NEXT_PUBLIC_ENABLE_EMBEDDINGS ?? 'true') !== 'false' && (process.env.NEXT_PUBLIC_ENABLE_EMBEDDINGS ?? 'true') !== '0';

type WorkerMessage =
  | { type: "status"; message: string }
  | { type: "progress"; current: number; total: number }
  | { type: "complete"; results: Array<{id: string, embedding?: number[], success: boolean, error?: string}> }
  | { type: "error"; error: string };

export function useClinicalBrain() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!EMBEDDINGS_ENABLED) {
      console.info("Clinical brain: embeddings disabled via NEXT_PUBLIC_ENABLE_EMBEDDINGS");
      // If disabled, we rely solely on keyword search (IndexedDB)
      setIsReady(false);
      return;
    }

    const worker = new Worker('/workers/embedding-isolated.worker.js');
    workerRef.current = worker;

    // The new worker sends status messages instead of ready
    // We'll consider it ready when we get the "Model Ready" status
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as WorkerMessage;
      if (data?.type === "status" && data.message === "Model Ready") {
        setIsReady(true);
      }
      if (data?.type === "error") {
        console.error("Clinical brain worker error:", data.error);
      }
    };

    worker.addEventListener("message", handleMessage);

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const getQueryVector = async (query: string): Promise<number[]> => {
    if (!EMBEDDINGS_ENABLED) return [];
    if (!query.trim() || !workerRef.current) return [];
    const worker = workerRef.current;

    const queryVector: number[] = await new Promise((resolve) => {
      const handleMessage = (event: MessageEvent) => {
        const data = event.data as WorkerMessage;
        
        if (data?.type === "status") {
          console.log("Worker status:", data.message);
          return;
        }
        
        if (data?.type === "complete") {
          worker.removeEventListener("message", handleMessage);
          const result = data.results?.[0];
          if (result?.success && result.embedding) {
            resolve(result.embedding);
          } else {
            console.error("Query embedding failed:", result?.error);
            resolve([]);
          }
        } else if (data?.type === "error") {
          console.error("Embedding query failed:", data.error);
          worker.removeEventListener("message", handleMessage);
          resolve([]);
        }
      };

      worker.addEventListener("message", handleMessage);
      worker.postMessage({ type: "EMBED_QUERY", text: query });
    });
    return queryVector;
  };

  const getClinicalMatches = async (query: string, maxResults: number = 3) => {
    const queryVector = await getQueryVector(query);

    // If we could not embed for some reason, hybrid search will still fall back to keyword search
    const results = await performHybridSearch(query, queryVector, maxResults);
    return results;
  };

  const getClinicalContext = async (query: string, maxResults: number = 3): Promise<string> => {
    if (!query.trim()) return "";

    const results = await getClinicalMatches(query, maxResults);
    if (results.length === 0) return "";

    return results
      .map(
        (r, index) =>
          `[SOURCE ${index + 1} - ${r.chunk.section}]\n${r.chunk.content}`
      )
      .join("\n\n");
  };

  return { getClinicalContext, getClinicalMatches, isReady };
}
