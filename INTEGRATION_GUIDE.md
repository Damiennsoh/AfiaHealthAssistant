# AFIA Health Assistant: Firebase → Self-Hosted Migration Complete

## Overview
This guide documents the completed migration from Firebase to our new self-hosted backend with FastAPI, PostgreSQL, Qdrant, MinIO, Redis, and WebSocket support.

## Migration Status: ✅ COMPLETE

All Firebase dependencies have been removed from the frontend. The application now uses:
- **FastAPI Backend**: JWT-based authentication with token refresh
- **PostgreSQL**: Persistent data storage
- **Redis**: Rate limiting, caching, and session management
- **Qdrant**: Vector database for knowledge base
- **MinIO**: Object storage for files
- **WebSocket**: Real-time sync for multi-device updates

## What Was Done

### Backend Enhancements
- ✅ **WebSocket Support**: Real-time sync endpoint at `/api/v1/websocket/sync`
- ✅ **Offline Token Management**: 7-day offline tokens for rural clinics
- ✅ **Connection Manager**: Clinic and device-scoped WebSocket connections
- ✅ **Token Validation**: Direct token validation for WebSocket auth

### Frontend Migration
- ✅ **Auth Context**: Migrated to `AfiaAuthContext` using backend JWT
- ✅ **Login Flow**: Email/password login via backend API
- ✅ **Profile Management**: Updated to use backend user data
- ✅ **Sync Service**: Uses backend sync endpoints (already compatible)
- ✅ **Firebase Removal**: All Firebase contexts and dependencies removed
- ✅ **Legacy Auth Removal**: Removed local PIN-based auth system

### Cleanup
- ✅ **Removed Files**:
  - `contexts/FirebaseContext.tsx`
  - `contexts/AuthContext.tsx`
  - `components/DownstreamSync.tsx`
  - `lib/clinic-sync.ts`
  - `lib/clinic-auth.ts`
- ✅ **Package Dependencies**: Removed `firebase` and `firebase-admin`
- ✅ **Environment Variables**: Removed Firebase config, added backend API URL

## Setup Instructions

### 1. Start Backend Services

Navigate to the `backend` directory and start all services:

```bash
cd backend
docker-compose up -d
```

This starts:
- PostgreSQL (database)
- Redis (rate limiting, cache, sessions)
- Qdrant (vector database)
- MinIO (object storage)
- FastAPI (application server)

### 2. Create Super Admin Account

Wait for services to start (about 30 seconds), then:

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
python scripts/create_superadmin.py --email admin@clinic.org --name "Admin User" --password "SecurePassword123!"
```

### 3. Configure Frontend

Ensure `.env.local` contains:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000
GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_ENABLE_EMBEDDINGS=false
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Verify Backend Health

```bash
curl http://localhost:8000/api/v1/health
```

You should get a 200 OK response.

## Usage

### Authentication

```tsx
import { useAuth } from '@/contexts/AfiaAuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  // Login with email/password
  await login('user@clinic.org', 'password');
}
```

### API Calls

```tsx
import { afiaAPI } from '@/lib/afia-api';

async function fetchPatients() {
  const response = await afiaAPI.listPatients();
  if (response.data) {
    // Handle patients
  }
}
```

### Offline Sync

```tsx
import { syncService } from '@/lib/afia-sync';

// Queue changes when offline
syncService.queuePatientCreate({ name: 'John Doe', /* ... */ });

// Auto-sync when online
syncService.startAutoSync(30000);
```

### WebSocket Real-Time Sync

The backend automatically broadcasts data updates to all devices in the same clinic. No frontend changes needed - it's handled by the backend.

## Offline Token Support

For rural clinics with intermittent connectivity:

1. **Request Offline Token** (when online):
```bash
POST /api/v1/auth/request-offline
Authorization: Bearer <access_token>
```

2. **Validate Offline Token** (when offline):
```bash
POST /api/v1/auth/validate-offline
Body: { "token": "<offline_token>" }
```

Offline tokens are valid for 7 days and allow continued operation during outages.

## Security Notes

- All user accounts are admin-provisioned (no self-registration)
- JWT access tokens expire after 8 hours
- Refresh tokens expire after 30 days
- Offline tokens expire after 7 days
- Account locks after 5 failed login attempts (30 minutes)
- All passwords must be 12+ characters with complexity requirements

## Production Deployment

1. Set `ENVIRONMENT=production` in backend `.env`
2. Use strong, randomly generated secrets
3. Enable HTTPS with valid certificates
4. Configure proper CORS origins
5. Set up database backups
6. Monitor Redis connection health
7. Configure rate limiting appropriately

## Troubleshooting

### Login Fails
- Verify backend is running: `curl http://localhost:8000/api/v1/health`
- Check admin account was created
- Verify email/password are correct

### Sync Not Working
- Check network connectivity
- Verify device ID is generated
- Check browser console for sync errors
- Verify backend sync endpoint is accessible

### WebSocket Connection Fails
- Verify token is valid
- Check clinic and device IDs are set
- Verify WebSocket endpoint is accessible
- Check browser console for connection errors
