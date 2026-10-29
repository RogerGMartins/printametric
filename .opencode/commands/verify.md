---
description: Run project checks and report acceptance-criteria evidence.
agent: qa
subtask: true
---

Verify this scope (or the current changes): $ARGUMENTS

Read docs/development.md. Run project_check or npm run check. Inspect the relevant
spec and identify additional build, browser, geometry, or slicer checks needed.
Run available checks and report pass/fail/unverified evidence per acceptance ID.
This command is verification-only: do not edit implementation, tests, or expected
outputs. Report reproducible failures to build for correction, then recheck fixes.
