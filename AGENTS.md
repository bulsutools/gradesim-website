# GradeSim Website Agent Guide

**Human developers:** start with [README.md](README.md).

Org-wide agent defaults: see [room-tba/AGENTS.md](https://github.com/bulsutools/room-tba/blob/main/AGENTS.md). This file tailors that playbook to **gradesim-website**.

## Doc map

| When | Read |
| --- | --- |
| Local dev | [README.md](README.md) |
| Extension source (separate repo, not yet published) | [bulsutools/alab-gradesim](https://github.com/bulsutools/alab-gradesim) (upstream: [uplbtools/gradesim](https://github.com/uplbtools/gradesim)) |
| PR hygiene | [.github/pull_request_template.md](.github/pull_request_template.md) |
| Deploy | [.github/workflows/deploy-cloudflare.yml](.github/workflows/deploy-cloudflare.yml) |

## Stack

- **Framework:** SvelteKit 3 (Svelte 5 runes), adapter-static, every page prerendered
- **Language:** TypeScript
- **Package manager:** npm (`package-lock.json`)
- **Deploy:** Cloudflare Pages project `alab-gradesim` via GitHub Actions: `main` is production, `staging` and PRs get previews. Needs secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- **Functions:** `functions/api/fix.ts` is a Pages Function; `GRADESIM_FIX_TOKEN` is a Pages env var, not a repo secret.

## Branches and deploy

| Branch | Role |
| --- | --- |
| **`staging`** | Default branch on GitHub: integration / draft work, Pages preview deploys |
| **`main`** | Production: Pages production deploy |
| **`alab-sms`** | BulSU rebrand branch (ALAB SMS) |

**Ship flow:**

1. Feature branch → PR to **`staging`** (integration)
2. Release PR **`staging` → `main`** → production deploy

When the user says **"ship"**, they mean land on **`main`** / production, not stop at `staging`.

## Verify before done

| Step | When |
| --- | --- |
| `npm run check && npm run lint && npm test && npm run build` | Before commit/PR on substantive changes |
| `npm run test:e2e` | UI changes (Playwright, builds first) |
| PR title check | CI validates conventional title on PRs to `main` |

CI (`.github/workflows/ci.yml`) runs check, lint, vitest, build and Playwright.

## Architecture (short)

```
src/routes/+page.svelte   # the app: Grades, What if, Planner, Wrapped
src/routes/{about,install,privacy,terms}/
src/lib/*.ts              # pure logic ported from the extension, with vitest tests
src/lib/data/*.json       # upstream UPLB curriculum/catalog, kept for tests; PROGRAMS in curriculum.ts is what the app offers (empty until BulSU data lands)
functions/api/            # Cloudflare Pages Functions
src/service-worker/       # offline precache
static/                   # fonts, icons, og.jpg, _headers
```

The app is the main thing; the other pages sit around it. The MV3 extension isn't published for BulSU yet; the BulSU one is [alab-gradesim](https://github.com/bulsutools/alab-gradesim).

## UI guardrails

- Keep pages fast and readable on mobile (320px)
- Store install links must match published extension IDs in gradesim README
- No decorative animations

## Commits

- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`
- Update README when changing deploy behavior or store URLs

## Security

- No ALAB SMS credentials or grade data ever leave the browser: no analytics, no server calls with grades
- Do not commit Cloudflare tokens or `.env.local`
