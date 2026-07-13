# AFIA Health Assistant - Production Deployment Guide

## Prerequisites
- Docker & Docker Compose
- Domain name (for HTTPS)
- SSL certificates (Let's Encrypt recommended)
- S3-compatible storage (optional, for backups)

---

## Step 1: Generate Secure Environment Variables

First, generate secure secrets:
```bash
# Generate SECRET_KEY (32 bytes)
openssl rand -hex 32

# Generate FIELD_ENCRYPTION_KEY (another 32 bytes, different from above)
openssl rand -hex 32

# Generate strong passwords
# Use a password manager or openssl
openssl rand -base64 16
```

Update your `.env` file with these values:
```env
# Application
ENVIRONMENT=production
LOG_LEVEL=INFO

# Security (REPLACE THESE!)
SECRET_KEY=your_generated_32_byte_secret_key_here
FIELD_ENCRYPTION_KEY=your_generated_32_byte_field_encryption_key_here

# PostgreSQL
POSTGRES_USER=afia_admin
POSTGRES_PASSWORD=your_strong_postgres_password_here
POSTGRES_DB=afia_health
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=your_strong_redis_password_here
REDIS_PORT=6379

# Qdrant
QDRANT_API_KEY=your_strong_qdrant_api_key_here
QDRANT_PORT=6333

# MinIO
MINIO_ROOT_USER=afia_minio
MINIO_ROOT_PASSWORD=your_strong_minio_password_here
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001

# API
API_PORT=8000
ACCESS_TOKEN_EXPIRE_MINUTES=480
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS (REPLACE WITH YOUR ACTUAL DOMAINS!)
CORS_ORIGINS=https://your-clinic-domain.com,https://admin.your-clinic-domain.com
```

---

## Step 2: Start Docker Services

```bash
# Start all services
docker-compose up -d

# Wait for services to be healthy (check with)
docker-compose ps
```

---

## Step 3: Run Database Migrations

```bash
# Enter the API container
docker-compose exec api bash

# Run Alembic migrations
alembic upgrade head

# Exit container
exit
```

---

## Step 4: Import Knowledge Bases into Qdrant

```bash
# Enter the API container
docker-compose exec api bash

# Import Ghana knowledge base
python scripts/import_embeddings.py --country GH

# Import Zimbabwe knowledge base
python scripts/import_embeddings.py --country ZW

# Exit container
exit
```

---

## Step 5: Create Initial Super Admin

```bash
# Enter the API container
docker-compose exec api bash

# Create super admin (REPLACE EMAIL/PASSWORD!)
python scripts/create_superadmin.py \
  --email admin@your-clinic-domain.com \
  --name "Super Admin" \
  --password "YourSuperSecurePassword123!"

# Optional: Create Zimbabwe test clinic
python scripts/create-zimbabwe-clinic.py

# Exit container
exit
```

---

## Step 6: Configure HTTPS (Optional but Recommended)

Uncomment the Nginx service in `docker-compose.yml`:
```yaml
  nginx:
    image: nginx:alpine
    container_name: afia_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    networks:
      - afia_network
```

Create Nginx config and add SSL certificates.

---

## Step 7: Verify Health Check

Visit `https://your-domain.com/api/v1/health` to verify all services are healthy.

---

## Maintenance & Backups

### Daily Backups
The backup service is configured to run daily at 2 AM. To configure off-site backups, update these in `.env`:
```env
BACKUP_S3_BUCKET=your-backup-bucket
BACKUP_AWS_KEY=your-aws-access-key
BACKUP_AWS_SECRET=your-aws-secret-key
BACKUP_S3_ENDPOINT=https://s3.your-region.amazonaws.com
```

### Restore from Backup
```bash
# List available backups
ls backups/

# Restore (follow Docker volume backup/restore procedures)
```

---

## How to Get Qdrant API Key

For self-hosted Qdrant (which you are using):
1. The API key is set in your `.env` file as `QDRANT_API_KEY`
2. You set this key yourself (generate a strong one!)
3. To access the Qdrant dashboard, go to `http://your-server-ip:6333/dashboard` and enter your API key

For Qdrant Cloud (if you decide to use it instead):
1. Sign up at [https://cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a cluster
3. Get your API key from the cluster settings
4. Update `QDRANT_URL` and `QDRANT_API_KEY` in your `.env`
