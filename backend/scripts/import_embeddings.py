#!/usr/bin/env python3
"""
AFIA Health Assistant — Import Existing Ghana Embeddings

Imports your pre-computed ghs-stg-embeddings.json and nhis-embeddings.json
into Qdrant AND creates offline JSON for PWA.
"""
import json
import hashlib
from datetime import datetime
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings, get_qdrant_collection, get_country_config


def import_country_embeddings(country_code: str):
    """Import existing country embeddings into Qdrant and generate offline package."""
    settings = get_settings()
    collection_name = get_qdrant_collection()
    config = get_country_config(country_code)

    if not config:
        print(f"Unknown country code: {country_code}")
        return

    # Use absolute path from project root
    project_root = Path(__file__).parent.parent

    all_points = []
    offline_chunks = []

    # Handle different countries
    if country_code == "GH":
        # Ghana has two files: GHS STG and NHIS
        ghs_path = project_root / "knowledge-base/ghana/ghs-stg-embeddings.json"
        nhis_path = project_root / "knowledge-base/ghana/nhis-embeddings.json"

        if not ghs_path.exists():
            print(f"GHS embeddings not found: {ghs_path}")
            return

        print(f"Loading {ghs_path}...")
        with open(ghs_path, encoding='utf-8') as f:
            ghs_data = json.load(f)

        ghs_items = ghs_data if isinstance(ghs_data, list) else ghs_data.get("embeddings", [])

        for idx, item in enumerate(ghs_items):
            point_id = idx  # Use integer ID
            vector = item.get("embedding") if "embedding" in item else item.get("vector")
            text = item.get("content") if "content" in item else item.get("text")
            source = item.get("source", "GHS-STG-2017")
            metadata = item.get("metadata", {})

            all_points.append(PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "text": text,
                    "source": source,
                    "type": "guideline",
                    "country_code": "GH",
                    **metadata,
                }
            ))
            offline_chunks.append({
                "text": text,
                "embedding": vector,
                "metadata": {
                    "source": source,
                    "type": "guideline",
                    **metadata,
                }
            })

        if nhis_path.exists():
            print(f"Loading {nhis_path}...")
            with open(nhis_path, encoding='utf-8') as f:
                nhis_data = json.load(f)

            nhis_items = nhis_data if isinstance(nhis_data, list) else nhis_data.get("embeddings", [])

            offset = len(all_points)
            for idx, item in enumerate(nhis_items):
                point_id = offset + idx  # Use integer ID
                vector = item.get("embedding") if "embedding" in item else item.get("vector")
                text = item.get("content") if "content" in item else item.get("text")
                source = item.get("source", "NHIS-EML-2025")
                metadata = item.get("metadata", {})

                all_points.append(PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "text": text,
                        "source": source,
                        "type": "medicine_list",
                        "country_code": "GH",
                        **metadata,
                    }
                ))
                offline_chunks.append({
                    "text": text,
                    "embedding": vector,
                    "metadata": {
                        "source": source,
                        "type": "medicine_list",
                        **metadata,
                    }
                })

    elif country_code == "ZW":
        # Zimbabwe has one file
        zw_path = project_root / "knowledge-base/zimbabwe/edliz-embeddings.json"

        if not zw_path.exists():
            print(f"Zimbabwe embeddings not found: {zw_path}")
            return

        print(f"Loading {zw_path}...")
        with open(zw_path, encoding='utf-8') as f:
            zw_data = json.load(f)

        zw_items = zw_data if isinstance(zw_data, list) else zw_data.get("embeddings", [])

        for idx, item in enumerate(zw_items):
            point_id = idx  # Use integer ID
            vector = item.get("embedding") if "embedding" in item else item.get("vector")
            text = item.get("content") if "content" in item else item.get("text")
            source = item.get("source", "EDLIZ-2020")
            metadata = item.get("metadata", {})

            all_points.append(PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "text": text,
                    "source": source,
                    "type": "guideline",
                    "country_code": "ZW",
                    **metadata,
                }
            ))
            offline_chunks.append({
                "text": text,
                "embedding": vector,
                "metadata": {
                    "source": source,
                    "type": "guideline",
                    **metadata,
                }
            })

    # Try to upload to Qdrant (skip if not available)
    try:
        qdrant = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
        collections = qdrant.get_collections().collections
        if collection_name not in [c.name for c in collections]:
            qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE),
            )
            for field in ["country_code", "abcs_level", "ven_priority"]:
                qdrant.create_payload_index(
                    collection_name=collection_name,
                    field_name=field,
                    field_type="keyword",
                )

        print(f"Uploading {len(all_points)} vectors to Qdrant...")
        qdrant.upsert(collection_name=collection_name, points=all_points)
        print("Qdrant upload successful!")
    except Exception as e:
        print(f"Qdrant upload failed (skipping): {e}")
        print("Continuing with offline package generation...")

    offline_data = {
        "country_code": country_code,
        "name": config["name"],
        "version": datetime.now().strftime("%Y.%m.%d"),
        "total_chunks": len(offline_chunks),
        "embedding_dimension": 384,
        "embedding_model": "all-MiniLM-L6-v2",
        "chunks": offline_chunks,
    }

    json_str = json.dumps(offline_data, sort_keys=True)
    offline_data["checksum"] = hashlib.sha256(json_str.encode()).hexdigest()

    output_path = Path(f"static/knowledge/{country_code.lower()}-knowledge-offline.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(offline_data, f, indent=2)

    print(f"Done! Imported {len(all_points)} vectors.")
    print(f"Offline package saved: {output_path}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Import country embeddings to Qdrant and generate offline package")
    parser.add_argument("--country", type=str, required=True, choices=["GH", "ZW"], help="Country code (GH or ZW)")
    args = parser.parse_args()

    import_country_embeddings(args.country)
