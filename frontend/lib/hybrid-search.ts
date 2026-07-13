import type { KnowledgeChunk } from "./knowledge-base";
import { searchLocalKnowledge } from "./knowledge-base";
import { vectorSearch, type VectorSearchResult } from "./vector-search";

export interface SearchResult {
  chunk: KnowledgeChunk;
  score: number;
  type: "vector" | "keyword";
}

/**
 * Hybrid search combines semantic vector search with keyword search.
 * Vector search finds related meaning; keyword search keeps exact drug names safe.
 */
export async function performHybridSearch(
  query: string,
  queryVector: number[],
  maxResults: number = 5
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const [vectorMatches, keywordMatches] = await Promise.all([
    queryVector && queryVector.length ? vectorSearch(queryVector, maxResults) : Promise.resolve([]),
    searchLocalKnowledge(query),
  ]);

  // Map vector cosine scores (roughly -1..1) into 0..1 range
  const vectorResults: SearchResult[] = (vectorMatches as VectorSearchResult[]).map(
    (m) => ({
      chunk: m.chunk,
      score: (m.score + 1) / 2,
      type: "vector",
    })
  );

  // Keyword matches do not expose scores; keep them below vector priority
  const keywordResults: SearchResult[] = (keywordMatches as KnowledgeChunk[]).map((chunk) => ({
    chunk,
    score: 0.9,
    type: "keyword",
  }));

  const combined = [...vectorResults, ...keywordResults];

  // Deduplicate by chunk id, keeping the highest score (e.g. when both vector & keyword hit)
  const byId = new Map<string, SearchResult>();
  for (const item of combined) {
    const existing = byId.get(item.chunk.id);
    if (!existing || item.score > existing.score) {
      byId.set(item.chunk.id, item);
    }
  }

  const uniqueResults = Array.from(byId.values());
  uniqueResults.sort((a, b) => b.score - a.score);

  return uniqueResults.slice(0, maxResults);
}
