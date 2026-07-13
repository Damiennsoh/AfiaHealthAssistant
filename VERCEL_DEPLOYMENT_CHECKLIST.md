# Vercel Deployment Checklist - AFIA Health Assistant

## Pre-Deployment Verification ✓

### 1. Code Quality
- [x] TypeScript compilation passes
- [x] No build errors
- [x] ESLint configured
- [x] All imports resolve correctly
- [x] API routes properly implemented

### 2. Environment Variables
```
REQUIRED - Add to Vercel Project Settings:

☐ GEMINI_API_KEY 
  Location: Vercel Dashboard → Project Settings → Environment Variables
  Type: Sensitive
  Example: AQ.Ab8RN6IZua8JiqlKFRT89VLJTCx...

☐ AWS_S3_BUCKET
  Type: Standard
  Example: afia-health-uploads

☐ AWS_REGION
  Type: Standard
  Default: us-east-1
  Example: us-east-1

☐ NEXT_PUBLIC_API_URL
  Type: Standard
  Example: https://api.afia.health/api/v1
  Note: This is the backend API URL
```

### 3. Backend Configuration
- [ ] Backend API is running and accessible
- [ ] Clinic database is seeded with at least one clinic
- [ ] Authentication endpoints are working
- [ ] Knowledge base is loaded (GH/ZW protocols)
- [ ] S3 bucket credentials are correct

### 4. Vercel Project Setup

**Repository:** Damiennsoh/afia-health-assistant-bw

```
Vercel Dashboard Setup:
├─ Framework: Next.js 16
├─ Build Command: npm run build
├─ Output Directory: .next
├─ Install Command: npm install
├─ Node.js Version: 20+
└─ Root Directory: ./frontend
```

### 5. API Endpoints - Verification Table

| Endpoint | Backend Status | Vercel Route | Status |
|----------|---|---|---|
| Auth (login/logout) | `/api/v1/auth/*` | `/app/api/afia/route.ts` | ✓ |
| Patients (CRUD) | `/api/v1/patients/*` | Auto-connected via API client | ✓ |
| Encounters (CRUD) | `/api/v1/encounters/*` | Auto-connected via API client | ✓ |
| Knowledge Query | `/api/v1/knowledge/query` | Auto-connected via API client | ✓ |
| Sync/Offline | `/api/v1/sync/*` | Auto-connected via API client | ✓ |
| Clinics (Discovery) | `/api/v1/clinics/public/*` | Auto-connected via API client | ✓ |

---

## Deployment Steps

### Step 1: GitHub Connection
```
Vercel Dashboard → Import Project
→ Select: Damiennsoh/afia-health-assistant-bw
→ Authorize GitHub
→ Select: main branch (or your target branch)
```

### Step 2: Project Configuration
```
Root Directory: ./frontend
Framework: Next.js
Build Command: npm run build
```

### Step 3: Environment Variables
```
Add all required variables from "Pre-Deployment" section:

1. Copy GEMINI_API_KEY (mark as Sensitive)
2. Add AWS_S3_BUCKET
3. Add AWS_REGION
4. Add NEXT_PUBLIC_API_URL (your backend)
5. Click "Save"
```

### Step 4: Deploy
```
Click "Deploy" button
Monitor logs in real-time
Expected completion: 30-90 seconds
```

---

## Post-Deployment Verification

### 1. Access Application
```
https://your-deployment.vercel.app

Expected:
✓ Page loads without errors
✓ No 404 or 500 errors
✓ Analytics tracking working
```

### 2. Test Authentication Flow
```
1. Go to login page
2. Select clinic from dropdown
3. Enter demo credentials
4. Verify: "getCurrentUser()" returns user data
5. Verify: Tokens stored in localStorage
```

### 3. Test API Connectivity
```
1. Open DevTools → Network tab
2. Perform any action that calls backend
3. Verify: API requests complete with 200 status
4. Check: NEXT_PUBLIC_API_URL is correct in requests
```

### 4. Test Key Features
```
☐ Patient List loads
☐ Create new patient
☐ Create encounter (SOAP notes)
☐ Query knowledge base
☐ Offline sync indicator working
☐ File uploads to S3
☐ Logout clears tokens
```

