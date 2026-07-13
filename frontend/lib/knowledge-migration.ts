import { semanticChunking } from "./chunking-engine";
import type { KnowledgeChunk } from "./knowledge-base";

const DB_NAME = "AfiaKnowledgeDB";
const STORE_NAME = "knowledge_chunks";
const DB_VERSION = 2;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

async function clearStore(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getAllChunks(db: IDBDatabase): Promise<KnowledgeChunk[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as KnowledgeChunk[]);
    req.onerror = () => reject(req.error);
  });
}

async function saveChunks(db: IDBDatabase, chunks: KnowledgeChunk[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    chunks.forEach((chunk) => store.put(chunk));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const BATCH_SIZE = 20;

export interface MigrationOptions {
  embedChunks: (texts: string[]) => Promise<number[][]>;
  onProgress?: (pct: number, msg: string) => void;
}

export interface MigrationResult {
  success: boolean;
  migratedSources: number;
  migratedChunks: number;
}

/**
 * Re-index existing page-based knowledge chunks into semantic + vector chunks.
 * Uses the provided embedChunks function (main-thread or worker). Main-thread is recommended
 * because transformers.js env checks fail in Web Workers.
 */
export async function migrateKnowledgeToSemanticVectors(
  options: MigrationOptions
): Promise<MigrationResult> {
  const { embedChunks, onProgress } = options;

  const db = await openDB();
  const allOldChunks = await getAllChunks(db);

  if (allOldChunks.length === 0) {
    return { success: true, migratedSources: 0, migratedChunks: 0 };
  }

  onProgress?.(5, "Grouping legacy chunks by source...");

  // Group by source (e.g. PDF file name) and preserve rough chronological order
  const sorted = [...allOldChunks].sort((a, b) =>
    (a.dateAdded || "").localeCompare(b.dateAdded || "")
  );

  const sources = new Map<string, string>();
  for (const chunk of sorted) {
    const current = sources.get(chunk.source) || "";
    const spacer = current ? " " : "";
    sources.set(chunk.source, `${current}${spacer}${chunk.content}`);
  }

  // Build all new chunks first; only clear store after we've successfully embedded
  // so we don't lose data if embedding fails
  const sourceList = Array.from(sources.entries());
  const totalSources = sourceList.length;
  const allNewChunks: KnowledgeChunk[] = [];
  const now = new Date().toISOString();

  for (let s = 0; s < sourceList.length; s++) {
    const [sourceName, fullText] = sourceList[s];
    const semanticChunks = semanticChunking(fullText, 800, 150);
    if (semanticChunks.length === 0) continue;

    const allVectors: number[][] = [];

    for (let i = 0; i < semanticChunks.length; i += BATCH_SIZE) {
      const batch = semanticChunks.slice(i, i + BATCH_SIZE);
      const pctBase = 10 + (s / totalSources) * 80;
      const pctInSource = (i / semanticChunks.length) * (80 / totalSources);
      onProgress?.(pctBase + pctInSource, `Embedding ${sourceName} (batch ${Math.floor(i / BATCH_SIZE) + 1})...`);

      const vectors = await embedChunks(batch);
      allVectors.push(...vectors);
    }

    for (let index = 0; index < semanticChunks.length; index++) {
      allNewChunks.push({
        id: `migrated-${Date.now()}-${s}-${index}`,
        section: `${sourceName} (Part ${index + 1})`,
        content: semanticChunks[index],
        source: sourceName,
        dateAdded: now,
        isAuthority: true,
        type: "protocol",
        embedding: allVectors[index],
      });
    }
  }

  onProgress?.(95, "Saving to database...");
  await clearStore(db);
  await saveChunks(db, allNewChunks);

  return {
    success: true,
    migratedSources: sources.size,
    migratedChunks: allNewChunks.length,
  };
}

