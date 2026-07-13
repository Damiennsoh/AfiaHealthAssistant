"""
AFIA Health Assistant — RAG Service (Knowledge Base Query)
SaaS mode: Qdrant vector search with metadata filtering
"""
import time
from typing import List, Optional, Dict, Any

from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

from app.core.config import get_settings, get_country_config, get_qdrant_collection
from app.core.exceptions import KnowledgeBaseError
from app.core.logging import audit_logger
from app.schemas.knowledge import KnowledgeQuery, KnowledgeQueryResponse, KnowledgeResult


class RAGService:
    """Medical knowledge base retrieval using Qdrant (SaaS mode).

    For offline mode, the PWA uses client-side cosine similarity
    over precomputed JSON embeddings (your original approach).
    """

    _model = None
    _qdrant = None

    def __init__(self):
        self.settings = get_settings()
        self.collection_name = get_qdrant_collection()

        if RAGService._model is None:
            RAGService._model = SentenceTransformer(self.settings.embedding_model)
        self.model = RAGService._model

        if RAGService._qdrant is None:
            RAGService._qdrant = QdrantClient(
                url=self.settings.qdrant_url,
                api_key=self.settings.qdrant_api_key,
            )
        self.qdrant = RAGService._qdrant

    async def query(self, query_data: KnowledgeQuery) -> KnowledgeQueryResponse:
        """Query the knowledge base using Qdrant vector search.

        For offline clinics, this endpoint is not used —
        the PWA performs client-side search instead.
        """
        start_time = time.time()
        country_code = query_data.country_code or "GH"

        # Get country config
        country_config = get_country_config(country_code)
        if not country_config:
            raise KnowledgeBaseError(f"Unknown country code: {country_code}")

        # Generate query embedding
        query_embedding = self.model.encode(query_data.query, normalize_embeddings=True)

        # Build Qdrant filter from metadata filters
        qdrant_filter = self._build_filter(country_code, query_data.filters)

        # Search Qdrant
        try:
            search_result = self.qdrant.search(
                collection_name=self.collection_name,
                query_vector=query_embedding.tolist(),
                query_filter=qdrant_filter,
                limit=query_data.top_k,
                with_payload=True,
                with_vectors=False,
            )
        except Exception as e:
            audit_logger.error("Qdrant search failed", error=str(e), query=query_data.query)
            raise KnowledgeBaseError(f"Search failed: {str(e)}")

        # Format results
        results = []
        for point in search_result:
            payload = point.payload or {}
            results.append(KnowledgeResult(
                text=payload.get("text", ""),
                source=payload.get("source", ""),
                metadata={k: v for k, v in payload.items() if k != "text"},
                confidence=round(point.score, 4),
                citation=payload.get("citation", payload.get("source", "")),
            ))

        query_time = round((time.time() - start_time) * 1000, 2)

        # Audit log
        audit_logger.info(
            "Knowledge base queried",
            action="kb_queried",
            query=query_data.query,
            country_code=country_code,
            results_count=len(results),
            query_time_ms=query_time,
            filters=query_data.filters,
        )

        return KnowledgeQueryResponse(
            country_code=country_code,
            knowledge_base=country_config.get("name", ""),
            query=query_data.query,
            results=results,
            total_results=len(results),
            query_time_ms=query_time,
            mode="saas",
        )

    def _build_filter(self, country_code: str, filters: Optional[Dict[str, Any]]) -> Optional[Filter]:
        """Build Qdrant filter from metadata filters.

        Supports:
        - country_code (always applied)
        - abcs_level (e.g., "C" for primary care)
        - ven_priority (e.g., "V" for vital medicines)
        - chapter (e.g., "13. MALARIA")
        - type ("drug_table" | "guideline")
        """
        must_conditions = [
            FieldCondition(key="country_code", match=MatchValue(value=country_code))
        ]

        if filters:
            if "abcs_level" in filters:
                must_conditions.append(
                    FieldCondition(key="abcs_level", match=MatchValue(value=filters["abcs_level"]))
                )
            if "ven_priority" in filters:
                must_conditions.append(
                    FieldCondition(key="ven_priority", match=MatchValue(value=filters["ven_priority"]))
                )
            if "chapter" in filters:
                must_conditions.append(
                    FieldCondition(key="chapter", match=MatchValue(value=filters["chapter"]))
                )
            if "type" in filters:
                must_conditions.append(
                    FieldCondition(key="type", match=MatchValue(value=filters["type"]))
                )

        return Filter(must=must_conditions) if must_conditions else None

    async def initialize_collection(self):
        """Create or recreate Qdrant collection."""
        collections = self.qdrant.get_collections().collections
        collection_names = [c.name for c in collections]

        if self.collection_name not in collection_names:
            self.qdrant.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.settings.embedding_dimension,
                    distance=Distance.COSINE,
                ),
            )
            # Create payload indexes for filtering
            self.qdrant.create_payload_index(
                collection_name=self.collection_name,
                field_name="country_code",
                field_type="keyword",
            )
            self.qdrant.create_payload_index(
                collection_name=self.collection_name,
                field_name="abcs_level",
                field_type="keyword",
            )
            self.qdrant.create_payload_index(
                collection_name=self.collection_name,
                field_name="ven_priority",
                field_type="keyword",
            )
            print(f"Created Qdrant collection: {self.collection_name}")
        else:
            print(f"Qdrant collection already exists: {self.collection_name}")

    async def index_document(self, country_code: str, chunks: List[Dict[str, Any]]):
        """Index document chunks into Qdrant.

        Used by build_knowledge_index.py script.
        """
        points = []
        for idx, chunk in enumerate(chunks):
            # Generate embedding
            embedding = self.model.encode(chunk["text"], normalize_embeddings=True)

            # Add country code to payload
            payload = chunk.get("metadata", {})
            payload["text"] = chunk["text"]
            payload["country_code"] = country_code

            points.append(PointStruct(
                id=f"{country_code}_{idx}",
                vector=embedding.tolist(),
                payload=payload,
            ))

        self.qdrant.upsert(
            collection_name=self.collection_name,
            points=points,
        )

        print(f"Indexed {len(points)} chunks for {country_code}")

    async def get_kb_info(self, country_code: str) -> Dict[str, Any]:
        """Get knowledge base info for offline sync validation."""
        country_config = get_country_config(country_code)

        # Count vectors for this country
        count_result = self.qdrant.count(
            collection_name=self.collection_name,
            count_filter=Filter(
                must=[FieldCondition(key="country_code", match=MatchValue(value=country_code))]
            ),
        )

        return {
            "country_code": country_code,
            "name": country_config.get("name", ""),
            "total_chunks": count_result.count,
            "embedding_model": self.settings.embedding_model,
            "embedding_dimension": self.settings.embedding_dimension,
        }
