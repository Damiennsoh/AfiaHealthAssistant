# AFIA Health Assistant — Backend API

**FastAPI + PostgreSQL + Redis + Qdrant** — Self-hosted backend for the AFIA Health Assistant multi-tenant SaaS platform.

**Live API:** [afia-health-assistant-backend.onrender.com](https://afia-health-assistant-backend.onrender.com)  
**API Docs:** Available at `/api/docs` (only when `DEBUG=true`)

---

## ⚡ Quick Start (Local Dev via Docker)

```bash
# From the project root
cp .env.template .env     # Fill in your values
docker compose up -d      # Start PostgreSQL, Redis, Qdrant, MinIO + this backend

# Create the first super admin
cd backend
python scripts/create_superadmin.py \
  --email admin@yourorg.com \
  --name "Admin" \
  --password "SecurePass123!"
```

The API will be available at [http://localhost:8000](http://localhost:8000).

---

## 🗂️ Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── deps.py                  # FastAPI dependency injection (auth guards)
│   │   └── v1/
│   │       ├── auth.py              # /api/v1/auth — Login, logout, refresh, me
│   │       ├── clinics.py           # /api/v1/clinics — Public discovery + admin CRUD
│   │       ├── users.py             # /api/v1/users — Admin-provisioned user management
│   │       ├── patients.py          # /api/v1/patients — Patient CRUD + search
│   │       ├── encounters.py        # /api/v1/encounters — SOAP notes and clinical records
│   │       ├── knowledge.py         # /api/v1/knowledge — RAG knowledge base queries
│   │       ├── sync.py              # /api/v1/sync — Offline delta sync push/pull
│   │       ├── health.py            # /api/v1/health — Health check
│   │       └── websocket.py         # /api/v1/websocket — Real-time updates
│   │
│   ├── core/
│   │   ├── config.py                # Pydantic settings (env vars, CORS, limits)
│   │   ├── security.py              # JWT encode/decode, bcrypt hashing, AES-256 encryption
│   │   ├── logging.py               # Structured logging (structlog)
│   │   └── exceptions.py            # Custom exception classes
│   │
│   ├── db/
│   │   └── session.py               # SQLAlchemy async engine, session factory, init_db()
│   │
│   ├── models/
│   │   ├── user.py                  # User ORM (roles: super_admin, clinic_admin, healthworker, viewer)
│   │   ├── clinic.py                # Clinic ORM (multi-tenant, subscription tiers)
│   │   ├── patient.py               # Patient ORM (AES-256 encrypted fields)
│   │   └── encounter.py             # Encounter ORM (SOAP notes, vitals, prescriptions)
│   │
│   ├── schemas/
│   │   ├── user.py                  # Pydantic request/response models for users
│   │   ├── clinic.py                # Pydantic models for clinics (incl. PublicClinicResponse)
│   │   ├── patient.py               # Pydantic models for patients
│   │   └── encounter.py             # Pydantic models for SOAP note encounters
│   │
│   ├── services/
│   │   ├── auth_service.py          # Login logic, token generation, password reset
│   │   ├── user_service.py          # User CRUD, provisioning
│   │   └── patient_service.py       # Patient CRUD, search, deduplication
│   │
│   └── main.py                      # FastAPI app entry point, middleware, route mounting
│
├── scripts/
│   └── create_superadmin.py         # One-time setup: creates initial admin clinic + user
│
├── static/                          # Served at /static — knowledge base JSON files
├── tests/                           # pytest + pytest-asyncio test suite
├── Dockerfile                       # Production Docker image (python:3.11-slim)
├── alembic.ini                      # Database migration configuration
└── requirements.txt                 # Python dependencies
```

---

## 🔌 API Reference

### Authentication — `/api/v1/auth`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/login` | Public | Login with email, password, clinic_id |
| `POST` | `/refresh` | Public | Exchange refresh token for new access token |
| `POST` | `/logout` | Auth | Invalidate session |
| `GET` | `/me` | Auth | Get current user profile |
| `POST` | `/change-password` | Auth | Change own password |

### Clinics — `/api/v1/clinics`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/public` | **Public** | List active clinics (for login dropdown). Filtered by `country_code` |
| `GET` | `/public/{clinic_code}` | **Public** | Get single clinic by code |
| `GET` | `/` | Super Admin | List all clinics |
| `POST` | `/` | Super Admin | Create clinic + initial admin user |
| `GET` | `/{clinic_id}` | Auth | Get clinic details |
| `PUT` | `/{clinic_id}` | Clinic Admin | Update clinic settings |

### Users — `/api/v1/users`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Clinic Admin | List users in clinic |
| `POST` | `/` | Clinic Admin | Provision new user (no self-registration) |
| `GET` | `/{user_id}` | Clinic Admin | Get user profile |
| `PUT` | `/{user_id}` | Auth | Update user |
| `DELETE` | `/{user_id}` | Clinic Admin | Soft-delete user with compliance reason |
| `POST` | `/{user_id}/reset-password` | Clinic Admin | Admin-reset user password |

### Patients — `/api/v1/patients`
### Encounters — `/api/v1/encounters`
### Knowledge — `/api/v1/knowledge`
### Sync — `/api/v1/sync`

> See `/api/docs` (with `DEBUG=true`) for full Swagger documentation.

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection URL (`postgresql+asyncpg://user:pass@host/db`) |
| `REDIS_URL` | ✅ | Redis connection URL (`redis://host:6379`) |
| `SECRET_KEY` | ✅ | JWT signing secret (use a long random string) |
| `FIELD_ENCRYPTION_KEY` | ✅ | AES-256 key for encrypting patient fields |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins (no trailing slash!) |
| `QDRANT_URL` | ✅ | Qdrant vector DB URL |
| `QDRANT_API_KEY` | ⚠️ | Required in production (Qdrant Cloud) |
| `MINIO_ENDPOINT` | ⚠️ | Object storage endpoint |
| `MINIO_ROOT_USER` | ⚠️ | MinIO access key |
| `MINIO_ROOT_PASSWORD` | ⚠️ | MinIO secret key |
| `ENVIRONMENT` | — | `development` / `staging` / `production` |
| `DEBUG` | — | `true` enables Swagger docs at `/api/docs` |
| `ADMIN_EMAIL` | — | Used during initial `create_superadmin.py` setup |

---

## 🏗️ Architecture

### Multi-Tenancy

Every resource (patient, encounter, user) belongs to a `clinic_id`. The FastAPI dependency injection layer enforces this:
- `require_clinic_admin` — user must be `clinic_admin` or `super_admin`
- `require_super_admin` — only `super_admin` role
- `get_current_active_user` — any authenticated user in their own clinic

A `super_admin` can see all clinics and all data. A `clinic_admin` can only see their own clinic's data.

### Security Architecture

```
Client (Browser)
   │
   │ HTTPS + JWT Bearer Token
   ▼
FastAPI (Rate Limited: 100 req/60s via Redis)
   │
   ├── JWT decode + expiry check (python-jose)
   ├── Role validation (RBAC via deps.py)
   │
   ▼
Business Logic (services/)
   │
   ├── AES-256 field encryption before DB write
   │
   ▼
PostgreSQL (asyncpg + SQLAlchemy async)
```

- **Tokens**: Access token (8h) + Refresh token (7 days)
- **Passwords**: bcrypt with salt rounds
- **Patient fields**: AES-256 encrypted at rest (PII fields)
- **Rate limiting**: Redis-backed per-IP counter (100 req / 60s window)
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, HSTS (production), CSP

### Database

PostgreSQL 16 with SQLAlchemy async ORM. Migrations managed via Alembic.

```
alembic upgrade head     # Apply all migrations
alembic revision --autogenerate -m "description"    # Generate new migration
```

### Knowledge Base (RAG)

The Qdrant vector database stores pre-embedded medical protocol chunks from:
- **Ghana Standard Treatment Guidelines 2017** (GHS STG)
- **NHIS Essential Medicines List 2025**
- **Zimbabwe EDLIZ 2020**

Embeddings are generated using `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).

---

## 🚀 Production Deployment (Render.com)

1. **Render Web Service** — connect GitHub repo, set **Root Directory** = `backend`
2. **Environment** — Render auto-detects Dockerfile
3. **Set all required environment variables** in Render Dashboard → Environment tab
4. **PostgreSQL** — Use **Internal URL** (same region, faster, no bandwidth cost)
5. **Redis** — Use **Internal URL** (`redis://red-xxx:6379`)

> ⚠️ The Render free tier does not include Shell access. To run `create_superadmin.py`, connect to the Render PostgreSQL **External URL** from your local machine with `DATABASE_URL` overridden in your shell:
>
> ```powershell
> $env:DATABASE_URL="postgresql+asyncpg://user:pass@host.oregon-postgres.render.com/db"
> python scripts/create_superadmin.py --email admin@x.com --name "Admin" --password "Pass123!"
> ```

---

## 🧪 Testing

```bash
cd backend
pytest tests/ -v
pytest tests/ -v --asyncio-mode=auto     # For async tests
```

---

## 📄 License

Private — AFIA Health Systems. All rights reserved.
