# ScholarScout 🎓

**Personal scholarship & opportunity intelligence** — a zero-cost web application that
continuously discovers, verifies, filters, scores and presents scholarships, fellowships,
summer schools, boot camps, conferences and climate/clean-air programmes that are
*realistically* relevant to a Ghanaian Computer Science graduate (52% CWA · Second Class
Lower · ≈ UK 2:2).

> **Guiding principle:** don't show more opportunities — show *better* opportunities.

---

## Highlights

- **Source Registry + Discovery Engine** — not a generic web scraper. Authoritative seed
  sources (Ghana Scholarships Authority, Chevening, DAAD EPOS, Erasmus Mundus,
  Commonwealth, Australia Awards Africa, MEXT, GKS, CSC, Mastercard Foundation, Clean Air
  Fund, UNEP, plus reputable aggregators for discovery), each with a declared parser
  strategy. Adding a source = one JSON entry.
- **Honest eligibility** — Ghanaian eligibility (`Ghana / Africa / International /
  Restricted / Unknown`) and academic fit (`Clearly / Potentially / Unclear / Likely
  Ineligible / Unknown`) are classified **only from source wording**. Your 52% CWA is
  never converted into a foreign GPA; the exact requirement is preserved and any
  interpretation is labelled as ScholarScout's, not the source's.
- **Transparent 0–100 match score** with a full per-component breakdown
  (nationality 20 · funding 20 · academic 15 · field 15 · career 10 · geography 5 ·
  deadline 5 · type 5 · verification 5), "why it matches" and "potential concerns".
- **Zero cost** — no paid APIs, no paid database, no Docker, no mandatory keys.
  GitHub (repo-backed JSON storage + Actions scheduling) + Vercel (static hosting +
  one serverless function).
- **Respectful fetching** — robots.txt honoured, per-host rate limiting, bounded body
  sizes, timeouts, no CAPTCHA/anti-bot/paywall circumvention. One failed source never
  stops an update; failures are recorded per source.
- **Twice-daily automatic updates** at **00:00** and **13:00 Africa/Accra** via GitHub
  Actions, plus a prominent **Update Now** button running the *same* pipeline serverlessly.

---

## Architecture

```
┌────────────────────────────  GitHub repository ────────────────────────────┐
│  data/sources.json        ← source registry (editable)                     │
│  data/opportunities.json  ← discovered & classified opportunities          │
│  data/runs.json           ← update-run history & per-source stats          │
│  data/profile.json        ← your durable profile (seeds every device)      │
└──────────────▲──────────────────────────────────────────────▲──────────────┘
               │ commits                                      │ npm ci + ingest
   ┌───────────┴───────────┐                     ┌────────────┴───────────┐
   │  GitHub Actions       │  00:00 & 13:00 GMT  │  scripts/ingest.mts    │
   │  update-opportunities │────────────────────▶│  → src/server/pipeline │
   └───────────────────────┘  (+ dispatch, lock) └────────────────────────┘
               │ push triggers deploy
   ┌───────────▼────────────────────────────────────────────────────────────┐
   │  Vercel                                                                │
   │   • static React dashboard (Vite build; data copied to /data/*.json)   │
   │   • /api/update — serverless "Update Now" (same pipeline, batched)     │
   └────────────────────────────────────────────────────────────────────────┘
```

**One pipeline, two entry points.** `src/server/pipeline.ts` implements
load registry → robots check → fetch → parse (RSS/Atom/sitemap/HTML list/HTML page +
JSON-LD) → normalize → classify (nationality, academic, funding, fields, type, deadline)
→ canonicalize & dedupe → score → persist → stats. GitHub Actions runs it durably and
commits; the Update Now button runs it serverlessly for instant feedback (and optionally
dispatches the full workflow when a GitHub token is configured).

### Storage abstraction

All persistence goes through `src/store/adapter.ts` (`StorageAdapter` interface).
The default implementation is repository-backed JSON (`FileStore`) — genuinely free,
transparent, version-controlled. To move to Supabase/Neon/etc. later, implement the same
interface in a new adapter; the pipeline and UI never touch storage directly.

