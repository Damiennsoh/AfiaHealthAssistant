# 🏥 AFIA Health Assistant

> **A privacy-first, offline-capable clinical decision support system for rural healthcare facilities in Ghana and Zimbabwe.**

AFIA is a full-stack, multi-tenant SaaS platform designed to work in environments with unreliable internet connectivity. It combines an AI-powered RAG knowledge engine with GHS Standard Treatment Guidelines, a SOAP-note encounter system, and a secure offline-first architecture.

**Live Frontend:** [afia-health-assistant-bw-lilac.vercel.app](https://afia-health-assistant-bw-lilac.vercel.app)  
**Backend API:** [afia-health-assistant-backend.onrender.com](https://afia-health-assistant-backend.onrender.com)

---

## � Documentation

- **[User Manual](./USER_MANUAL.md)** - Comprehensive guide for healthcare providers
- **[Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)** - Step-by-step production setup
- **[Render Deployment Guide](./RENDER_DEPLOYMENT_GUIDE.md)** - Render.com specific deployment
- **[Vercel Deployment Checklist](./VERCEL_DEPLOYMENT_CHECKLIST.md)** - Frontend deployment steps
- **[Integration Guide](./INTEGRATION_GUIDE.md)** - Migration and integration instructions
- **[Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md)** - Pre-deployment verification

---

## �📁 Repository Structure

```
afia-health-assistant-bw/
├── frontend/                        # Next.js 16 progressive web app
│   ├── app/                         # App Router pages (login, dashboard, encounters, etc.)
│   ├── components/                  # React UI components (encounters, patients, AI, etc.)
│   ├── contexts/                    # Auth, permissions, and sync contexts
│   ├── hooks/                       # Custom hooks (sync, permissions, knowledge base)
│   ├── lib/                         # API client, IndexedDB service, knowledge loader
│   ├── workers/                     # Web Worker for offline knowledge search
│   ├── public/
│   │   ├── data/                    # Pre-computed GHS/NHIS embeddings (~29MB JSON)
│   │   └── sw.js                    # Service Worker for offline asset caching
│   └── docs/                        # Detailed frontend architecture documentation
│
├── backend/                         # Python FastAPI backend
│   ├── app/
│   │   ├── api/v1/                  # REST API routes (auth, clinics, patients, encounters, etc.)
│   │   ├── core/                    # Security, config, JWT, encryption
│   │   ├── db/                      # SQLAlchemy async session management
│   │   ├── models/                  # ORM models (User, Clinic, Patient, Encounter)
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   └── services/                # Business logic (auth, user, patient services)
│   ├── scripts/                     # One-off scripts (create_superadmin.py)
│   ├── Dockerfile                   # Production Docker image
│   ├── alembic.ini                  # DB migration config
│   └── requirements.txt
│
├── docker-compose.yml               # Full local dev stack
├── INTEGRATION_GUIDE.md             # Migration and integration guide
├── DEPLOYMENT_REVIEW.md             # Complete deployment review
├── RENDER_DEPLOYMENT_GUIDE.md       # Render.com deployment steps
└── VERCEL_DEPLOYMENT_CHECKLIST.md   # Vercel deployment checklist
```

---

## 🛠️ Tech Stack

### Frontend
| Layer | Technology | Version |
|---|---|---|
| Framework | **Next.js** (App Router) | 16.0.10 |
| UI Runtime | **React** | 19.2.1 |
| Language | **TypeScript** | ^5 |
| Styling | **TailwindCSS** + Radix UI | 4.x |
| Local Database | **IndexedDB** via `idb` | ^8.0 |
| AI SDK | **Google Generative AI** (Gemini) | ^0.24 |
| Offline Search | **Web Workers** (Dedicated Worker) | Native |
| PDF Parsing | **pdf-parse** + PyMuPDF | — |
| HTTP Client | **Native Fetch** with retry/backoff | — |
| Forms | **React Hook Form** + Zod | — |
| Charts | **Recharts** | 2.x |
| Testing | **Vitest** + Playwright | — |
| Deployment | **Vercel** | — |

### Backend
| Layer | Technology | Version |
|---|---|---|
| Framework | **FastAPI** | 0.111.0 |
| Server | **Uvicorn** (with uvloop) | 0.30.0 |
| Language | **Python** | 3.11 |
| ORM | **SQLAlchemy** (async) | 2.0.30 |
| DB Driver | **asyncpg** (PostgreSQL) | 0.29.0 |
| Migrations | **Alembic** | 1.13.1 |
| Cache | **Redis** | 5.x |
| Vector DB | **Qdrant** | 1.9.1 |
| Auth | **JWT** (python-jose) + bcrypt | — |
| Encryption | **AES-256** field-level (cryptography) | 42.x |
| Embeddings | **Sentence Transformers** (all-MiniLM-L6-v2) | 3.x |
| Storage | **MinIO** (S3-compatible) | 7.x |
| Deployment | **Render.com** (Docker) | — |

### Infrastructure (Local Dev)
| Service | Purpose |
|---|---|
| **PostgreSQL 16** | Primary relational database |
| **Redis 7** | Session cache, rate limiting, sync queue |
| **Qdrant** | Vector similarity search for medical knowledge |
| **MinIO** | Object storage for documents and backups |
| **Docker Compose** | Local orchestration of all services |

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔐 **Admin-provisioned accounts** | No self-registration. All staff accounts created by clinic admin |
| 🏥 **Multi-tenant, multi-country** | Isolated data per clinic; supports Ghana (GHS) and Zimbabwe (EDLIZ) protocols |
| 📵 **Offline-first architecture** | All clinical data written to local IndexedDB first; synced to backend when online |
| 🔁 **Hybrid sync engine** | Delta sync with timestamp-based conflict resolution ("newer wins") |
| 🤖 **Two-Stage AI Pipeline** | Clean vector search + contextual LLM reasoning for accurate GHS protocol detection |
| 🔍 **Offline knowledge search** | Dedicated Web Worker searches IndexedDB without blocking the UI |
| 🔒 **Dual-key security lockout** | Local (IndexedDB) + remote lockout to prevent brute-force even when offline |
| 📊 **SOAP note encounters** | Structured clinical encounters with vitals, diagnosis, prescriptions, and referrals |
| 📋 **Patient management** | Folder-number-based records with NHIS integration |
| 💾 **Data backup** | Full clinic export as `.afia` files; per-table CSV export |
| 🔑 **Field-level encryption** | AES-256 encryption for sensitive patient data at rest |
| 📝 **Audit logging** | Immutable, append-only audit trail for every clinical action |
| 👤 **Super admin global access** | Super admins can manage all clinics without clinic assignment |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js >= 20
- pnpm (`npm install -g pnpm`)
- Python 3.11

### 1. Clone and configure environment
```bash
git clone https://github.com/Damiennsoh/afia-health-assistant-bw.git
cd afia-health-assistant-bw
cp .env.template .env   # Edit with your values
```

### 2. Start backend services
```bash
docker compose up -d
```
This starts: PostgreSQL, Redis, Qdrant, MinIO, and the FastAPI backend.

### 3. Create the first super admin
```bash
cd backend
python scripts/create_superadmin.py \
  --email admin@yourorg.com \
  --name "Admin" \
  --password "SecurePass123!"
```

### 4. Start the frontend
```bash
cd frontend
pnpm install
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) → Select **Ghana** → Select **AFIA Administration** → Login.

---

## 🌍 Production Deployment

| Service | Platform | Notes |
|---|---|---|
| **Frontend** | Vercel | Root Directory = `frontend`, auto-detects Next.js |
| **Backend** | Render.com | Docker deployment, free tier available |
| **Database** | Render PostgreSQL | Use Internal URL for same-region services |
| **Redis** | Render Redis | Internal URL `redis://...` |
| **Qdrant** | Qdrant Cloud | Free cluster available at cloud.qdrant.io |

See [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md) and [VERCEL_DEPLOYMENT_CHECKLIST.md](./VERCEL_DEPLOYMENT_CHECKLIST.md) for step-by-step instructions.

---

## 🔒 Security Architecture

```
┌──────────────┐     HTTPS      ┌─────────────────────┐
│   Vercel     │ ──────────────▶│   Render FastAPI     │
│  (Frontend)  │                │   (JWT + AES-256)    │
└──────────────┘                └──────────┬──────────┘
       │                                   │
       │ IndexedDB                    PostgreSQL
       │ (Local-first)                (Encrypted fields)
       │                                   │
       ▼                              Redis (Sessions)
 Offline Mode                         Qdrant (Vectors)
 (JWT cached)
```

- **JWT Authentication** with access + refresh token rotation
- **AES-256 field-level encryption** on sensitive patient fields
- **RBAC**: `super_admin` → `clinic_admin` → `healthworker` → `viewer`
- **Dual-key lockout**: Local lockout (IndexedDB) + backend lockout (Redis) prevents offline brute-force
- **CORS** locked to specific Vercel domain
- **Audit logs**: Append-only, device-fingerprinted, immutable
- **Super admin global access**: Super admins can manage all clinics without clinic assignment

---

## 🎯 Recent Improvements

### AI Clinical Assistant
- **Two-Stage Pipeline**: Clean vector search for protocol retrieval + contextual LLM reasoning for patient-specific recommendations
- **Enhanced Protocol Detection**: Improved GHS STG protocol matching for common conditions (malaria, ringworm, UTI, etc.)
- **Medical Term Mapping**: Comprehensive synonym mapping for better search accuracy
- **Increased Timeout**: Extended to 10 seconds for reliable clinical context retrieval

### Security & Access Control
- **Super Admin Global Login**: Super admins can now access the system without clinic assignment
- **TypeScript Interface Fixes**: Corrected login function signatures for type safety
- **Enhanced Lockout Mechanism**: Dual-key security prevents offline brute-force attacks

---

## 📄 License

Private — AFIA Health Systems. All rights reserved.
