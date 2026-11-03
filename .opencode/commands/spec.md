---
description: Write a small, testable feature specification before implementation.
agent: specifier
subtask: true
---

Specify this feature: $ARGUMENTS

Read AGENTS.md, docs/product.md, docs/development.md, and docs/architecture.md.
Inspect existing code and follow the specifier's contract and acceptance format.
Write docs/specs/<feature>.md with problem, user flow, scope, parameter contracts,
acceptance criteria, edge cases, test plan, and unresolved decisions. Distinguish
confirmed requirements from proposals. Before writing, follow the specifier's
mode-selection step: ask whether the user wants guided questions or freedom to
draft with only blocking questions. Wait for their choice unless already stated
for this task. Mark reasonable defaults. Follow the writing and visual explanation
rules in AGENTS.md. Include a concise documentation-impact section: affected paths,
required changes, and unresolved decisions for architecture, product/roadmap, setup,
usage, or development docs as relevant. State when no shared-doc change is needed.
The specifier identifies these changes; build applies them through the reviewed
implementation plan. Do not implement the feature as part of this command.
