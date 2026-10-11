import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from app.api.v1 import knowledge
from app.schemas.knowledge import KnowledgeQuery


class FakeRAGService:
    def __init__(self):
        self.query_data = None

    async def query(self, query_data):
        self.query_data = query_data
        return SimpleNamespace(total_results=0, results=[])


class FakeAuditService:
    async def log(self, **kwargs):
        return None


def make_request():
    return Request({
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/v1/knowledge/query",
        "raw_path": b"/api/v1/knowledge/query",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 12345),
        "server": ("localhost", 8000),
    })


class KnowledgeJurisdictionTests(unittest.TestCase):
    def test_query_uses_authenticated_clinic_country(self):
        rag_service = FakeRAGService()
        user = SimpleNamespace(
            id="user-1",
            clinic=SimpleNamespace(country_code="GH", is_active=True),
        )

        with patch.object(knowledge, "RAGService", return_value=rag_service), patch.object(
            knowledge, "AuditService", return_value=FakeAuditService()
        ):
            asyncio.run(knowledge.query_knowledge(
                make_request(),
                KnowledgeQuery(query="malaria treatment", country_code="ZW"),
                user,
                object(),
            ))

        self.assertEqual(rag_service.query_data.country_code, "GH")


    def test_query_rejects_unsupported_clinic_country(self):
        user = SimpleNamespace(
            id="user-1",
            clinic=SimpleNamespace(country_code="XX", is_active=True),
        )

        with self.assertRaises(HTTPException) as error:
            asyncio.run(knowledge.query_knowledge(
                make_request(),
                KnowledgeQuery(query="malaria treatment", country_code="GH"),
                user,
                object(),
            ))

        self.assertEqual(error.exception.status_code, 400)