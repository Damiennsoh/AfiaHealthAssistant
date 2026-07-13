#!/usr/bin/env python3
"""
Check Qdrant knowledge base status
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from app.services.rag_service import RAGService

async def main():
    rag = RAGService()
    
    print("=== Qdrant Knowledge Base Status ===\n")
    
    # Check Ghana
    gh_info = await rag.get_kb_info('GH')
    print(f"Ghana (GH):")
    print(f"  Name: {gh_info['name']}")
    print(f"  Total Chunks: {gh_info['total_chunks']}")
    print(f"  Embedding Model: {gh_info['embedding_model']}")
    print(f"  Embedding Dimension: {gh_info['embedding_dimension']}")
    print()
    
    # Check Zimbabwe
    zw_info = await rag.get_kb_info('ZW')
    print(f"Zimbabwe (ZW):")
    print(f"  Name: {zw_info['name']}")
    print(f"  Total Chunks: {zw_info['total_chunks']}")
    print(f"  Embedding Model: {zw_info['embedding_model']}")
    print(f"  Embedding Dimension: {zw_info['embedding_dimension']}")
    print()
    
    # Test search
    print("=== Test Search ===")
    from app.schemas.knowledge import KnowledgeQuery
    test_query = KnowledgeQuery(query="malaria treatment", country_code="GH", top_k=3)
    result = await rag.query(test_query)
    print(f"Query: {test_query.query}")
    print(f"Results found: {result.total_results}")
    print(f"Query time: {result.query_time_ms}ms")
    print(f"Mode: {result.mode}")
    print()
    if result.results:
        print("Top result:")
        print(f"  Text: {result.results[0].text[:200]}...")
        print(f"  Confidence: {result.results[0].confidence}")

if __name__ == "__main__":
    asyncio.run(main())
