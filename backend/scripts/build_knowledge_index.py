#!/usr/bin/env python3
"""
AFIA Health Assistant — Build Qdrant Knowledge Index

Usage:
    python scripts/build_knowledge_index.py --country GH
    python scripts/build_knowledge_index.py --country ZW
"""
import argparse
import asyncio
import json
import hashlib
import uuid
from datetime import datetime
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings, get_country_config, get_qdrant_collection


class MedicalDocumentParser:
    """Parse medical PDF (STG or EDLIZ) into structured chunks."""

    def __init__(self, pdf_path: str):
        import fitz
        self.pdf_path = pdf_path
        self.doc = fitz.open(pdf_path)
        self.current_chapter = "Unknown"

    def parse_chunks(self):
        """Extract structured chunks preserving medical hierarchy."""
        chunks = []
        total_text = ""

        for page_num in range(len(self.doc)):
            page = self.doc[page_num]
            text = page.get_text()
            total_text += text + "\n\n"

            # Detect chapter headers
            self._detect_chapter(text)

            # Extract drug tables
            tables = page.find_tables()
            for table in tables:
                drug_data = self._parse_drug_table(table)
                if drug_data:
                    chunks.append({
                        "text": self._format_drug_text(drug_data),
                        "metadata": {
                            "type": "drug_table",
                            "chapter": self.current_chapter,
                            "page": page_num + 1,
                            "abcs_level": drug_data.get("abcs"),
                            "ven_priority": drug_data.get("ven"),
                            "drug": drug_data.get("medicine"),
                            "adult_dose": drug_data.get("adult_dose"),
                            "frequency": drug_data.get("frequency"),
                            "duration": drug_data.get("duration"),
                        }
                    })

            # Extract guideline paragraphs
            paragraphs = self._extract_guidelines(text)
            for para in paragraphs:
                chunks.append({
                    "text": para,
                    "metadata": {
                        "type": "guideline",
                        "chapter": self.current_chapter,
                        "page": page_num + 1,
                    }
                })

        # If no chunks extracted, try fallback text extraction
        if len(chunks) == 0 and len(total_text) > 1000:
            print(f"No structured chunks found, using fallback text extraction...")
            chunks = self._chunk_fallback_text(total_text)

        print(f"Extracted {len(chunks)} chunks total")
        return chunks

    def _detect_chapter(self, text: str):
        """Detect chapter header like '15. CARDIOVASCULAR DISEASE'."""
        import re
        match = re.search(r'^(\d+\.\s+([A-Z][A-Z\s]+))$', text[:200], re.MULTILINE)
        if match:
            self.current_chapter = match.group(1).strip()

    def _parse_drug_table(self, table):
        """Parse EDLIZ drug table format."""
        rows = table.extract()
        if len(rows) < 2:
            return None

        headers = [h.lower().strip() if h else "" for h in rows[0]]
        if "medicine" not in headers and "drug" not in headers:
            return None

        medicine_idx = next((i for i, h in enumerate(headers) if "medicine" in h or "drug" in h), 0)
        codes_idx = next((i for i, h in enumerate(headers) if "code" in h), None)
        dose_idx = next((i for i, h in enumerate(headers) if "dose" in h), None)
        freq_idx = next((i for i, h in enumerate(headers) if "freq" in h), None)
        duration_idx = next((i for i, h in enumerate(headers) if "duration" in h), None)

        drugs = []
        for row in rows[1:]:
            if not row or not row[medicine_idx]:
                continue

            drug = {"medicine": row[medicine_idx].strip()}

            if codes_idx is not None and codes_idx < len(row):
                codes = str(row[codes_idx]).split()
                drug["abcs"] = codes[0] if len(codes) > 0 else None
                drug["ven"] = codes[1] if len(codes) > 1 else None

            if dose_idx is not None and dose_idx < len(row):
                drug["adult_dose"] = row[dose_idx]
            if freq_idx is not None and freq_idx < len(row):
                drug["frequency"] = row[freq_idx]
            if duration_idx is not None and duration_idx < len(row):
                drug["duration"] = row[duration_idx]

            drugs.append(drug)

        return drugs[0] if drugs else None

    def _format_drug_text(self, drug: dict) -> str:
        """Format drug entry as searchable text."""
        parts = [f"Medicine: {drug['medicine']}"]
        if drug.get("adult_dose"):
            parts.append(f"Dose: {drug['adult_dose']}")
        if drug.get("frequency"):
            parts.append(f"Frequency: {drug['frequency']}")
        if drug.get("duration"):
            parts.append(f"Duration: {drug['duration']}")
        return ". ".join(parts)

    def _extract_guidelines(self, text: str) -> list:
        """Extract guideline paragraphs."""
        paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) > 50]
        return paragraphs[:5]

    def _chunk_fallback_text(self, text: str) -> list:
        """Fallback chunking for when structured extraction fails."""
        CHUNK_SIZE = 1000
        CHUNK_OVERLAP = 200

        # Remove common noise patterns
        import re
        text = re.sub(r'Page \d+', '', text)
        text = re.sub(r'–\s*\d+\s*–', '', text)
        text = re.sub(r'EDLIZ\s+2020', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Ministry of Health', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Republic of Zimbabwe', '', text, flags=re.IGNORECASE)

        # Split by paragraphs
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if len(para) < 50:
                continue

            if len(current_chunk) + len(para) > CHUNK_SIZE:
                if current_chunk:
                    chunks.append({
                        "text": current_chunk.strip(),
                        "metadata": {
                            "type": "guideline",
                            "chapter": self.current_chapter,
                        }
                    })
                current_chunk = para
            else:
                current_chunk += "\n\n" + para if current_chunk else para

        if current_chunk:
            chunks.append({
                "text": current_chunk.strip(),
                "metadata": {
                    "type": "guideline",
                    "chapter": self.current_chapter,
                }
            })

        return chunks


