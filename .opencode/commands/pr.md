---
description: Check, commit, push, and open a pull request for the selected changes.
agent: build
---

Create a pull request for: $ARGUMENTS

This invocation authorizes a commit, push, and PR for the stated scope. Accept
file paths or a completed task, plus optional title/body guidance. If arguments
omit scope, use the completed task in this conversation. Ask only if the intended
changes or target are unclear; do not treat all dirty files as implicitly selected.

Load delivery. Inspect repository instructions, status, staged and unstaged changes,
untracked files, recent commit style, remote/base branch, and existing PRs. Review
the full intended diff against the base, including existing branch commits. Preserve
unrelated work and staging; isolate selected hunks when a file contains mixed work.
Run npm run check and relevant acceptance checks. Fix in-scope failures before
publishing; report blockers rather than weakening checks or claiming success.

Create or reuse a feature branch containing only the intended scope; do not commit
on main. Stage explicit paths/hunks, inspect the staged diff, and commit with a
concise message. Push normally and use gh to create the PR, or update the matching
open PR rather than creating a duplicate. Use the requested title/body as guidance;
describe actual changes, acceptance evidence, checks, and remaining gaps. Check CI
status and return the real PR URL, commit, and local/remote check results separately.

Do not amend, force-push, merge, deploy, or start the next task unless separately
requested. Do not invoke this command again from its own run.
