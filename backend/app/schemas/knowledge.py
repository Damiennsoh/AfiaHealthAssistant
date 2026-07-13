"""
AFIA Health Assistant — Knowledge Base Schemas
SaaS (Qdrant) + Offline (JSON) dual mode
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class KnowledgeQuery(BaseModel):
    """Query the medical knowledge base.

    Used by:
    - SaaS mode: Qdrant vector search (server-side)
    - Offline mode: Client-side cosine similarity (PWA)
    """
    query: str = Field(..., min_length=3, max_length=500, description="Medical question or symptom")
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadata filters")
    top_k: int = Field(default=10, ge=1, le=50, description="Number of results to return")

    # Country context (from clinic, passed automatically)
    country_code: Optional[str] = Field(None, description="GH or ZW — auto-set from clinic")

    # For offline mode: client sends precomputed query embedding
    query_embedding: Optional[List[float]] = Field(None, description="Precomputed embedding (offline mode)")


class KnowledgeResult(BaseModel):
    """Single knowledge base result."""
    text: str = Field(..., description="Relevant text chunk from STG/EDLIZ")
    source: str = Field(..., description="Document citation")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Structured metadata")
    confidence: float = Field(..., ge=0, le=1, description="Cosine similarity score")
    citation: str = Field(..., description="Human-readable citation for display")


class KnowledgeQueryResponse(BaseModel):
    """Knowledge base query response."""
    country_code: str
    knowledge_base: str
    query: str
    results: List[KnowledgeResult] = Field(default_factory=list)
    total_results: int = 0
    query_time_ms: float = 0.0
    mode: str = Field("saas", description="saas | offline")

    # For offline mode: include the full knowledge base hash for cache validation
    kb_version: Optional[str] = None
    kb_chunk_count: Optional[int] = None


class OfflineKnowledgeBase(BaseModel):
    """Offline knowledge base package for PWA download.

    This is what rural clinics download once for offline use.
    Contains precomputed embeddings + text chunks.
    """
    country_code: str
    name: str
    version: str  # e.g., "2025.06.15" (date of last update)
    total_chunks: int
    embedding_dimension: int = 384
    embedding_model: str = "all-MiniLM-L6-v2"
    chunks: List[Dict[str, Any]] = Field(default_factory=list)  # [{id, text, embedding, metadata}]

    # For cache validation
    checksum: str  # SHA-256 of the content
