# 🏥 AFIA Health Assistant

> **A privacy-first, offline-capable clinical decision support system for rural healthcare facilities in Ghana and Zimbabwe.**

AFIA is a full-stack, multi-tenant SaaS platform designed to work in environments with unreliable internet connectivity. It combines an AI-powered RAG knowledge engine with GHS Standard Treatment Guidelines, a SOAP-note encounter system, a secure offline-first architecture, and a fully sandboxed **Guest Preview Mode** for recruiters and evaluators.

**Live Frontend:** [afia-health-assistant-bw-lilac.vercel.app](https://afia-health-assistant-bw-lilac.vercel.app)  
**Backend API:** [afia-health-assistant-backend.onrender.com](https://afia-health-assistant-backend.onrender.com)

---

## 📚 Documentation

- **[User Manual](./USER_MANUAL.md)** - Comprehensive guide for healthcare providers
- **[Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)** - Step-by-step production setup
- **[Render Deployment Guide](./RENDER_DEPLOYMENT_GUIDE.md)** - Render.com specific deployment
- **[Vercel Deployment Checklist](./VERCEL_DEPLOYMENT_CHECKLIST.md)** - Frontend deployment steps
- **[Integration Guide](./INTEGRATION_GUIDE.md)** - Migration and integration instructions
- **[Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md)** - Pre-deployment verification

---

## 📁 Repository Structure

```
afia-health-assistant-bw/
├── frontend/                        # Next.js 16 progressive web app
│   ├── app/                         # App Router pages (login, dashboard, encounters, etc.)
│   ├── components/                  # React UI components (encounters, patients, AI, etc.)
│   │   └── ui/GuestSandboxBanner.tsx  # Amber banner shown only during guest sessions
│   ├── contexts/                    # Auth, permissions, and sync contexts
│   │   ├── AfiaAuthContext.tsx      # JWT auth + guest DB routing
│   │   └── SyncContext.tsx         # Cloud sync (disabled for guest sessions)
│   ├── hooks/                       # Custom hooks (sync, permissions, knowledge base)
│   ├── lib/                         # API client, IndexedDB service, knowledge loader
│   │   ├── db.ts                    # IndexedDB layer (dynamically switches DB for guests)
│   │   └── guest-mode.ts           # Guest identity detection and DB-switcher utilities
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
| Local Database | **IndexedDB** (raw API, multi-instance) | Native |
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

### Infrastructure (Production)
| Service | Platform | Notes |
|---|---|---|
| **PostgreSQL** | **Neon** (serverless) | Pooled connection via `pgbouncer`; `sslmode=require` |
| **Redis** | Render Redis | Internal URL `redis://...` |
| **Qdrant** | Qdrant Cloud | Free cluster at cloud.qdrant.io |
| **Object Storage** | MinIO / S3-compatible | Documents and backups |

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
| 🧪 **Guest Preview Mode** | Fully sandboxed demo environment — test data stays local, never touches production |

---

## 🧪 Guest Preview Mode

Recruiters and evaluators can explore the full app without touching any production data.

**How to access:** Open the live URL → click **"Guest Preview Mode"** on the login page.

### How sandbox isolation works

```
Guest Login (guest@afia.health)
         │
         ▼
 activateGuestDB()          ← writes "afia-health-guest-db" to localStorage
         │
         ▼
  openDB() in db.ts         ← reads active DB name at call-time
         │
         ├── Guest → writes to  "afia-health-guest-db"  (isolated sandbox)
         └── Staff → writes to  "afia-health-db"        (production)
         │
         ▼
  syncToCloud() / auto-sync ← short-circuited for guests (no backend calls)
         │
         ▼
  Amber banner shown        ← "Guest Preview Mode — Sandbox Active"
```

| Behaviour | Guest | Real clinic staff |
|---|---|---|
| IndexedDB database | `afia-health-guest-db` | `afia-health-db` |
| Cloud sync | ❌ Disabled | ✅ Enabled |
| Data visible to admins | ❌ Never | ✅ Yes |
| Sandbox banner | ✅ Shown | ❌ Hidden |
| Data persists on refresh | ✅ (local only) | ✅ (synced) |

**Guest credentials:** `guest@afia.health` / `Guest1234!` *(provisioned by super admin)*

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js >= 20
- pnpm (`npm install -g pnpm`)
- Python 3.11

### 1. Clone and configure environment
```bash
git clone https://github.com/Damiennsoh/AfiaHealthAssistant.git
cd AfiaHealthAssistant
cp .env.template .env   # Edit with your values
```

### 2. Start backend services
```bash
docker compose up -d
```
This starts: PostgreSQL, Redis, Qdrant, MinIO, and the FastAPI backend.

### 3. Run database migrations
```bash
cd backend
python -m alembic upgrade head
```

### 4. Create the first super admin
```bash
python scripts/create_superadmin.py \
  --email admin@yourorg.com \
  --name "Admin" \
  --password "SecurePass123!"
```

### 5. Start the frontend
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
| **Database** | **Neon** (serverless PostgreSQL) | Use pooled connection string; `sslmode=require&channel_binding=require` |
| **Redis** | Render Redis | Internal URL `redis://...` |
| **Qdrant** | Qdrant Cloud | Free cluster available at cloud.qdrant.io |

> **After deploying to Render**, run migrations once via the Render shell:
> ```bash
> python -m alembic upgrade head
> ```

See [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md) and [VERCEL_DEPLOYMENT_CHECKLIST.md](./VERCEL_DEPLOYMENT_CHECKLIST.md) for step-by-step instructions.

---

## 🔒 Security Architecture

```
┌──────────────┐     HTTPS      ┌─────────────────────┐
│   Vercel     │ ──────────────▶│   Render FastAPI     │
│  (Frontend)  │                │   (JWT + AES-256)    │
└──────────────┘                └──────────┬──────────┘
       │                                   │
       │ IndexedDB (two instances)     Neon PostgreSQL
       │  ├─ afia-health-db             (Encrypted fields)
       │  └─ afia-health-guest-db            │
       │    (sandbox, sync disabled)    Redis (Sessions)
       │                                Qdrant (Vectors)
       ▼
 Offline Mode
 (JWT cached)
```

- **JWT Authentication** with access + refresh token rotation
- **AES-256 field-level encryption** on sensitive patient fields
- **RBAC**: `super_admin` → `clinic_admin` → `healthworker` → `viewer`
- **Dual-key lockout**: Local lockout (IndexedDB) + backend lockout (Redis) prevents offline brute-force
- **CORS** locked to specific Vercel domain
- **Audit logs**: Append-only, device-fingerprinted, immutable
- **Guest sandbox**: Completely isolated IndexedDB instance; cloud sync is hard-blocked for guest sessions
- **Super admin global access**: Super admins can manage all clinics without clinic assignment

---

## 🎯 Recent Improvements

### Guest Preview Mode (Sandbox Isolation)
- **Separate IndexedDB**: Guest sessions write to `afia-health-guest-db`; production data lives in `afia-health-db` — zero cross-contamination
- **Sync hard-blocked**: `syncToCloud()` and auto-sync are both short-circuited for guests; no guest data ever reaches the backend
- **DB routing via localStorage**: `openDB()` resolves the active DB name at call-time, so the switch is transparent to all other components
- **Amber sandbox banner**: A sticky, always-visible banner reminds guests they are in a safe demo environment
- **Session restore**: On page refresh, the correct DB (prod or sandbox) is re-activated before any component renders

### Production Database
- **Migrated to Neon** (serverless PostgreSQL): Reduced cold-start times; pooled connections via `pgbouncer`; `sslmode=require` enforced
- **Clinic provisioning flow**: Super admin login now shows a zero-clinics empty state with guidance rather than a generic error

### Auth & Login UX
- **Auto clinic resolution**: Backend auto-resolves `clinic_id` for non-admin users so login works without manual clinic selection
- **Guest Preview Mode branding**: Replaced "Recruiter & Guest Preview Mode" with the cleaner "Guest Preview Mode" label throughout
- **0-clinics empty state**: Instead of "Failed to fetch clinics", a helpful message guides super admins to provision their first clinic

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
