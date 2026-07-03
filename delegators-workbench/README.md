# Delegators Workbench

Standalone artifact harness for professional PDF, DOCX, PPTX, and XLSX work. It owns its run state, research, workspace files, exports, object storage, and isolated terminal without changing the Delegators gateway, admin API, client site, or shared server harness.

> **2026-06 — unified pass + managed search.** The Workbench now accepts the **unified `dlg_*` pass** (one
> 2h30m purchase usable here *or* in the CLI from the same ₹ budget — resolved via the account wallet, no
> change to the existing 30-day `wb_*` packs). All web **research/fetch now routes through the gateway's
> managed Firecrawl pool** (`/v1/tools/web_search` + `/v1/tools/web_scrape`) with a free DuckDuckGo fallback —
> the standalone "Optional Exa API key" box and all client-side `researchApiKey` plumbing were **removed**, so
> no search key ever lives in the Workbench. Image artifacts still auto-route to MiMo vision (`art-vision`),
> which every `dlg_*` tier includes. See the root [`README.md`](../README.md) → *2026-06 Suite Additions*.

For the full Workbench architecture, layer-by-layer harness design, Mermaid infra diagrams, current feature list, validation evidence, findings, and next work, read [`WORKBENCH_README.md`](./WORKBENCH_README.md).

The normal product path uses the local Delegators gateway plus a purchased `sess_...` key. Direct provider testing is restricted to controlled development with the official MiMo origin:

```text
Endpoint: https://api.xiaomimimo.com
Model:    mimo-v2.5-pro
Key:      sk-...
```

Credentials are held only by the active worker. Run snapshots, Redis events, workspace files, and object storage never contain provider keys.

## Harness

- Durable `/api/v2/runs` state with resumable server-sent events and secure browser-assisted restart recovery.
- Provider-authored preflight plans with fallback, resumable progress, and sequential clarification questions.
- Cancellation, reconnect, and mid-run instruction injection.
- Exa-first multi-query research with DuckDuckGo fallback and citation URL grounding.
- Source-page image discovery plus a free Wikimedia Commons bitmap fallback, with SSRF-safe acquisition, license attribution, preview placement, and PDF/PPTX rendering.
- MarkItDown-first upload analysis for Office documents, with built-in extractors as a resilient fallback.
- Per-run format skill packages (`SKILL.md` plus a publication checklist) loaded into the private workspace.
- User-directed design metadata for fonts, palette, page size, orientation, slide aspect, density, contents, and numbering.
- Native in-browser previews for documents, resumes, email, slide decks, and multi-sheet workbooks.
- Provider-backed artifact quality inspection with one bounded revision before export.
- Persistent per-thread workspace with checkpoints and precompiled primary exports.
- Workbench-owned Redis, filesystem workspace, and SeaweedFS object mirror.
- Authenticated remote sandbox service. Execution containers are networkless, read-only, resource-limited, capability-dropped, and never receive credentials.
- Native format compilers with PDF/OOXML container validation before publication.

## Required environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Workbench frontend build/runtime | Enables Clerk sign-in and invisible wallet bootstrap via `AccountGate`. Without it the UI falls back to manual endpoint + session key entry. |
| `CLERK_ISSUER` | Delegators gateway (not the Workbench server) | Clerk JWT issuer URL (`https://<your-instance>.clerk.accounts.dev`). Required on the gateway for account sign-in, wallet resolution, and checkout guards. Workbench SSO depends on this being set on the gateway you point `VITE_DELEGATORS_GATEWAY_URL` at. |
| `WORKBENCH_DEFAULT_MODEL` / `DELEGATORS_DEFAULT_MODEL` | Workbench server | Default model id exposed by `GET /api/config` and used when the user has not chosen a model. Compose and Docker builds default to `dlg-pro`. |
| `VITE_DELEGATORS_DEFAULT_MODEL` | Workbench frontend build | Vite build-time default for the model picker when no saved preference exists. Compose defaults to `dlg-pro`. |

Copy `.env.example` to `.env` for local server defaults, then set the `VITE_*` keys in `.env` (or your shell) before `npm run dev` / `npm run build` so Vite inlines them.

