---
description: Write a technical implementation plan and stop for user review.
agent: build
---

Plan implementation for: $ARGUMENTS

Read AGENTS.md, docs/development.md, docs/architecture.md, and the relevant spec.
Inspect existing code, dependencies, and checks. Resolve blocking questions or
mark them explicitly; do not invent product decisions.

Create or update docs/plans/<feature>.md with status Awaiting user review. Keep it
concise: link requirements; define module responsibilities, data flow, interfaces,
validation/error handling, and dependency changes. Split work into ordered tasks
with dependencies, affected files, acceptance IDs, and concrete completion checks.
Include enough technical detail to resolve major implementation choices without
prescribing every line of code. Record proposed shared architecture changes in
docs/architecture.md, clearly marked as proposals pending this plan's approval.

Resolve the spec's documentation impacts against current shared docs. Include
required documentation updates in the task list with paths and completion checks.
Surface conflicts with product scope or architecture for user review. Architecture
proposals can be drafted here; setup/usage and completion-status updates belong to
implementation, when actual behavior and commands can be verified.

Edit only the plan and relevant architecture documentation. Do not implement code,
install dependencies, change configuration, or delegate unless explicitly requested.
Run npm run check for documentation changes and report its actual result.

End with the plan path, a short summary of technical decisions/tasks, and unresolved
questions. Ask the user to review and approve or request changes. STOP here: do not
start implementation in this invocation, even if the plan has no blockers. A later
explicit request to implement the reviewed plan authorizes the implementation phase.
