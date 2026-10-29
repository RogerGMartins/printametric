---
name: delivery
description: Use when preparing a feature handoff, investigating GitHub CI failures, reviewing release readiness, or deploying Printametric.
---

# Delivery workflow

Read docs/development.md and the feature acceptance criteria. Run npm run check
or project_check; preserve failure output and fix root causes without weakening
checks. For CI failures, use gh run view/logs and reproduce the failing command.
Check the actual application build when one exists. For UI/geometry work include
the specialized verification in the definition of done.

Inspect git status and the full intended diff. Do not stage unrelated files or
secrets. Only when explicitly asked to commit, inspect recent commit style,
stage intended paths, and create a concise commit. Do not amend or force-push
unless explicitly requested. Before a PR, inspect all changes from its base.

For deployment, confirm target and configured build/runtime requirements, use
the documented deployment mechanism, and verify the deployed health/page after
the requested action. Do not invent deployment commands before hosting is chosen.
Report completed checks, links, and unresolved blockers without claiming that
local checks prove remote CI or deployment success.
