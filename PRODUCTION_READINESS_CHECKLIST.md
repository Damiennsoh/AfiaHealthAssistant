# AFIA Health Assistant - Production Readiness Checklist

Use this checklist to ensure your deployment is production-ready:

## Pre-Deployment
- [ ] All environment variables have been updated with secure, non-placeholder values
  - [ ] `SECRET_KEY` (32-byte random string)
  - [ ] `FIELD_ENCRYPTION_KEY` (another 32-byte random string)
  - [ ] `POSTGRES_PASSWORD`
  - [ ] `REDIS_PASSWORD`
  - [ ] `QDRANT_API_KEY`
  - [ ] `MINIO_ROOT_PASSWORD`
  - [ ] `CORS_ORIGINS` (only your actual domains)
- [ ] `.env` file is **not** committed to Git (it's in .gitignore)
- [ ] Docker Compose config is ready
- [ ] SSL certificates are obtained (if using HTTPS)

## Deployment
- [ ] All Docker containers are running and healthy (`docker-compose ps`)
- [ ] Database migrations have been run (`alembic upgrade head`)
- [ ] Knowledge bases have been imported into Qdrant
- [ ] Super admin account has been created
- [ ] Health check endpoint returns "healthy" for all services

## Post-Deployment
- [ ] HTTPS is enabled and working
- [ ] Backups are configured and tested
- [ ] Logging is set up
- [ ] Monitoring is in place
- [ ] All features are tested in production environment
