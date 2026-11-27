# ALAB GradeSim web app

The web app at [gradesim.bulsu.tools](https://gradesim.bulsu.tools): a BulSU GWA calculator, Latin honors simulator and course planner that runs entirely in the browser. It is the companion to the GradeSim browser extension, which reads grades from ALAB SMS. The extension isn't published yet.

Built with SvelteKit (Svelte 5, TypeScript) and prerendered to static files, plus one Cloudflare Pages Function for checklist fixes. Grades are kept in the browser's local storage under the `gradesim:v1` key and never sent anywhere.

## Getting started

```bash
npm install
npm run dev
```

## Checks

```bash
npm run check      # svelte-check
npm run lint       # eslint
npm test           # vitest: scheduler, curriculum, GWA, importers, planner, xlsx
npm run build      # static site in build/
npm run test:e2e   # Playwright against the built site
```

## Layout

- `src/routes/+page.svelte` is the app (Grades, What if, Planner, Wrapped). `about`, `install`, `privacy` and `terms` are the pages around it.
- `src/lib/*.ts` holds the logic ported from the extension as pure functions: `scheduler.ts`, `curriculum.ts`, `catalog.ts`, `grades.ts`, `planner.ts`, `requirements.ts`, `xlsx.ts`, `wrapped.ts`, and `importers.ts` for backups, plan files and manual entry.
- `src/lib/data/*.json` still holds the upstream UPLB curricula, kept for the test suite. `PROGRAMS` in `curriculum.ts` is the list the app offers, and it's empty until BulSU curricula are added.
- `src/lib/bridge.ts` asks an installed extension for its grades (externally_connectable on Chromium browsers, a window message answered by a content script on Firefox).
- `src/service-worker/` precaches the build so the app works offline.
- `functions/api/fix.ts` is the one server function, a Cloudflare Pages Function. It files a student's checklist fix as an issue on `bulsutools/gradesim-website`, and it answers 503 until `GRADESIM_FIX_TOKEN` is set as a Pages environment variable, so the app opens a prefilled GitHub issue instead.

## Deployment

GitHub Actions deploys to Cloudflare Pages on every push (`.github/workflows/deploy-cloudflare.yml`):

- `main` deploys to the production branch of the `alab-gradesim` Pages project.
- `staging` and pull requests deploy previews (`staging` and `pr-<n>` branches).

Required repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The `alab-gradesim` Pages project and the `gradesim.bulsu.tools` custom domain are set up once in the Cloudflare dashboard. `static/_headers` carries the security headers the old Vercel config had.
