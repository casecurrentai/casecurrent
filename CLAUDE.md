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

## GitLab CI

`.gitlab-ci.yml` runs `./scripts/verify` automatically on:
- Every merge request (pipeline source: `merge_request_event`)
- Every push to `main`

The CI job uses `node:20-bullseye` and caches `node_modules/` keyed by `package-lock.json`.
