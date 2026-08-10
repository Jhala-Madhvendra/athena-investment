# Deployment Guide

This app is two independently deployable pieces:

- `backend/` — Express API (Node), talks to MongoDB and Yahoo Finance.
- `frontend/` — Vite/React static build, talks to the backend over HTTP.

Suggested low-ops setup: **MongoDB Atlas** (database) + **Render or Railway**
(backend) + **Vercel or Netlify** (frontend, static build). Everything below
is written generically so it works with any host that lets you set
environment variables and exposes an HTTPS URL.

## 1. MongoDB (Atlas)

1. Create a free/shared cluster (or dedicated, depending on load).
2. **Database Access** → create a new database user *dedicated to this app*,
   with `readWrite` scoped to the app's database only — not an Atlas admin
   user, and not the cluster's root user.
3. **Network Access** → add only the IP ranges you actually need:
   - If your host publishes static outbound IPs (most PaaS do, sometimes as
     a paid add-on), allowlist exactly those.
   - Otherwise, as a minimum-viable option, allow `0.0.0.0/0` temporarily to
     get deployed, then tighten it once you know your host's egress IPs or
     can use Atlas Private Endpoint / VPC peering (available on some Atlas
     tiers) with your host's cloud provider.
   - Never leave `0.0.0.0/0` as the permanent production setting if you can
     avoid it.
4. Grab the connection string (`mongodb+srv://...`) — this is your
   `MONGO_URI`. TLS is on by default for Atlas connections.

## 2. Backend

1. Copy `backend/.env.example` to `backend/.env` locally (already
   git-ignored) and fill in real values for local runs; on your host, set
   the same variables in its environment/secrets UI — never commit `.env`.

   | Variable | Required | Notes |
   |---|---|---|
   | `MONGO_URI` | yes | From Atlas step above |
   | `NODE_ENV` | yes | Set to `production` |
   | `PORT` | usually set by the host | Falls back to 5000 |
   | `FRONTEND_ORIGIN` | yes in production | Comma-separated list of the exact frontend URL(s), e.g. `https://athena.vercel.app`. CORS blocks everything else once this is set. |
   | `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | no | Defaults are 15 min / 300 requests per IP |
   | `EXTERNAL_API_TIMEOUT_MS` | no | Defaults to 10s for outbound Yahoo Finance calls |

2. Deploy `backend/` with start command `npm start` (runs `node server.js`).
3. Confirm `GET /health` returns `{"status":"ok"}` on the deployed URL.
4. Once you know the frontend's real URL, set `FRONTEND_ORIGIN` to it and
   redeploy/restart — until then CORS will reject cross-origin requests in
   production by design (see `backend/server.js`).

## 3. Frontend

1. Copy `frontend/.env.example` to `frontend/.env.production` and set
   `VITE_API_URL` to the deployed backend's HTTPS URL.
2. Build with `npm run build`; deploy the `dist/` output (most static hosts
   auto-detect Vite and do this for you from the repo).
3. Confirm the deployed frontend can reach `VITE_API_URL` — check the
   browser network tab for CORS errors on first load.

## Pre-launch checklist

- [ ] No API keys or secrets committed to git (`backend/.env` stays local/host-secret only)
- [ ] `backend/.env` / host env vars fully configured (`MONGO_URI`, `NODE_ENV=production`, `FRONTEND_ORIGIN`)
- [ ] MongoDB Atlas: dedicated least-privilege DB user, network access restricted (see above)
- [ ] CORS: `FRONTEND_ORIGIN` set to the real frontend URL(s), nothing else allowed
- [ ] Rate limiting active (`generalLimiter` + `expensiveLimiter` on import/valuation routes)
- [ ] Input validation in place on all routes (already consistent across controllers)
- [ ] Structured error logging via `pino` (check host's log viewer after a test request)
- [ ] No raw error messages/stack traces returned to clients in production (`NODE_ENV=production` gates this)
- [ ] Dev/debug scripts removed from the deployed backend (already deleted from the repo)
- [ ] Server + outbound Yahoo Finance calls have sensible timeouts (30s server, 10s outbound)
- [ ] External API failures degrade gracefully (502 with a clean message, not a hang or crash)
