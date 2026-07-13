# AFIA Health Assistant — Frontend

**Next.js 16 Progressive Web Application** for offline-capable clinical decision support in rural healthcare facilities.

**Live:** [afia-health-assistant-bw-lilac.vercel.app](https://afia-health-assistant-bw-lilac.vercel.app)  
**Backend API:** [afia-health-assistant-backend.onrender.com](https://afia-health-assistant-backend.onrender.com)

---

## ⚡ Quick Start

```bash
pnpm install
cp .env.example .env.local   # Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_GEMINI_API_KEY
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 🗂️ Directory Structure

```
frontend/
├── app/                        # Next.js App Router pages
│   ├── (auth)/                 # Login page (country → clinic → credentials flow)
│   ├── dashboard/              # Main clinical dashboard
│   ├── patients/               # Patient list and profile pages
│   ├── encounters/             # Encounter list, detail, and new encounter forms
│   ├── settings/               # User and clinic management
│   └── api/                    # Next.js API routes (AI assistant proxy, sync routes)
│
├── components/                 # React UI components
│   ├── auth/                   # Login, create account, forgot password forms
│   ├── health/                 # Clinical: PatientEncounterForm, DrugAdministration, ReferralNote
│   ├── ui/                     # Radix UI primitives (button, card, dialog, etc.)
│   ├── AfiaAssistant.tsx        # Encounter-scoped AI clinical hub
│   ├── afia-chat.tsx           # Multi-turn conversational AI assistant
│   ├── encounter-list.tsx      # Filterable encounter list with region/community filters
│   ├── knowledge-admin.tsx     # Knowledge base management UI
│   └── clinical-response-renderer.tsx  # Structured AI response cards
│
├── contexts/
│   ├── AfiaAuthContext.tsx     # JWT auth context (login, logout, permissions, offline token reuse)
│   └── AuthContext.tsx         # Compatibility shim → re-exports AfiaAuthContext
│
├── hooks/
│   ├── use-firestore-sync.ts   # Real-time cloud ↔ local sync listener
│   ├── usePermissions.ts       # RBAC permission checks
│   └── use-knowledge-base.ts   # RAG hook for medical knowledge queries
│
├── lib/
│   ├── afia-api.ts             # REST API client with JWT, retry, and backoff
│   ├── db.ts                   # IndexedDB wrapper (patients, encounters, insights)
│   ├── knowledge-loader.ts     # Loads precomputed embeddings → AfiaKnowledgeDB
│   ├── knowledge-search-service.ts  # Singleton managing the search Web Worker
│   ├── security-service.ts     # Dual-key offline lockout logic
│   └── vector-engine-browser.ts    # In-browser cosine similarity for offline search
│
├── workers/
│   └── search.worker.ts        # Dedicated Web Worker: IndexedDB read + hybrid search
│
├── public/
│   ├── data/
│   │   └── complete-knowledge-base.json  # ~29MB pre-computed GHS + NHIS embeddings
│   ├── sw.js                   # Service Worker for offline asset caching
│   └── manifest.json           # PWA manifest
│
├── docs/                       # Detailed architecture documentation (see below)
└── scripts/                    # Build-time scripts (knowledge base precomputation)
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API base URL (e.g. `https://afia-health-assistant-backend.onrender.com`) |
| `NEXT_PUBLIC_GEMINI_API_KEY` | ✅ | Google Gemini API key for the AI assistant |
| `NEXT_PUBLIC_FIREBASE_*` | ⚠️ Optional | Firebase config (only needed if cloud sync is enabled) |

---

## 🏗️ Architecture

### 1. Authentication Flow

The login is a **3-step wizard**:
1. **Country** — selects GH (Ghana) or ZW (Zimbabwe), determines knowledge base
2. **Clinic** — queries `/api/v1/clinics/public?country_code=GH`, populates dropdown
3. **Credentials** — email + password → POST `/api/v1/auth/login` → JWT stored in `localStorage`

**Offline Login**: When the device is offline and a valid JWT already exists in `localStorage`, `AfiaAuthContext` skips backend validation and restores the session from the local token. This ensures clinical staff are never locked out by a connectivity failure.

```typescript
// AfiaAuthContext.tsx — offline token reuse
if (!navigator.onLine) {
  setIsLoading(false);
  // JWT present → treat as authenticated
  return;
}
```

> ⚠️ **Offline Auth Gap**: The current implementation only prevents full lockout — it does not fully re-hydrate user profile from IndexedDB. See the **Offline Auth Enhancement** section below for the planned upgrade.

### 2. Offline-First Data Flow

```
User Action
    │
    ▼
Local IndexedDB (afia-health-db)     ← Primary write target, always fast
    │
    ▼ (background, when online)
REST API → PostgreSQL backend        ← Delta sync via /api/v1/sync/push
    │
    ▼ (real-time, when online)
Firestore listeners → other devices  ← Team collaboration
```

All data (patients, encounters, AI insights) is written to IndexedDB first. The backend sync engine (`/api/v1/sync/push`) handles conflict resolution using a **"newer timestamp wins"** strategy:

- If `cloud.updatedAt > local.updatedAt` → update local
- If `local.updatedAt >= cloud.updatedAt` → ignore incoming change (protect local work)
- If record missing locally → create it

This means a nurse on Tablet A and a doctor on Tablet B can both update the same patient record offline. When they reconnect, the most recently modified version wins, preventing silent overwrites.

### 3. AI / RAG Architecture

```
Clinical Query (e.g. "malaria in children")
    │
    ▼
KnowledgeSearchService (singleton)
    │
    ▼ postMessage()
search.worker.ts (Web Worker)        ← Runs off main thread, no UI blocking
    │
    ├── Keyword Scoring (GHS section titles, drug names)
    └── Vector Cosine Similarity (pre-embedded chunks in IndexedDB)
    │
    ▼ Hybrid Score = (0.7 × vector) + (0.3 × keyword)
Top-N relevant protocol chunks (>0.25 threshold)
    │
    ▼
Gemini AI (Google Generative AI)     ← Chunks injected as context
    │
    ▼
Structured Clinical Response (Diagnosis / Treatment / Prescription / Danger Signs)
```

The full knowledge base (~10,000 chunks from GHS STG 2017 + NHIS EML 2025) is pre-computed and shipped as a 29MB JSON in `public/data/`. On first login, it is loaded into `AfiaKnowledgeDB` (IndexedDB) and from then on the search Web Worker keeps everything in RAM for sub-50ms retrieval — even with **zero internet**.

### 4. Security: Dual-Key Lockout

| Layer | Storage | Behaviour |
|---|---|---|
| **Local** | IndexedDB (`security_lockout` store) | Blocks UI after 5 failed attempts for 15 minutes |
| **Remote** | Redis / backend endpoint | Syncs lockout state to server when online |
| **Device** | Browser fingerprint | Lockout is device-specific; switching tablets starts a fresh counter |

See [docs/OFFLINE_LOCKOUT_SECURITY.md](docs/OFFLINE_LOCKOUT_SECURITY.md) for full threat model and scenarios.

---

## 📶 Offline Auth Enhancement (Planned / In Progress)

To fully support staff working offline from first launch, the planned implementation will:

1. **Cache user profiles in IndexedDB** at login time (encrypted with bcrypt-derived key)
2. **Validate credential hash offline** during token expiry using stored `hashed_password` (salted, never plaintext)
3. **Sync users from backend** at the `/api/v1/users` endpoint after every successful online login
4. **Rehydrate full session** (role, clinic_id, permissions) from IndexedDB when `navigator.onLine === false`

This means a nurse who has logged in at least once online can authenticate and access the application during extended outages without any degraded experience.

---

## 🧪 Testing

```bash
pnpm test          # Vitest unit tests
pnpm e2e           # Playwright end-to-end tests
pnpm lint          # ESLint
```

---

## 🚀 Build & Deploy (Vercel)

1. Push to `main` branch → Vercel auto-deploys
2. Vercel Project Settings → **Root Directory** = `frontend`
3. Add environment variables in Vercel Dashboard
4. Enable **Vercel Web Analytics** (or remove `<Analytics />` from `app/layout.tsx`)

---

## 📚 Documentation

| Document | Description |
|---|---|
| [docs/README.md](docs/README.md) | Full technical documentation index |
| [docs/AI_SEARCH_ARCHITECTURE.md](docs/AI_SEARCH_ARCHITECTURE.md) | Web Worker + RAG search pipeline |
| [docs/FIREBASE_CLOUDSYNC.md](docs/FIREBASE_CLOUDSYNC.md) | Hybrid sync architecture and conflict resolution |
| [docs/OFFLINE_LOCKOUT_SECURITY.md](docs/OFFLINE_LOCKOUT_SECURITY.md) | Dual-key security and brute-force protection |
| [docs/knowledge-admin-architecture.md](docs/knowledge-admin-architecture.md) | Knowledge base management and indexing |
| [docs/backup-implementation.md](docs/backup-implementation.md) | Backup and restore procedures |
| [AUTH_ARCHITECTURE.md](AUTH_ARCHITECTURE.md) | JWT auth flow and RBAC design |
