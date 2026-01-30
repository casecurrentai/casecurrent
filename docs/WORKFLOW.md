# Workflow Guide

## Branch Naming Conventions

| Prefix | Use for |
|---|---|
| `feat/` | New features or capabilities |
| `fix/` | Bug fixes |
| `chore/` | Tooling, CI, dependencies, docs |
| `refactor/` | Code restructuring without behavior change |

Branch names should be lowercase, kebab-case, and descriptive:
`feat/user-auth-flow`, `fix/null-pointer-dashboard`, `chore/upgrade-node-20`.

## Definition of Done

A branch is ready for MR when all of these are true:

- [ ] `./scripts/verify` passes locally (exit code 0)
- [ ] `git status` shows a clean working tree (no uncommitted changes)
- [ ] MR is created targeting `main` via `git push -o merge_request.create`
- [ ] MR title follows conventional commits: `type: short description`

## How Verify Works

The `scripts/verify` script is the single quality gate for this repo. It runs:

1. **Dependency install** — detects npm/yarn/pnpm and installs.
2. **lint** — runs the `lint` script from `package.json`. Must pass.
3. **check** — runs the `check` script (typically `tsc`). Advisory only — a failure is logged with a warning but does not block the pipeline.
4. **typecheck** — runs `typecheck` if defined. Must pass.
5. **test** — runs `test` if defined. Must pass.
6. **build** — runs `build` if defined. Must pass.

The script uses `set -euo pipefail` so any non-advisory failure stops execution immediately.

## GitLab CI

`.gitlab-ci.yml` runs verify automatically in two situations:

- **Merge request pipelines** — triggered on every MR push (`merge_request_event`).
- **Main branch** — triggered on every push to `main`.

Configuration:
- Image: `node:20-bullseye`
- Cache: `node_modules/` keyed by `package-lock.json`
- Script: `chmod +x ./scripts/verify && ./scripts/verify`

## Creating a Merge Request

Use `git push` options to create the MR in one step:

```bash
git push -u origin HEAD \
  -o merge_request.create \
  -o merge_request.target=main \
  -o merge_request.title="chore: description here"
```

The push output will contain the MR URL. Always report this URL.

## Common GitLab MR Blockers

| Issue | Cause | Resolution |
|---|---|---|
| No Merge button | Insufficient permissions (Developer vs. Maintainer role) | Ask a Maintainer to merge or grant permissions |
| "Pipeline must succeed" | CI pipeline has not passed yet | Wait for pipeline; check job logs if failed |
| "Requires N approval(s)" | Project requires code review approvals | Request review from a team member |
| "Has unresolved discussions" | Review threads not marked resolved | Resolve each thread or ask reviewer |
| "Branch is out of date" | Target branch has new commits | Click "Update branch" or rebase locally |
| Merge conflicts | Conflicting changes on target branch | Resolve conflicts locally, push, and re-verify |

When blocked by any of these, report the exact message and stop.
