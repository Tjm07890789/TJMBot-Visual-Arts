# TJMBot Visual Arts - Production Setup Guide

## 1. Database Setup (Neon Postgres)

### Option A: Using Neon CLI (if you have neonctl auth)
```bash
# Authenticate
neonctl auth

# Create project
neonctl projects create --name tjmbot-visual-arts

# Get connection string
neonctl connection-string --database-name neondb
```

### Option B: Using Neon Dashboard (Recommended)
1. Go to https://console.neon.tech
2. Sign up/login with GitHub
3. Click "New Project"
4. Name: `tjmbot-visual-arts`
5. Copy the connection string (looks like: `postgresql://user:pass@host.neon.tech/neondb?sslmode=require`)

## 2. Run Schema Migration

```bash
# Connect to your Neon database and run:
psql "YOUR_CONNECTION_STRING" -f db/schema.sql
```

Or copy-paste the SQL from `db/schema.sql` into the Neon SQL Editor.

## 3. Set Environment Variables in Vercel

```bash
cd /Users/tjmmacmini/.openclaw/workspace/TJMBot-Visual-Arts

# Database connection
echo "postgresql://user:pass@host.neon.tech/neondb?sslmode=require" | vercel env add DATABASE_URL production

# Vercel Blob token (for file storage)
# Get from: https://vercel.com/dashboard/stores/blob
echo "vercel_blob_token_here" | vercel env add BLOB_READ_WRITE_TOKEN production

# Replicate token (already set)
# echo "r8_..." | vercel env add REPLICATE_API_TOKEN production
```

## 4. Deploy

```bash
vercel --prod
```

## Files Changed

| File | Change |
|------|--------|
| `api/assets.ts` | Now uses Neon Postgres with connection pooling |
| `api/generate.ts` | Stores prediction ID in DB, triggers Replicate |
| `api/webhook.ts` | **NEW** - Receives Replicate callbacks, stores files in Vercel Blob |
| `db/schema.sql` | **NEW** - Database schema |
| `package.json` | Added `@neondatabase/serverless`, `@vercel/blob` |

## Architecture

```
Frontend (React)
    ↓
API Routes (Vercel)
    ↓
Neon Postgres (metadata: prompt, status, URLs)
    ↓
Vercel Blob (binary files: images, videos)
    ↓
Replicate (AI generation)
    ↓
Webhook callback → Updates DB + Blob
```

## Data Flow

1. User submits prompt → `POST /api/generate`
2. Asset record created in Postgres (status: 'generating')
3. Replicate prediction started
4. Replicate calls `POST /api/webhook` when done
5. Webhook downloads file → Vercel Blob
6. Webhook updates Postgres with blob_url (status: 'complete')
7. Frontend polls/fetches updated asset list

## Verification Steps

After deployment, verify:
1. Create asset → Returns ID
2. List assets → Shows new asset with 'generating' status
3. Wait for webhook (or check Replicate dashboard)
4. List assets again → Shows 'complete' status with blob_url
5. Refresh page → Asset still exists (persistence verified)
6. Check Vercel Blob dashboard → File exists

## Limitations & Notes

- **Cold start**: First request after idle may be slower (Neon connection pool)
- **Webhook reliability**: If webhook fails, asset stays 'generating' (can add polling fallback)
- **Blob cleanup**: Deleting assets doesn't delete blob files (can add cleanup later)
- **File size**: Vercel Blob has limits (check current tier)
