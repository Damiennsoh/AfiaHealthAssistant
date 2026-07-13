# Knowledge Admin & Vector Search Architecture Documentation

## Overview

The Knowledge Admin system has evolved into a sophisticated **Vector-Based Retrieval-Augmented Generation (RAG)** engine. Instead of simple keyword matching, it utilizes semantic embeddings to understand the *meaning* of clinical queries, enabling highly accurate retrieval of relevant Ghana Health Service (GHS) protocols and Essential Medicines List (EML) data, even when offline.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Knowledge     │    │   Vector Engine   │    │   AI Assistant  │
│   Admin UI      │───▶│   (Semantic      │───▶│   (Context      │
│                 │    │    Search)       │    │    Injection)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   IndexedDB     │    │   Cosine         │    │   Gemini AI     │
│   (Embeddings)  │    │   Similarity     │    │   API           │
│                 │    │   Algorithm      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Core Components

### 1. Knowledge Storage Layer (IndexedDB)

The knowledge base, including pre-computed vector embeddings, is stored locally to ensure offline availability.

#### Database Configuration
*   **DB Name**: `AfiaKnowledgeDB`
*   **Store Name**: `knowledge_chunks`
*   **Version**: 2

#### Knowledge Chunk Schema (`lib/knowledge-loader.ts`)
```typescript
interface KnowledgeChunk {
  id: string;
  section: string;        // e.g., "Malaria", "Hypertension"
  content: string;        // The actual text content
  source: string;         // e.g., "GHS-STG-2017-p45"
  sourceShortName?: string; // e.g., "GHS STG"
  documentType: 'protocol' | 'formulary' | 'guideline' | 'reference';
  authority: 'ghs' | 'who' | 'nhis' | 'custom';
  color?: string;         // UI color coding
  dateAdded: string;
  dateEmbedded?: string;
  embedding: number[];    // Pre-computed vector embedding (Float32Array)
  metadata?: {
    version?: string;
    year?: number;
    page?: number;
    keywords?: string[];
  };
}
```

### 2. Vector Search Engine (`lib/vector-search.ts`)

The system uses a client-side vector search implementation to find semantically similar content.

#### Search Process
1.  **Query Embedding**: The user's query is converted into a vector embedding (currently using a lightweight local model or pre-computed mapping).
2.  **Cosine Similarity**: The system calculates the cosine similarity between the query vector and all stored chunk vectors in `IndexedDB`.
3.  **Ranking**: Results are ranked by similarity score (0 to 1).
4.  **Filtering**: Results below a certain threshold (e.g., 0.7) are discarded to ensure relevance.

#### Advantages of Vector Search
*   **Semantic Understanding**: Finds "fever treatment" even if the protocol says "pyrexia management".
*   **Context Awareness**: Better handles natural language queries from clinicians.
*   **Robustness**: Less sensitive to exact spelling or terminology mismatches.

### 3. Knowledge Loading & Chunking

*   **Pre-computation**: Heavy embedding generation is done server-side or during build time (`scripts/precompute-knowledge-bundle.js`).
*   **Bundle Loading**: The app downloads a `complete-knowledge-base.json` containing chunks and embeddings on first load.
*   **Semantic Chunking**: Large documents are split into coherent chunks (`lib/chunking-engine.ts`) to maximize context window efficiency for the AI.

### 4. Integration with AI Assistant

When a clinician asks a question:
1.  **Retrieval**: Top N relevant chunks are retrieved from `AfiaKnowledgeDB`.
2.  **Context Construction**: These chunks are formatted into a system prompt.
3.  **Generation**: Gemini AI generates an answer *grounded* in the retrieved GHS protocols, reducing hallucinations.
4.  **Citation**: The UI displays badges (e.g., "GHS STG PROTOCOL") to indicate the source of the advice.
