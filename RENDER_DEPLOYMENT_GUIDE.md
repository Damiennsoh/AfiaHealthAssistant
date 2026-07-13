# Render Deployment Guide for AFIA Health Assistant Backend

## Production Readiness Assessment

### ✅ Ready
- Health check endpoint working
- All services healthy locally
- Knowledge base imported (GH: 745 chunks, ZW: 384 chunks)
- Super admin created
- Environment configured for production
- Dockerfile optimized for production
- CORS origins configured

### ⚠️ Requires Configuration
- External services (PostgreSQL, Redis, Qdrant, MinIO)
- Database migrations
- Environment variables in Render dashboard
- SSL/TLS configuration (Render provides automatically)

## Render Deployment Steps

### 1. Create Render Account
- Sign up at [render.com](https://render.com)
- Connect your GitHub repository

### 2. Set Up External Services

#### PostgreSQL (Render Managed)
1. Go to Render Dashboard → New → PostgreSQL
2. Name: `afia-postgres`
3. Database: `afia_health`
4. User: `afia_admin`
5. Region: Choose closest to your users
6. Save connection details (DATABASE_URL)

#### Redis (Render Managed)
1. Go to Render Dashboard → New → Redis
2. Name: `afia-redis`
3. Region: Same as PostgreSQL
4. Save connection details (REDIS_URL)

#### Qdrant (Cloud)
- Use existing Qdrant cloud instance
- Or create new at [cloud.qdrant.io](https://cloud.qdrant.io)
- Save: QDRANT_URL, QDRANT_API_KEY

#### MinIO / S3 (Object Storage)
- Option 1: Use AWS S3
- Option 2: Use Render's object storage (if available)
- Save: MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD

### 3. Create Web Service

1. Go to Render Dashboard → New → Web Service
2. Connect repository: `Damiennsoh/afia-health-assistant-bw`
3. Branch: `deploy/primary`
4. Root Directory: `backend`
5. Runtime: Docker
6. Docker Context: `.`

### 4. Configure Environment Variables

Add these in Render Dashboard → Environment:

```bash
# Application
ENVIRONMENT=production
LOG_LEVEL=INFO

# Security
SECRET_KEY=<generate-strong-random-key>
FIELD_ENCRYPTION_KEY=<generate-strong-random-key>
ACCESS_TOKEN_EXPIRE_MINUTES=480
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database (from Render PostgreSQL)
DATABASE_URL=postgresql+asyncpg://afia_admin:<password>@<host>:5432/afia_health

# Redis (from Render Redis)
REDIS_URL=redis://:<password>@<host>:6379/0

# Qdrant (from Qdrant Cloud)
QDRANT_URL=https://<your-qdrant-url>
QDRANT_API_KEY=<your-qdrant-api-key>

# MinIO / S3
MINIO_ENDPOINT=<your-s3-endpoint>
MINIO_ROOT_USER=<your-access-key>
MINIO_ROOT_PASSWORD=<your-secret-key>
MINIO_SECURE=true

# API
API_PORT=8000
CORS_ORIGINS=https://app.afia.health,https://afia.health

# Admin (for initial setup)
ADMIN_EMAIL=admin@afia.health
ADMIN_NAME=admin
ADMIN_PASSWORD=<strong-password>
```

### 5. Deploy

1. Click "Create Web Service"
2. Render will build and deploy
3. Monitor logs in Render Dashboard

### 6. Post-Deployment Setup

#### Run Database Migrations
```bash
# SSH into Render web service or use Render Shell
cd /app
python -m alembic upgrade head
```

#### Create Super Admin
```bash
python scripts/create_superadmin.py \
  --email admin@afia.health \
  --name "Admin" \
  --password "<strong-password>"
```

#### Import Knowledge Base
```bash
python scripts/build_knowledge_index.py --country GH
python scripts/build_knowledge_index.py --country ZW
```

### 7. Verify Deployment

```bash
# Health check
curl https://<your-render-url>/api/v1/health

# Knowledge base check
curl https://<your-render-url>/api/v1/health/knowledge
```

## Frontend Deployment (Vercel)

1. Go to [vercel.com](https://vercel.com)
2. Import repository: `Damiennsoh/afia-health-assistant-bw`
3. Branch: `deploy/primary`
4. Root Directory: `frontend`
5. Environment Variables:
   ```bash
   NEXT_PUBLIC_API_URL=https://<your-render-url>
   GEMINI_API_KEY=<your-gemini-key>
   NEXT_PUBLIC_ENABLE_EMBEDDINGS=false
   ```
6. Deploy

## Cost Estimates (Render)

- PostgreSQL Free Tier: $0/month (limited)
- PostgreSQL Production: ~$7/month
- Redis Free Tier: $0/month (limited)
- Redis Production: ~$15/month
- Web Service: Free tier available, or ~$7/month for production
- Qdrant Cloud: Free tier available

**Total**: ~$0-30/month depending on tier

## Monitoring

- Render Dashboard: Logs, metrics, alerts
- Qdrant Cloud Dashboard: Vector search metrics
- Set up uptime monitoring (e.g., UptimeRobot)

## Security Notes

- Render provides automatic SSL/TLS
- Use strong, randomly generated secrets
- Enable Render's password protection during testing
- Set up proper CORS origins
- Enable rate limiting in production
- Regular database backups (Render handles this)