class KnowledgeIndexBuilder:
    """Build Qdrant vector index for medical knowledge."""

    def __init__(self):
        self.settings = get_settings()
        self.collection_name = get_qdrant_collection()
        # Force CPU-only to avoid NVIDIA CUDA downloads
        self.model = SentenceTransformer(self.settings.embedding_model, device='cpu')
        self.qdrant = QdrantClient(
            url=self.settings.qdrant_url,
            api_key=self.settings.qdrant_api_key,
        )

    async def build(self, country_code: str):
        """Build index for a country."""
        config = get_country_config(country_code)
        if not config:
            print(f"Unknown country: {country_code}")
            return

        # Handle multiple documents for Ghana (STG + NHIS)
        pdf_paths = []
        if country_code == "GH":
            pdf_paths.append(config.get("document_path"))
            if config.get("document_path_nhis"):
                pdf_paths.append(config.get("document_path_nhis"))
        else:
            pdf_paths.append(config.get("document_path"))

        # Validate PDFs exist
        for pdf_path in pdf_paths:
            if not pdf_path or not Path(pdf_path).exists():
                print(f"PDF not found: {pdf_path}")
                return

        print(f"Building index for {config['name']}...")
        print(f"Processing {len(pdf_paths)} document(s)")

        all_chunks = []
        for pdf_path in pdf_paths:
            print(f"Parsing: {pdf_path}")
            parser = MedicalDocumentParser(pdf_path)
            chunks = parser.parse_chunks()
            all_chunks.extend(chunks)
            print(f"  Extracted {len(chunks)} chunks")

        print(f"Total chunks: {len(all_chunks)}")

        texts = [chunk["text"] for chunk in all_chunks]
        embeddings = self.model.encode(texts, show_progress_bar=True, normalize_embeddings=True)
        print(f"Generated {len(embeddings)} embeddings")

        await self._ensure_collection()

        points = []
        for idx, (chunk, embedding) in enumerate(zip(all_chunks, embeddings)):
            payload = chunk["metadata"].copy()
            payload["text"] = chunk["text"]
            payload["country_code"] = country_code

            points.append(PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding.tolist(),
                payload=payload,
            ))

        self.qdrant.upsert(collection_name=self.collection_name, points=points)
        print(f"Uploaded {len(points)} vectors to Qdrant")

        await self._save_offline_json(country_code, all_chunks, embeddings)
        print(f"Done! Index built for {country_code}")

    async def _ensure_collection(self):
        """Create collection if not exists."""
        collections = self.qdrant.get_collections().collections
        names = [c.name for c in collections]

        if self.collection_name not in names:
            self.qdrant.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.settings.embedding_dimension,
                    distance=Distance.COSINE,
                ),
            )
            for field in ["country_code", "abcs_level", "ven_priority"]:
                self.qdrant.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field,
                    field_type="keyword",
                )
            print(f"Created collection: {self.collection_name}")

    async def _save_offline_json(self, country_code: str, chunks: list, embeddings: list):
        """Save offline package for PWA."""
        offline_data = {
            "country_code": country_code,
            "name": get_country_config(country_code)["name"],
            "version": datetime.now().strftime("%Y.%m.%d"),
            "total_chunks": len(chunks),
            "embedding_dimension": self.settings.embedding_dimension,
            "embedding_model": self.settings.embedding_model,
            "chunks": [],
        }

        for chunk, emb in zip(chunks, embeddings):
            offline_data["chunks"].append({
                "text": chunk["text"],
                "embedding": emb.tolist(),
                "metadata": chunk["metadata"],
            })

        json_str = json.dumps(offline_data, sort_keys=True)
        offline_data["checksum"] = hashlib.sha256(json_str.encode()).hexdigest()

        # Save to static/knowledge directory for serving via backend
        output_path = Path(f"static/knowledge/{country_code.lower()}-knowledge-offline.json")
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(offline_data, f, indent=2)

        print(f"Offline package saved: {output_path}")


async def main():
    parser = argparse.ArgumentParser(description="Build Qdrant knowledge index")
    parser.add_argument("--country", required=True, choices=["GH", "ZW"], help="Country code")
    args = parser.parse_args()

    builder = KnowledgeIndexBuilder()
    await builder.build(args.country)


if __name__ == "__main__":
    asyncio.run(main())
