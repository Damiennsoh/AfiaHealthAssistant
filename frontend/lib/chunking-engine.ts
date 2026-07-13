export interface ChunkMetadata {
  source: string;
  section?: string;
  pageNumber?: number;
}

export interface Chunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
}

/**
 * Semantic-ish text chunking with paragraph preservation and overlap.
 *
 * - Splits text into paragraphs first to keep meaning together.
 * - Builds chunks up to `maxChunkSize` characters.
 * - When a chunk would exceed `maxChunkSize`, it is finalized and the next
 *   chunk starts with an overlap from the end of the previous chunk so
 *   context is preserved across boundaries.
 */
export function semanticChunking(
  text: string,
  maxChunkSize: number = 800,
  overlapSize: number = 150
): string[] {
  const chunks: string[] = [];

  const normalized = text.replace(/\r\n/g, "\n");
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  let currentChunk = "";

  for (const para of paragraphs) {
    // If paragraph itself is huge, split it naively by sentences for now.
    if (para.length > maxChunkSize) {
      const sentences = para.split(/(?<=[\.!?])\s+/);
      for (const sentence of sentences) {
        if (sentence.length === 0) continue;

        if ((currentChunk + " " + sentence).trim().length <= maxChunkSize) {
          currentChunk = currentChunk
            ? `${currentChunk} ${sentence}`
            : sentence;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk);
          }
          const overlap = currentChunk.slice(-overlapSize);
          currentChunk = overlap
            ? `${overlap} ${sentence}`.trim()
            : sentence;
        }
      }
      continue;
    }

    const next = currentChunk
      ? `${currentChunk}\n\n${para}`
      : para;

    if (next.length <= maxChunkSize) {
      currentChunk = next;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      const overlap = currentChunk.slice(-overlapSize);
      currentChunk = overlap
        ? `${overlap}\n\n${para}`.trim()
        : para;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

