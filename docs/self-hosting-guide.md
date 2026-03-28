# Self-Hosting Guide: Team Leaderboard

Deploy a private tokscale leaderboard for your team using Vercel + Supabase.

---

## Architecture

```
Team PC                         Vercel                    Supabase
┌──────────────┐          ┌──────────────────┐     ┌──────────────┐
│ tokscale CLI │──submit──▶│ Next.js Frontend │────▶│  PostgreSQL  │
│              │          │ (API + UI)       │     │              │
│ TOKSCALE_API │          │                  │◀────│              │
│ _URL env var │          └──────────────────┘     └──────────────┘
└──────────────┘                 │
                                 │ OAuth
                                 ▼
                          ┌──────────────┐
                          │ GitHub OAuth  │
                          │ Google OAuth  │
                          └──────────────┘
```

---

## Prerequisites

- GitHub account
- Vercel account (https://vercel.com — Hobby plan is free)
- Supabase account (https://supabase.com — Free plan available)

---

## Step 1: Create a Supabase Project

1. Go to https://supabase.com/dashboard and click **New Project**
2. Configure:
   - **Name**: `tokscale-team` (or any name)
   - **Database Password**: set a strong password (save it)
   - **Region**: choose one close to your team (e.g., `Northeast Asia (Tokyo)`)
3. After creation, find the **Connection URI**:
   - Supabase Dashboard → sidebar **Connect** (plug icon)
   - Or go to **Project Settings → Database → Connection string**
   - Select the **Connection Pooler** tab → set **Mode** to `Transaction`
   - Copy the URI from the **URI** tab:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```
   - Verify the port is `6543` (Pooler), not `5432` (Direct)

> **Important**: Replace `[YOUR-PASSWORD]` with your actual database password.

### Why Transaction Mode Pooler?

Vercel Serverless functions can open a new connection per request. Using Direct connections (`5432`) quickly exceeds Supabase Free plan limits. Transaction Mode Pooler (`6543`) reuses connections to prevent this.

---

## Step 2: OAuth Setup (GitHub + Google)

Login supports GitHub and Google Workspace, either one or both. Accounts with the same verified email are automatically linked.

### 2-1. GitHub OAuth App

1. Go to https://github.com/settings/developers → **OAuth Apps → New OAuth App**
2. Configure:
   - **Application name**: `Tokscale Team Leaderboard`
   - **Homepage URL**: `https://your-project.vercel.app` (can update later)
   - **Authorization callback URL**: `https://your-project.vercel.app/api/auth/github/callback`
3. Copy **Client ID** and **Client Secret**

### 2-2. Google OAuth (Optional)

1. Go to https://console.cloud.google.com → **APIs & Services → Credentials**
2. **Create Credentials → OAuth 2.0 Client ID** (Web application)
3. **Authorized redirect URI**: `https://your-project.vercel.app/api/auth/google/callback`
4. Copy **Client ID** and **Client Secret**
5. **OAuth consent screen**: set to `Internal` for Workspace-only access

> Update callback URLs after your Vercel domain is finalized.

---

## Step 3: Deploy to Vercel

### 3-1. Fork or Create a Private Repo

Fork the tokscale repo to your team's GitHub org, or extract only the frontend.

**Option A — Full repo fork (simple)**:
```bash
git clone https://github.com/your-org/tokscale.git
```

**Option B — Frontend only (lightweight)**:
```bash
mkdir tokscale-leaderboard && cd tokscale-leaderboard
cp -r /path/to/tokscale/packages/frontend/* .
git init && git add . && git commit -m "init: tokscale team leaderboard"
# Create a new repo on GitHub and push
```

### 3-2. Vercel Project Settings

1. Go to https://vercel.com/new and **Import Git Repository**
2. Select the repo from above

3. **Build & Development Settings**:

   | Setting | Option A (full repo) | Option B (frontend only) |
   |---------|---------------------|--------------------------|
   | **Framework Preset** | Next.js | Next.js |
   | **Root Directory** | `packages/frontend` | `.` (default) |
   | **Build Command** | (default) | (default) |

4. **Environment Variables**:

   | Key | Value | Notes |
   |-----|-------|-------|
   | `DATABASE_URL` | `postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres` | Supabase Pooler URI |
   | `GITHUB_CLIENT_ID` | Client ID from Step 2-1 | |
   | `GITHUB_CLIENT_SECRET` | Client Secret from Step 2-1 | |
   | `GITHUB_ALLOWED_ORG` | `your-org-name` | Optional: restrict to GitHub org members |
   | `GOOGLE_CLIENT_ID` | Client ID from Step 2-2 | Optional: for Google login |
   | `GOOGLE_CLIENT_SECRET` | Client Secret from Step 2-2 | Optional: for Google login |
   | `GOOGLE_ALLOWED_DOMAIN` | `your-company.com` | Optional: restrict to Workspace domain |
   | `NEXT_PUBLIC_URL` | `https://your-project.vercel.app` | Update after deploy |
   | `AUTH_SECRET` | Random string (32+ chars) | Generate with `openssl rand -hex 32` |

5. **Do not click Deploy yet!** — You need to create DB tables first.

### 3-3. Run DB Migration (Required Before First Deploy!)

> **Must be done before deploying to Vercel.** Next.js prerenders static pages during build, which queries the DB. Without tables, the build fails with `relation "submissions" does not exist`.

Run locally:

```bash
cd packages/frontend  # or project root for Option B

export DATABASE_URL="postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres"

npx drizzle-kit push
```

> `push` applies the current schema.ts directly to the DB. Use `migrate` for production workflows, but `push` is simplest for initial setup.

Verify tables were created:
```sql
-- Run in Supabase Dashboard → SQL Editor
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

You should see: `users`, `submissions`, `daily_breakdown`, `sessions`, `api_tokens`.

### 3-4. Deploy

Once tables are confirmed, go back to Vercel Dashboard and click **Deploy**.

### 3-5. Verify and Update URLs

1. Note the assigned URL after deployment (e.g., `tokscale-team.vercel.app`)
2. **Vercel**: update `NEXT_PUBLIC_URL` in Environment Variables → Redeploy
3. **Update OAuth callback URLs**:
   - GitHub: `https://tokscale-team.vercel.app/api/auth/github/callback`
   - Google: `https://tokscale-team.vercel.app/api/auth/google/callback`

---

## Step 4: Team CLI Setup

Each team member configures their CLI to point to the team leaderboard.

### 4-1. Set Environment Variable

Add to your shell config (`~/.zshrc` or `~/.bashrc`):

```bash
export TOKSCALE_API_URL=https://tokscale-team.vercel.app
```

Apply:
```bash
source ~/.zshrc
```

### 4-2. Login to Team Instance

```bash
tokscale login
```

A browser opens where you can sign in with GitHub or Google.

> **Note**: This is separate from the public leaderboard (`tokscale.ai`). While `TOKSCALE_API_URL` is set, all login/submit operations go to the team instance only.

### 4-3. Submit Data

```bash
tokscale submit
```

Data is submitted to the team leaderboard.

### 4-4. Using Both Public and Team Leaderboards (Optional)

To submit to both leaderboards, use an alias:

```bash
# Add to ~/.zshrc
alias tokscale-team="TOKSCALE_API_URL=https://tokscale-team.vercel.app tokscale"

# Usage
tokscale submit          # public leaderboard (tokscale.ai)
tokscale-team submit     # team leaderboard
```

---

## Step 5: Custom Domain (Optional)

1. Vercel Dashboard → **Settings → Domains**
2. Add a custom domain (e.g., `leaderboard.yourteam.com`)
3. Configure DNS records (add the CNAME record Vercel provides)
4. Update `NEXT_PUBLIC_URL` and OAuth callback URLs to use the custom domain

---

## Cost Reference

| Service | Free Plan Limits | When to Upgrade |
|---------|-----------------|-----------------|
| **Vercel** (Hobby) | 100GB bandwidth/mo, 100GB-Hrs serverless | Pro $20/mo for larger teams |
| **Supabase** (Free) | 500MB DB, 1GB file storage, 50K MAU | Pro $25/mo if DB exceeds 500MB |

A small team (~20 members) can run entirely on free plans.

---

## Troubleshooting

### Build Failure: `relation "submissions" does not exist`

```
Error occurred prerendering page "/"
d: relation "submissions" does not exist
```

**Cause**: Next.js prerenders pages during build and queries the DB, but tables have not been created yet.

**Fix**:

1. Run the DB migration first (see Step 3-3):
   ```bash
   cd packages/frontend
   export DATABASE_URL="postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres"
   npx drizzle-kit push
   ```

2. Verify tables exist in Supabase Dashboard → **SQL Editor**:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   ```

3. **Redeploy** from Vercel Dashboard (deployment **⋮** menu → **Redeploy**)

### Build Failure: Page Prerender 60-Second Timeout

```
Failed to build /(main)/page: / (attempt 1 of 3) because it took more than 60 seconds.
Failed to build /(main)/page: / after 3 attempts.
```

**Cause**: The connection from Vercel build servers to Supabase DB is being blocked. Cross-region latency (100-200ms) does not cause 60-second timeouts — the connection itself is failing.

**Fixes (try in order)**:

**Fix 1 — Disable Supabase Network Restrictions (recommended)**

1. Supabase Dashboard → **Project Settings → Network**
2. Check **Network Restrictions** or **Allowed IP addresses**
3. If restrictions are active:
   - Set to allow all IPs (`0.0.0.0/0`)
   - Or add Vercel build server IPs (not recommended — they change between builds)
4. **Redeploy** from Vercel Dashboard

**Fix 2 — Verify Connection Pooler URI and Timeout**

1. Supabase Dashboard → **Connect** → **Connection Pooler** tab
2. Verify the URI uses `pooler.supabase.com` on port `6543` (not Direct `5432`)
3. Append `?connect_timeout=30` to `DATABASE_URL`:
   ```
   postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres?connect_timeout=30
   ```

**Testing DB Connection Locally**

Before deploying, verify the Pooler URI works from your local machine:

```bash
# 1. psql direct test
psql "postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres?sslmode=require"
```

On success, a `postgres=>` prompt appears. Quick check:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
\q
```

If psql is not installed, use Node.js:

```bash
# 2. Node.js one-liner
node -e "
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10 });
  sql\`SELECT 1 as ok\`.then(r => { console.log('Connected:', r); process.exit(0); })
    .catch(e => { console.error('Failed:', e.message); process.exit(1); });
"
```

> Run from the `packages/frontend` directory so the `postgres` package is available.

```bash
# 3. drizzle-kit studio (connection + schema visual check)
cd packages/frontend
export DATABASE_URL="postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres?sslmode=require"
npx drizzle-kit studio
```

If Drizzle Studio (`https://local.drizzle.studio`) opens and shows table data, the connection is working.

**Connection failure checklist**:
- `timeout`/`ETIMEDOUT` — check Supabase network restrictions (Fix 1)
- `password authentication failed` — verify DB password is URL-encoded (e.g., `@` → `%40`)
- `SSL` error — append `?sslmode=require` to the URI

**Local psql works but Vercel build still times out**

If psql connects fine locally but Vercel deployment fails, narrow down the cause:

**Step A — Reproduce the build locally**

```bash
cd packages/frontend

export DATABASE_URL="postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres?sslmode=require"
export GITHUB_CLIENT_ID="your_client_id"
export GITHUB_CLIENT_SECRET="your_client_secret"
export NEXT_PUBLIC_URL="http://localhost:3000"

DB_POOL_MAX=5 npx next build
```

- **Local build also times out** — go to Step B
- **Local build succeeds** — network from Vercel to Supabase is blocked (Step C)

**Step B — Verify Vercel build server outbound connectivity**

1. **Supabase SSL**: Dashboard → **Settings → Database → SSL Configuration**
   - `Enforce SSL` should be active; `DATABASE_URL` must include `?sslmode=require`

2. **Supabase Network Restrictions**: Dashboard → **Settings → Network**
   - If "Restrictions applied" is shown, click **Remove restrictions**

3. **Vercel env var values**: Dashboard → **Project Settings → Environment Variables**
   - Ensure `DATABASE_URL` is exactly the same as the one tested locally
   - Check for trailing whitespace or line breaks from copy-paste
   - Copy the value from Vercel and test it locally:
     ```bash
     psql "paste_DATABASE_URL_from_Vercel_here"
     ```

**Step C — Skip static prerendering**

If other fixes don't work or you need to deploy quickly, switch the homepage to server-side rendering:

Add to `packages/frontend/src/app/(main)/page.tsx`:
```typescript
export const dynamic = "force-dynamic";
```

This skips DB access during build and renders at request time. First visit may be slightly slower, but the build succeeds.

### DB Connection Pool Contention

**Symptom**: Some concurrent DB queries complete while others hang indefinitely during build.

**Cause**: The app's connection pool is set to `max: 1`. When multiple queries are issued concurrently, they queue on a single connection. Combined with Supabase Transaction Mode Pooler, the next batch of queries can hang after the first batch completes.

**Background — why `max: 1`?**

In Vercel Serverless, each function instance creates its own pool. With dozens of concurrent cold-starts, `max: 5` per instance quickly exceeds Supabase Free plan limits (60 direct / 200 pooler clients). So `max: 1` is safe for runtime.

However, during **build**, a single process prerenders multiple pages and needs concurrent queries. `max: 1` becomes a bottleneck.

| Supabase Plan | Max Direct Connections | Max Pooler Clients |
|---------------|----------------------|-------------------|
| Free (Nano/Micro) | 60 | 200 |
| Pro (Small) | 90 | 400 |
| Pro (Medium) | 120 | 600 |

**Fix — `DB_POOL_MAX` env var**

`src/lib/db/index.ts` reads `DB_POOL_MAX` to override the pool size:

```typescript
max: parseInt(process.env.DB_POOL_MAX || "1", 10),
```

Recommended values:

| Environment | `DB_POOL_MAX` | Reason |
|-------------|--------------|--------|
| **Vercel runtime** (default) | Not set (defaults to `1`) | Keeps instances × max under pooler limit |
| **Vercel build** | `5` | Single process, needs concurrency for prerender |
| **Local dev/build** | `5` | Single process, safe to use more connections |

**Setting it for Vercel builds only**:

1. Vercel Dashboard → **Project Settings → Build & Development Settings**
2. Enable **Build Command** override
3. Enter:
   ```bash
   DB_POOL_MAX=5 next build
   ```

This gives `max: 5` during build and `max: 1` at runtime.

**Local builds**:

```bash
cd packages/frontend
DB_POOL_MAX=5 npx next build
```

**Supabase pool size check**:

If the server-side pool is too small, queries will wait regardless of client `max`:

1. Supabase Dashboard → **Project Settings → Database → Connection Pooling**
2. Check **Pool Size** (Free plan default is 15)
3. Ensure: Vercel instances x `DB_POOL_MAX` < Pool Size

### DB Connection Error

```
Error: connect ECONNREFUSED
```
- Verify you're using the **Transaction Mode Pooler** URI (port `6543`)
- Ensure `?sslmode=require` is appended to the URI

### OAuth Callback Failure

```
Error: redirect_uri_mismatch
```
- Verify each OAuth app's callback URL is correct:
  - GitHub: `https://[your-domain]/api/auth/github/callback`
  - Google: `https://[your-domain]/api/auth/google/callback`
- Ensure `NEXT_PUBLIC_URL` env var matches

### CLI Login Connects to Wrong Instance

- Verify `echo $TOKSCALE_API_URL` shows the correct URL
- Delete `~/.config/tokscale/credentials.json` and re-run `tokscale login`
  - **Warning**: this also removes credentials for the public leaderboard. Use the alias approach from Step 4-4 for dual usage.

### drizzle-kit push SSL Error

```bash
# For SSL certificate issues (development only)
export NODE_TLS_REJECT_UNAUTHORIZED=0
npx drizzle-kit push
```

Or append `?sslmode=require` to `DATABASE_URL`.

### drizzle-kit push Crashes on CHECK Constraint

```
TypeError: Cannot read properties of undefined (reading 'replace')
```

**Cause**: Known bug in `drizzle-kit@0.30.x` when parsing existing Supabase CHECK constraints.

**Fix**: Apply the schema changes directly via SQL instead. In Supabase Dashboard → **SQL Editor**:

```sql
-- Example: if you need to add the google_id column
ALTER TABLE users ALTER COLUMN github_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);
```
