# CLAUDE.md — Agent Operating System

This file is the prime directive for AI agents (Claude Code, Cursor) working in this repo.

## Prime Directive

1. Keep tasks small. One branch per task, one concern per branch.
2. Always run `./scripts/verify` before pushing. Every push must pass verify.
3. Never merge your own MR — push the branch and report the MR URL.

## Safety Rules

- **Secrets** — never read, log, or commit secrets, tokens, or `.env` files.
- **Production** — never modify production environment config or data.
- **Force-push** — never `git push --force` to `main`. Never run `git reset --hard` on `main`.
- **Scope** — only change files relevant to the task. Do not refactor unrelated code.

## Workflow

```
git checkout main && git pull --ff-only origin main
git checkout -b <prefix>/<short-name>       # see docs/WORKFLOW.md for prefixes
# ... make changes ...
./scripts/verify                            # must pass
git add <files> && git commit -m "<type>: <description>"
git push -u origin HEAD \
  -o merge_request.create \
  -o merge_request.target=main \
  -o merge_request.title="<type>: <description>"
# Report the MR URL from the push output
```

## When Blocked

If you encounter any of these, **stop and report the exact message**:

| Blocker | What to report |
|---|---|
| Missing Merge button | Exact UI text (permissions, approvals, discussions) |
| Pipeline failed | Full job log URL and failing step |
| Merge conflicts | File list from `git merge-tree` or GitLab UI |
| Branch protection | Exact error from `git push` output |
| Permission denied | The 403/404 response or SSH error |

Do not attempt workarounds. Report and wait for human input.

## Verify Script Behavior

`./scripts/verify` (in `scripts/verify`) does the following in order:

1. Installs dependencies via the detected package manager (npm/yarn/pnpm).
2. Runs `lint` — must pass.
3. Runs `check` (tsc) — **advisory only**; failure is logged but does not block.
4. Runs `typecheck` — must pass if defined.
5. Runs `test` — must pass if defined.
6. Runs `build` — must pass.

## Design System

Reusable primitives live in `client/src/components/ui/`:

| Component | Purpose |
|---|---|
| `MetricCard` | Compact KPI tile with value, trend arrow, optional sparkline |
| `StatusPill` | Colored dot + label for lead status or urgency |
| `ConfidenceBadge` | Numeric score with green/yellow/red color gradient (`value` prop) |
| `TrendSparkline` | Tiny inline Recharts line chart for time-series data |
| `CaseProgressBar` | Horizontal segmented milestone bar with tooltips |

**Tokens:** Semantic colors (success, warning, info, surface-elevated) and motion tokens defined in `client/src/styles/tokens.css`, imported by `index.css`. Extended in `tailwind.config.ts`.

## Route Module Pattern

New API endpoints use route modules instead of adding to `server/routes.ts` directly:

1. Create an Express Router in `server/routes/<name>.ts`
2. Mount via `app.use(router)` in `server/routes.ts` (one-line addition)
3. One import + mount per module to minimize merge conflicts

Existing route modules: `ai.ts`, `summary.ts`, `transcript.ts`, `analytics-trends.ts`.

## Data Pipeline Endpoints

| Method | Path | Module | Purpose |
|---|---|---|---|
| `POST` | `/v1/ai/summarize/:callId` | `server/routes/ai.ts` | LLM summarization with rule-based fallback |
| `GET` | `/v1/leads/:id/summary` | `server/routes/summary.ts` | Aggregated AI summary across all calls |
| `GET` | `/v1/leads/:id/transcript` | `server/routes/transcript.ts` | Speaker-attributed transcript with `?search=` |
| `GET` | `/v1/analytics/pi-dashboard/trends` | `server/routes/analytics-trends.ts` | Daily trend counts for sparklines |

## P0 Guardrails

- `scripts/no-json-dump.sh` — CI check that greps `client/src/` for unguarded `JSON.stringify` / `<pre>` tags. Override with `// guardrail-allow: json-dump` comment.
- Debug payloads only render when `import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG_PAYLOAD === "1"`.

## GitLab CI

`.gitlab-ci.yml` runs `./scripts/verify` automatically on:
- Every merge request (pipeline source: `merge_request_event`)
- Every push to `main`

The CI job uses `node:20-bullseye` and caches `node_modules/` keyed by `package-lock.json`.
