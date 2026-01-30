# Agent Task Packet Templates

## Claude Code Task Packet (Terminal-First)

Use this template when delegating a task to Claude Code via the CLI.

```
You are working in the git repo at /Users/mikesimmons/CaseCurrent-project.

Goal: <one-sentence description of what to accomplish>

Constraints:
- <list scope limits, e.g. "Do not change application logic">
- <list file boundaries, e.g. "Only modify files under src/routes/">
- Must pass ./scripts/verify.

Steps:
A) Print current repo state:
   - git status -sb
   - git log -1 --oneline --decorate

B) Create branch from main: <prefix>/<branch-name>

C) Make changes:
   - <specific file changes with enough detail to implement>

D) Run ./scripts/verify

E) Commit with message: "<type>: <description>"

F) Push and create MR:
   git push -u origin HEAD \
     -o merge_request.create \
     -o merge_request.target=main \
     -o merge_request.title="<type>: <description>"

Output the MR URL. Stop if any command fails and show exact output.
Do not ask questions unless blocked.
```

## Cursor Task Packet (IDE-First)

Use this template when delegating a task to Cursor via its AI chat.

```
Context: CaseCurrent-project monorepo. Read CLAUDE.md for repo rules.

Task: <one-sentence description>

Files to modify:
- <path/to/file1> — <what to change>
- <path/to/file2> — <what to change>

Files to read first (do not modify):
- <path/to/reference> — <why it matters>

Acceptance criteria:
- [ ] <specific testable outcome>
- [ ] ./scripts/verify passes
- [ ] No unrelated changes

After editing, run in terminal:
  ./scripts/verify
  git add <files> && git commit -m "<type>: <description>"
  git push -u origin HEAD -o merge_request.create -o merge_request.target=main
```

## MR Description Template

Use this when creating merge requests, either manually or via `-o merge_request.description`.

```markdown
## Summary

<1-3 bullet points describing what changed and why>

## Changes

- `path/to/file` — <what was changed>

## Verify

- [ ] `./scripts/verify` passes locally
- [ ] CI pipeline passes
- [ ] No unrelated file changes

## Notes

<anything the reviewer should know: advisory tsc warnings, migration steps, etc.>
```