### Where personal state lives

- `data/profile.json` — your durable profile, committed to the repo. Every browser
  seeds itself from it on first visit, so preferences survive browser resets and sync
  across devices.
- Browser `localStorage` — working copy of the profile plus saved/hidden/applied
  statuses (instant writes). Settings → *Export profile* produces a JSON you can commit
  back to `data/profile.json` to sync device-local edits.
- To re-run the onboarding wizard from scratch, clear site data **and** temporarily
  remove `data/profile.json` (or set `"onboardingComplete": false` in it).

---

## Local setup

```bash
npm install          # Node 20+
npm run dev          # dashboard at http://localhost:5173
                     #  (dev server also mounts /api/update and serves /data/*)
npm run ingest       # run a full discovery update locally (writes data/*.json)
npm test             # 88 tests: scoring, eligibility, deadlines, dedupe, pipeline, UI
npm run build        # type-check + production build (dist/)
```

`npm run ingest` flags:

```bash
npm run ingest -- --trigger=scheduled          # label the run
npm run ingest -- --sources=chevening,gks      # only specific source ids
```

A lock file (`data/.lock.json`) prevents concurrent runs; stale locks (>30 min) break
automatically.

## Environment variables

**None are required.** See `.env.example` for the optional ones:

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` + `GITHUB_REPO` | lets Update Now also dispatch the full GitHub Actions crawl |
| `UPDATE_SECRET` | protects `POST /api/update` with an `x-update-key` header |
| `AI_PROVIDER` / `AI_API_KEY` | future optional AI enrichment hook (`src/server/enrich.ts`) — the core system is fully rule-based and never needs this |

Never commit secrets; `.env` is git-ignored.

## GitHub Actions

- **`.github/workflows/update-opportunities.yml`** — runs at `0 0 * * *` and `0 13 * * *`
  UTC (Africa/Accra is UTC+0 with no DST, so these are exactly 00:00 / 13:00 Accra),
  supports `workflow_dispatch` (with an optional source filter), uses a `concurrency`
  group as a lock, has a 25-minute timeout, commits changed `data/` files, and emits a
  clear `::error` annotation on failure.
- **`.github/workflows/ci.yml`** — type-check, tests and build on every push/PR.

## Vercel deployment

1. Push this repository to GitHub.
2. Import it in Vercel (framework: **Vite** — auto-detected from `vercel.json`).
3. Deploy. No Docker, no persistent server, no env vars needed.
4. Each scheduled Actions run commits fresh data → Vercel auto-redeploys → the dashboard
   serves the new `/data/*.json` (cached 60 s).

Optionally add `GITHUB_TOKEN`/`GITHUB_REPO`/`UPDATE_SECRET` in Vercel → Project →
Environment Variables to upgrade the Update Now button as described above.

## Manual updates

- **Dashboard:** press **Update Now** → confirm → live per-source progress → summary
  (sources checked, pages fetched, discovered, new, updated, rejected, errors). Results
  merge into the feed immediately; you can keep browsing while it runs.
- **CLI:** `npm run ingest`
- **GitHub:** Actions → *Update opportunities* → *Run workflow*.

## Source registry & adding a source

Everything lives in `data/sources.json`. A source entry:

```jsonc
{
  "id": "my-university",             // unique, stable
  "name": "My University Funding",
  "url": "https://uni.example/scholarships/feed.xml",
  "country": "Canada", "region": "canada",
  "sourceType": "university",        // government | university | fellowship_org | climate_org | tech_org | research_institution | conference | aggregator
  "active": true,
  "parser": "rss",                   // rss | atom | sitemap | html_list | html_page | jsonld
  "trust": "official",               // official → VERIFIED; reputable → NEEDS REVIEW until confirmed
  "keywords": ["scholarship"],       // pre-filter for rss/sitemap items
  "listConfig": {                    // only for html_list
    "itemSelector": "article.card",
    "includeKeywords": ["scholarship", "apply"]
  },
  "seed": { /* only for html_page flagship programmes: title, organization, type, level, summary… */ },
  "notes": null,
  "lastChecked": null, "lastSuccess": null, "failureCount": 0, "robotsStatus": "unknown"
}
```

Parser strategies:

| Strategy | Use when |
|---|---|
| `rss` / `atom` | the source publishes a feed (most reliable) |
| `sitemap` | keyword-filterable sitemap.xml |
| `html_list` | a news/listing page; configure CSS selectors in `listConfig` |
| `html_page` | one flagship programme page (Chevening, MEXT, …); `seed` supplies stable metadata, the live page supplies eligibility/funding/deadline text |
| `jsonld` | pages with useful structured metadata |

Set `"active": false` to disable a source without deleting it (see the DAAD database
example — JavaScript-rendered pages are intentionally left inactive rather than worked
around).

## Data model

Strong TypeScript types in `src/core/types.ts`: `Opportunity`, `UserProfile`, `Source`,
`SavedOpportunity`, `UpdateRun`, `OpportunityChange`, plus enums for funding, eligibility,
academic fit, verification and deadline buckets.

## Deduplication & change detection

- Canonical URL (tracking params stripped, host/path normalized) is the primary key;
  normalized title + organization + deadline is the secondary key — syndicated copies
  collapse into one card.
- A content hash over the user-meaningful fields detects changes; changed opportunities
  get an **UPDATED** badge and a per-field change record (visible on the detail page).

## Trust & verification

Every opportunity carries `VERIFIED` (extracted directly from an authoritative source),
`NEEDS REVIEW` (important fields could not be confidently established), or
`SOURCE UNAVAILABLE` (source currently unreachable — existing items are kept but
downgraded, never silently deleted). Nothing is ever fabricated: unknown deadline stays
*Deadline Unknown*, unknown funding stays *FUNDING UNKNOWN*, unestablished eligibility is
labelled — and scored down — as such.

## Testing

```bash
npm test
```

88 tests across 8 suites: scoring & weights, nationality/academic/funding/field/type
classifiers, deadline parsing (incl. refusal to guess ambiguous dates), canonical URLs &
hashing, RSS/Atom/sitemap/HTML parsers against stored fixtures, full pipeline integration
(dedupe across runs, UPDATED detection, robots.txt, failed-source isolation, inactive
sources), filters/search, onboarding flow, saved/applied actions, dashboard rendering and
dark mode. Tests never hit the live network — `fetch` is mocked with fixture pages in
`tests/fixtures/`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Update Now fails locally | You're fine — the dev server mounts `/api/update`; if you bypassed `npm run dev`, use `npm run ingest` instead |
| `another update is already running` | A previous run crashed; delete `data/.lock.json` (auto-breaks after 30 min) |
| A source keeps failing (`http-412`, `timeout`) | The site blocks bots or is slow. That's expected and recorded; set `"active": false` or find its RSS feed. Never add workarounds that defeat anti-bot systems |
| Empty dashboard after deploy | The build copies `data/` → `public/data/`; make sure `data/opportunities.json` is committed (run the Actions workflow once) |
| Scheduled runs not firing | GitHub disables cron on repos with no activity for 60 days — push any commit to re-enable |
| Onboarding doesn't appear | `data/profile.json` marks onboarding complete by design; set `"onboardingComplete": false` there and clear site data to redo it |

## Project structure

```
api/update.ts            Vercel serverless Update Now endpoint
data/                    repository-backed storage (registry, dataset, runs, profile)
scripts/ingest.mts       ingestion CLI (GitHub Actions / local)
scripts/sync-data.mjs    copies data/ → public/data at build time
src/core/                isomorphic domain logic (types, classifiers, scoring, deadlines, dedupe keys)
src/server/              Node-side: respectful fetcher, parsers, pipeline, optional AI hook
src/store/               storage abstraction + file adapter
src/components|pages|lib React dashboard, onboarding, settings, filters, state
tests/                   vitest suites + HTML/XML fixtures
.github/workflows/       scheduled updates + CI
```
