# Agent Operating Rules (CaseCurrent)

## Authority
- Only ONE agent is allowed to change code per task (the "executor").
- Every change must be done on a new branch and delivered as a PR/MR.

## Hard rules
- No broad refactors. Change only what the task requires.
- Keep diffs small and reviewable.
- Do not rename folders, move files, or reformat entire files unless explicitly required.
- Update docs when behavior or setup changes.

## Required end-of-task checklist
- Run: ./scripts/verify
- Ensure it passes.
- Summarize:
  - What changed
  - How you tested
  - Risks / edge cases
  - Rollback plan (if applicable)