## Local Development

```bash
npm install
cp .env.example .env
# Optional SSO: export VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
npm run dev
```

Open `http://localhost:5175`.

## Production

```bash
npm ci
npm run build
WORKBENCH_PORT=4175 NODE_ENV=production npm run start
```

Docker:

```bash
export WORKBENCH_AUTH_MODE=delegators
export WORKBENCH_DELEGATORS_BASE_URL='http://host.docker.internal:8080'
export WORKBENCH_ALLOW_LOCAL_DELEGATORS=true
export VITE_DELEGATORS_GATEWAY_URL='http://127.0.0.1:8080'
export VITE_DELEGATORS_STORE_URL='http://127.0.0.1:5174'
export WORKBENCH_SANDBOX_TOKEN="$(openssl rand -hex 32)"
docker compose -f compose.yml up --build
```

The default stack starts a private Microsoft MarkItDown sidecar so uploaded PDF, DOCX, PPTX,
XLSX, HTML, CSV, JSON, ZIP, and EPUB content reaches the model as compact structured Markdown.
The sidecar has no public port and holds no credentials.

The same stack starts an authenticated internal sandbox service and enables
`WORKBENCH_TERMINAL_MODE=remote`. Each tool run receives only its thread workspace through a
named-volume subpath and runs in a disposable container with networking disabled, a read-only
root filesystem, dropped capabilities, and CPU/memory/PID limits. The web container never mounts
the Docker socket. Replace the local default sandbox token before starting the stack.

The service binds to `127.0.0.1:4175` by default. The account flow uses the gateway's
`/v1/account/wallet`, `/v1/workbench/plans`, and `/v1/payment/create` endpoints so checkout,
Razorpay binding, wallet resolution, and usage accounting all stay behind the same server plan
registry. Use
`WORKBENCH_AUTH_MODE=static` plus `WORKBENCH_AUTH_TOKEN` only when a trusted proxy injects
`X-Workbench-Token`; the shipped browser UI uses Clerk/account auth or a Delegators session bearer key.

For a local rootless Docker-in-Docker sandbox instead of the host Docker socket:

```bash
export WORKBENCH_AUTH_MODE=delegators
export WORKBENCH_SANDBOX_TOKEN='replace-with-a-separate-random-token'
docker compose -f compose.yml -f compose.sandbox.dev.yml up --build
```

`compose.sandbox.dev.yml` uses privileged rootless DinD only as a local development daemon. The
default `compose.yml` sandbox mounts `/var/run/docker.sock`, which is a root-equivalent trust
boundary even though user workloads themselves are strongly constrained. Production should point
Workbench at a dedicated rootless Docker, gVisor, or equivalent sandbox host over an authenticated
private network.

## Run API

```text
POST /api/v2/runs
GET  /api/v2/runs/:id
GET  /api/v2/runs/:id/events
POST /api/v2/runs/:id/instructions
POST /api/v2/runs/:id/cancel
GET  /api/v2/runs/:id/sources
GET  /api/v2/runs/:id/versions
```

The older synchronous and NDJSON endpoints remain available during migration.

## Security Model

- Session keys are never persisted by the server.
- The browser keeps the key in memory unless the user explicitly chooses tab-only storage.
- The browser persists only credential-free pending requests and submitted run instructions. After a worker restart it creates a replacement run with the current tab credentials.
- Production rejects non-HTTPS Delegators origins unless `WORKBENCH_ALLOW_LOCAL_DELEGATORS=true` is explicitly set for a private deployment.
- User-provided endpoints must be origin-only URLs. The server rejects paths, query strings, userinfo, unsafe production localhost/private origins, and optional allowlist misses.
- Remote skill scripts are not downloaded or executed. Skills are data-only registry entries: aliases, artifact kind, instructions, and allowed output formats.
- API responses are served with `Cache-Control: no-store`.
- Redis stores only client-safe run snapshots and bounded progress events.
- The web container does not mount `/var/run/docker.sock`.
- Artifact generation fails if the model does not return valid JSON matching the schema. The app does not fabricate fallback artifacts.
