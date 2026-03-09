# CollabCode

A real-time collaborative code editor and execution platform. Multiple users edit the same file simultaneously (Google Docs-style) and run the code together via an execution queue.

**Stack:** Next.js 16 · Clerk · Supabase · Liveblocks · Yjs · Monaco Editor · xterm.js · Fastify · BullMQ · Upstash Redis · Judge0 CE

---

## Repository Structure

```
collabCode/
├── web/                  # Next.js 16 app (frontend + API routes)
└── execution-service/    # Fastify + BullMQ execution queue
```

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 18.x |
| npm | 9.x |
| Docker Desktop | 4.x+ |

Docker Desktop is required to run Judge0 CE locally (the code execution backend).

---

## 1. External Services Setup

You need free-tier accounts on four services before filling in any environment variables.

### 1.1 Clerk (authentication)

1. Create a project at [clerk.com](https://clerk.com).
2. In **API Keys**, copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
3. In **Webhooks → Add endpoint**, set the URL to `https://your-domain.com/api/webhooks/clerk` (or use a tunnel like [ngrok](https://ngrok.com) for local testing: `https://abc123.ngrok.io/api/webhooks/clerk`).
   - Subscribe to events: `user.created`, `user.updated`
   - Copy the **Signing Secret** → `CLERK_WEBHOOK_SECRET`

### 1.2 Supabase (database)

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (used in both services)
3. Open the **SQL Editor** and run the full contents of [`web/supabase/schema.sql`](web/supabase/schema.sql) to create all tables and RLS policies.

### 1.3 Liveblocks (real-time presence)

1. Create a project at [liveblocks.io](https://liveblocks.io).
2. In **API Keys**, copy:
   - Public key → `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY`
   - Secret key → `LIVEBLOCKS_SECRET_KEY`

### 1.4 Upstash Redis (BullMQ queue backend)

1. Create a Redis database at [upstash.com](https://upstash.com) (free tier, choose **TLS enabled**).
2. In the database dashboard, copy:
   - **Endpoint** → `UPSTASH_REDIS_URL` (use the `rediss://` TLS URL)
   - **Password** → `UPSTASH_REDIS_TOKEN`

---

## 2. Environment Variables

### `web/.env.local`

Create this file by copying the example:

```bash
cp web/.env.local.example web/.env.local
```

Then fill in every value:

```dotenv
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Liveblocks
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=pk_...
LIVEBLOCKS_SECRET_KEY=sk_...

# Clerk Webhooks
CLERK_WEBHOOK_SECRET=whsec_...

# Execution Service (where Fastify is running)
EXECUTION_SERVICE_URL=http://localhost:4000
```

### `execution-service/.env`

Create this file by copying the example:

```bash
cp execution-service/.env.example execution-service/.env
```

Then fill in every value:

```dotenv
PORT=4000
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

UPSTASH_REDIS_URL=rediss://your-upstash-endpoint:6379
UPSTASH_REDIS_TOKEN=your-upstash-password

# Judge0 CE — choose ONE option (see Section 8):
# Option A — RapidAPI hosted (recommended on Windows, works everywhere)
JUDGE0_RAPIDAPI_KEY=your-rapidapi-key
# Option B — self-hosted Docker (Linux/Mac only)
JUDGE0_URL=http://localhost:2358
JUDGE0_TOKEN=
```

---

## 3. Install Dependencies

Run these in two separate terminals (or sequentially):

```bash
# Next.js app
cd web
npm install

# Execution service
cd ../execution-service
npm install
```

---

## 4. Run in Development

You need **two terminals** running simultaneously.

### Terminal 1 — Next.js app

```bash
cd web
npm run dev
```

Runs on [http://localhost:3000](http://localhost:3000) with Turbopack hot reload.

### Terminal 2 — Execution service (Fastify + BullMQ worker)

```bash
cd execution-service
npm run dev
```

Runs on [http://localhost:4000](http://localhost:4000). This starts both the Fastify HTTP server and the BullMQ worker in the same process.

### Clerk webhook tunnel (optional, for user sync)

If you want the Clerk webhook to fire locally (needed for the first sign-in to create a user row in Supabase), expose port 3000 with ngrok:

```bash
ngrok http 3000
```

Then update your Clerk webhook endpoint URL to the ngrok HTTPS URL.

> **Tip:** The app still works without the webhook. Users are upserted into Supabase on first API call if they don't exist yet.

---

## 5. Run in Production

### Build the Next.js app

```bash
cd web
npm run build
npm start          # runs on port 3000
```

### Build and start the execution service

```bash
cd execution-service
npm run build
npm start          # runs on port 4000 (or $PORT)
```

Both services must be running and reachable from each other. Set `EXECUTION_SERVICE_URL` in `web/.env.local` to the public URL of the execution service.

---

## 6. Verify Everything Works

1. Open [http://localhost:3000](http://localhost:3000) — you should see the landing page.
2. Sign up with Clerk. You will be redirected to `/dashboard`.
3. Click **+ New Room**, choose a language, give it a name.
4. You land in the editor. Open the same URL in a second browser tab — both cursors should appear.
5. Write some code and click **Run**. Output appears in the terminal panel below the editor.
6. Click **Invite** on a room card in the dashboard. An invite link is copied to your clipboard. Opening it in a different session joins that room.

---

## 7. Supported Languages

All 10 languages are available via self-hosted Judge0 CE:

| Label | Judge0 Language ID |
|---|---|
| JavaScript | 63 |
| TypeScript | 74 |
| Python | 71 |
| Java | 62 |
| C++ | 54 |
| C | 50 |
| Go | 60 |
| Rust | 73 |
| Ruby | 72 |
| PHP | 68 |

---

## 8. Judge0 CE (Required)

The public Piston API went whitelist-only on February 15, 2026. Judge0 CE is the execution backend. You must configure it before code execution will work.

> **Windows users:** Docker Desktop on Windows uses a WSL2 VM that blocks the kernel namespace syscalls that Judge0's `isolate` sandbox requires. Even with `privileged: true`, execution will return Internal Error. **Use Option A (RapidAPI) on Windows.**

---

### Option A — RapidAPI hosted (recommended on Windows, works everywhere)

Free tier: 50 requests/day. No Docker required.

1. Go to [rapidapi.com/judge0-official/api/judge0-ce](https://rapidapi.com/judge0-official/api/judge0-ce).
2. Click **Subscribe to Test** → choose the **Basic** (free) plan.
3. In the API console, copy your **X-RapidAPI-Key**.
4. In `execution-service/.env`, set:
   ```dotenv
   JUDGE0_RAPIDAPI_KEY=your-rapidapi-key
   # Leave JUDGE0_URL and JUDGE0_TOKEN blank (or remove them)
   ```
5. Restart the execution service. Code execution will now work for all 10 languages.

---

### Option B — Self-hosted Docker (Linux and Mac only)

1. [Install Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.
2. Download and extract the Judge0 CE release:
   ```bash
   cd your-project-root
   curl -L https://github.com/judge0/judge0/releases/download/v1.13.1/judge0-v1.13.1.zip -o judge0.zip
   unzip judge0.zip
   cd judge0/judge0-v1.13.1
   ```
3. Set required passwords in `judge0.conf`:
   - `REDIS_PASSWORD=judge0redis`
   - `POSTGRES_PASSWORD=judge0postgres`
4. Start Judge0:
   ```bash
   docker-compose up -d db redis
   sleep 10
   docker-compose up -d
   ```
5. Verify: open `http://localhost:2358/system_info` — you should see CPU/memory JSON.
6. In `execution-service/.env`, set:
   ```dotenv
   JUDGE0_URL=http://localhost:2358
   JUDGE0_TOKEN=
   # Leave JUDGE0_RAPIDAPI_KEY blank
   ```

---

### How the code selects the backend

- If `JUDGE0_RAPIDAPI_KEY` is set → uses `https://judge0-ce.p.rapidapi.com` with RapidAPI headers.
- Otherwise → uses `JUDGE0_URL` with optional `JUDGE0_TOKEN` for self-hosted auth.

---

## 9. Common Issues

**`CLERK_WEBHOOK_SECRET` not set — webhook returns 400**
Set the variable in `web/.env.local`. The webhook endpoint is `/api/webhooks/clerk`.

**`UPSTASH_REDIS_URL` — BullMQ connection refused**
Upstash requires the `rediss://` (TLS) scheme and the token passed as the Redis password. Check that `UPSTASH_REDIS_TOKEN` matches the password field in the Upstash dashboard.

**Monaco editor flickers or crashes on first load**
This is expected during development with Turbopack on first cold start. A hard refresh (`Ctrl+Shift+R`) resolves it.

**Judge0 returns "Internal Error" on Windows Docker Desktop**
Docker Desktop's WSL2 virtualization blocks the kernel namespaces that Judge0's `isolate` sandbox needs. Switch to RapidAPI hosted Judge0 (Option A in Section 8) — it works on all platforms without Docker.

**Judge0 returns `language not found` or 500**
The language ID mapping lives in `execution-service/src/services/judge0.ts` (`LANGUAGE_IDS`). Ensure the language string passed from the frontend matches a key in that map.

**`y-protocols` import error on build**
Run `npm install y-protocols` inside `/web`. It is a required peer dependency of `y-monaco` that is not automatically installed.
