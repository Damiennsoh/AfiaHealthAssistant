# Afia Intelligence Hub & Clinical Hub

## Overview

The Afia Intelligence Hub consolidates AI-powered clinical decision support into a structured, mobile-first experience. There are three distinct AI interfaces:

| Interface | Location | Purpose | API | Output |
|-----------|----------|---------|-----|--------|
| **AfiaChat** | Dashboard (embedded widget) | Quick question + optional lab scan/image | `/api/afia` | Plain text, markdown stripped, concise |
| **AIAssistant** | Sidebar → AI Assistant (Diagnostic Aid) | Multi-turn chat, encounter context | `/api/chat` | Streamed text, formatClinicalResponse |
| **Clinical Hub (AfiaAssistant)** | Encounter → Request AI Consult | Encounter-scoped, one-tap sync | `/api/chat` (structuredOnly) | Structured JSON only |

- **AfiaChat (Dashboard)**: Single prompt + optional image; uses `/api/afia` with `concise: true`; supports lab scans (max 5MB file, resize/crop); strips markdown on display.
- **Clinical Hub** (`AfiaAssistant`): Encounter-scoped, structured JSON, one-tap "Sync & Complete"
- **AI Assistant** (`AIAssistant`): Multi-turn chat for general consultation with protocol search

## Clinical Hub Flow

1. User opens an encounter and clicks "Request AI Consult"
2. Navigation to `/ai-assistant?encounterId=...` renders the Clinical Hub
3. On load, the hub auto-sends an analysis using:
   - Encounter data (symptoms, presenting complaint, history)
   - Patient context (demographics)
   - Local GHS protocol search (IndexedDB)
4. API returns structured JSON: `diagnosis`, `treatment`, `historyNote`, `isDisclaimer`
5. UI displays a Clinical Action Card with:
   - Citation badge: GHS STG PROTOCOL (green) or GENERAL MEDICAL GUIDANCE (amber)
   - Diagnosis, Treatment, Note for record
   - Disclaimer when treatment is not from local protocols
6. User taps "Sync & Complete" → encounter updated, status `completed`, `aiDiagnosisData` set, redirect

## Structured Output

- **Request**: `POST /api/chat` with `structuredOnly: true`, `prompt` (enhanced with PROTOCOL_CONTEXT, USER_QUERY, PATIENT_CONTEXT)
- **Response**: JSON `{ diagnosis, treatment, historyNote, isDisclaimer }`
- **Citation logic**: Badge reflects both client-side protocol match and AI `isDisclaimer` flag

## Queue Feature

- **Purpose**: Allow clinicians to continue workflow when offline; queue AI requests and uploads for processing when connectivity returns
- **AI Request Queue**: Messages stored in IndexedDB with status `queued`; processed automatically when online
- **Upload Queue**: Image uploads enqueued; processor retries with exponential backoff
- **UI**: Header badge "Queue: N" shows queued AI requests; dashboard "AI Queue" shows combined counts
