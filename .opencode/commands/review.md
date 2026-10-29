---
description: Review a diff or feature for actionable correctness problems.
agent: reviewer
subtask: true
---

Review: $ARGUMENTS

If no scope is supplied, inspect staged and unstaged changes, including untracked
source files. Compare against acceptance criteria. Return actionable findings
with severity, file/line, failure scenario, and minimal correction. Do not edit.
