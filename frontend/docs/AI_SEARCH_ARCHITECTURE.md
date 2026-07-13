# Afia AI Search Architecture

Afia Health Assistant uses a specialized **Zero-Latency Search Architecture** to provide instant clinical recommendations, even on low-end hardware and without an internet connection.

## 🚀 The Core Problem & Solution

### The Problem
Traditional offline web apps often freeze ("jank") when searching through large databases (like the GHS Standard Treatment Guidelines) because the search logic runs on the **Main Thread**.
*   Parsing thousands of JSON objects blocks the UI.
*   Calculating vector math (Cosine Similarity) for thousands of embeddings freezes animations.
*   This results in a sluggish experience where the doctor types a query and waits 2-3 seconds for a response.

### The Solution: Web Worker & In-Memory Cache
We moved the entire "Brain" of the search engine into a dedicated **Web Worker** (`workers/search.worker.ts`).

1.  **Off-Main-Thread**: All heavy lifting (loading DB, filtering, vector math) happens in a separate thread. The UI remains buttery smooth.
2.  **In-Memory Cache**: Instead of reading from IndexedDB for every keystroke, the worker loads the knowledge base into **RAM** once on startup.
3.  **Hybrid Search**: We combine two algorithms for maximum accuracy.

## 🧠 Search Logic

The `search.worker.ts` implements a sophisticated scoring system:

### 1. Keyword Scoring (Deterministic)
Checks for exact text matches in the `content`, `section` (title), and `keywords` fields.
*   **Title Match**: +5 points (High confidence)
*   **Keyword Match**: +3 points
*   **Content Match**: +1 point
*   **Authority Boost**: x1.2 if source is "GHS" or "NHIS".

### 2. Vector Search (Semantic)
Uses **Cosine Similarity** to compare the user's query embedding with the precomputed embeddings of the knowledge chunks.
*   Allows the system to understand that "high bp" is related to "Hypertension" even if the exact word isn't present.
*   Math is optimized using `Float32Array` for native performance.

### 3. Composite Score
The final relevance score is a weighted average:
```typescript
FinalScore = (VectorScore * 0.7) + (NormalizedKeywordScore * 0.3)
```
This ensures that while we understand meaning (Vector), we still respect specific medical terminology (Keyword).

## 🛠️ Implementation Details

### Files
*   **`workers/search.worker.ts`**: The worker script. Handles `INIT`, `SEARCH`, and `REFRESH` messages.
*   **`lib/knowledge-search-service.ts`**: A Singleton service that bridges the React app and the Worker.
*   **`hooks/use-knowledge-base.ts`**: The React hook that components use to consume the search.

### Data Flow
1.  **App Start**: `KnowledgeSearchService` spawns the worker.
2.  **Worker Init**: Reads `AfiaKnowledgeDB` (IndexedDB) and caches all chunks in RAM.
3.  **User Types**: `AfiaAssistant` calls `searchKnowledge("malaria")`.
4.  **Message Passing**: Query is sent to Worker. Main thread continues rendering.
5.  **Calculation**: Worker filters arrays and computes dot products.
6.  **Response**: Worker sends back top 5 results.
7.  **UI Update**: React component receives data and displays protocols.

## Performance

*   **Latency**: < 50ms for typical queries (vs 800ms+ on main thread).
*   **Memory**: ~5-10MB RAM usage for the full GHS STG + NHIS database.
*   **Offline**: 100% functional without network.

## Debugging

You can test the search engine using the hidden debug UI:
1.  Navigate to any page with the AI Assistant.
2.  Look for the `KnowledgeDebug` component (if enabled) or inspect the `search.worker.ts` logs in the browser console.