### 5. Check Error Handling
```
☐ Invalid token → redirects to login
☐ Network error → user-friendly message
☐ Missing env var → clear error in console
☐ GEMINI timeout → retry logic activates
```

---

## Troubleshooting Guide

### Build Fails: "Cannot find module"
```
Cause: Missing environment variable
Solution:
1. Check .env.development.local is NOT committed
2. Verify all REQUIRED vars in Vercel settings
3. Restart deployment
```

### 401 Unauthorized Errors
```
Cause: Backend auth endpoint not accessible
Solution:
1. Verify NEXT_PUBLIC_API_URL points to correct backend
2. Ensure backend CORS allows Vercel domain
3. Check backend is running in production
```

### S3 Upload Fails
```
Cause: Missing AWS credentials or bucket
Solution:
1. Verify AWS_S3_BUCKET is set
2. Confirm bucket exists and is accessible
3. Check AWS credentials (if using keys)
```

### GEMINI_API_KEY Error
```
Cause: Key not set or invalid
Solution:
1. Regenerate key from Google AI Studio
2. Update in Vercel project settings (mark Sensitive)
3. Trigger redeployment
```

### Pages Not Found (404)
```
Cause: Wrong root directory
Solution:
1. Verify Root Directory is set to ./frontend
2. Check next.config.mjs exists at project root
3. Rebuild deployment
```

---

## Monitoring & Logs

### Vercel Dashboard Monitoring
```
1. Deployments tab → View build logs
2. Analytics tab → Track Core Web Vitals
3. Logs tab → Real-time request/error logs
4. Functions tab → Monitor API route performance
```

### Recommended Monitoring Tools
```
Optional Integrations:
• Sentry → Error tracking
• LogRocket → Session replay
• Vercel Analytics → Performance tracking
• Speedlify → Lighthouse tracking
```

---

## Environment Variables Quick Reference

### Development (Local)
```bash
# frontend/.env.development.local
GEMINI_API_KEY=your_local_key
NEXT_PUBLIC_API_URL=http://localhost:8000
AWS_S3_BUCKET=afia-dev
AWS_REGION=us-east-1
```

### Production (Vercel)
```
Vercel Project Settings → Environment Variables

GEMINI_API_KEY           [Sensitive] 
NEXT_PUBLIC_API_URL      https://api.afia.health
AWS_S3_BUCKET            afia-prod
AWS_REGION               us-east-1
```

---

## Important Notes

### Security
- ✓ Never commit `.env.local` to Git
- ✓ Mark sensitive keys as "Sensitive" in Vercel
- ✓ Security headers configured in Next.js
- ✓ CORS configured at backend level

### Performance
- ✓ Static pages: 23/23 pre-rendered
- ✓ API routes: On-demand
- ✓ Caching: SWR + browser caching
- ✓ CDN: Vercel global network

### Scalability
- ✓ Serverless functions (auto-scaling)
- ✓ No server management needed
- ✓ Auto-scaling based on traffic
- ✓ Bandwidth limits: Based on plan

---

## Deployment Success Criteria

Deploy is successful when:
```
☐ Build completes without errors
☐ Page loads at https://your-deployment.vercel.app
☐ Login page accessible
☐ Authentication works with backend
☐ Patient/encounter CRUD operations work
☐ AI assistant responds to queries
☐ No console errors in DevTools
☐ Analytics tracking active
☐ Offline features functional
```

---

## Roll-Back Instructions

If deployment has issues:
```
Vercel Dashboard → Deployments
→ Select previous working deployment
→ Click "Promote to Production"

This reverts to previous version within seconds.
```

---

## Support & Documentation

### Useful Links
- Next.js 16 Docs: https://nextjs.org/docs
- Vercel Docs: https://vercel.com/docs
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
- Google Gemini API: https://aistudio.google.com

### Backend Integration
- Backend API Docs: [Your backend documentation URL]
- API Base URL: Set via `NEXT_PUBLIC_API_URL`
- Country Support: GH (Ghana), ZW (Zimbabwe)

---

**Last Updated:** January 8, 2026  
**Status:** ✅ Ready for Deployment
