# Deploying CollabCode (free tier)

CollabCode has two deployable apps plus managed services:

| Piece | Host | Why |
|---|---|---|
| `web` (Next.js) | **Vercel** (Hobby, free) | Next.js's native host |
| `execution-service` (Fastify + BullMQ worker) | **Render** (free web service) | Needs an always-on process; serverless can't run a queue worker |
| Redis | **Upstash** (free) | BullMQ backend |
| Supabase, Clerk, Liveblocks, Judge0 | Already managed SaaS | Used as-is |

> **Free-tier caveat:** Render free services **sleep after ~15 min idle** and take ~30–60s to wake on the next request. The first code execution after a quiet period will be slow. Fine for a demo/portfolio; upgrade the Render plan to remove sleeping.

---

## 0. Push your latest changes to GitHub

```bash
git add .
git commit -m "Prep for deployment"
git push
```

`.env`, `.env.local`, and other secret files are git-ignored — they will **not** be pushed. You'll set those values in each host's dashboard instead.

---

## 1. Restore a cloud Redis (Upstash)

1. Create a free Redis DB at [upstash.com](https://upstash.com) (enable **TLS**).
2. Copy the **`rediss://` URL** (it embeds the password).
3. You'll paste it as `UPSTASH_REDIS_URL` in Render (step 3).

---

## 2. Deploy `web` to Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import your GitHub repo.
2. **Root Directory:** `web`
3. Framework preset: **Next.js** (auto-detected). Leave build/output defaults.
4. **Environment Variables:** add every key from [`web/.env.production.example`](web/.env.production.example).
   - Leave `EXECUTION_SERVICE_URL` blank for now — you'll fill it after step 3.
5. **Deploy.** Note your URL, e.g. `https://collabcode-xxx.vercel.app`.

---

## 3. Deploy `execution-service` to Render

**Option A — Blueprint (uses [`render.yaml`](render.yaml)):**

1. [render.com](https://render.com) → **New → Blueprint** → pick this repo.
2. Render reads `render.yaml` and creates the `collabcode-execution` service.
3. Fill in the secret env vars it prompts for (from [`execution-service/.env.production.example`](execution-service/.env.production.example)):
   - `FRONTEND_URL` = your Vercel URL (no trailing slash)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `UPSTASH_REDIS_URL` (from step 1)
   - `JUDGE0_RAPIDAPI_KEY` **or** `JUDGE0_URL`
4. Deploy. Note the URL, e.g. `https://collabcode-execution.onrender.com`.

**Option B — manual:** New → Web Service → repo → Root Dir `execution-service`,
Build `npm install && npm run build`, Start `npm start`, then add the same env vars.

---

## 4. Wire the two together

1. **Vercel** → web project → Settings → Env Vars → set
   `EXECUTION_SERVICE_URL = https://collabcode-execution.onrender.com` → **redeploy**.
2. **Render** → confirm `FRONTEND_URL` = your Vercel URL.

---

## 5. Point Clerk's webhook at production

Clerk → Webhooks → set endpoint to:

```
https://<your-vercel-domain>/api/webhooks/clerk
```

Subscribe to `user.created`, `user.updated`. Copy the signing secret into
Vercel's `CLERK_WEBHOOK_SECRET`. (Users are also upserted on first API call,
so the app works even before the webhook fires.)

---

## 6. Smoke test

1. Open your Vercel URL → sign up.
2. Create a room, open it in a second browser/account via the **Invite** link.
3. Confirm live cursors + shared editing.
4. Click **Run** → output appears (first run may be slow if Render was asleep).

---

## Production notes

- **Judge0:** the free community endpoint (`ce.judge0.com`) is rate-limited and
  can be flaky. For anything real, use **RapidAPI** (set `JUDGE0_RAPIDAPI_KEY`).
- **Rate limiting** in the execution-service is in-memory; with a single Render
  instance that's fine. Multiple instances would each count separately.
- **Keep Render awake (optional):** ping `/health` every ~10 min with a free
  cron (e.g. cron-job.org) to avoid cold starts.
