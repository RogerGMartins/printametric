---
description: Implement a user-approved technical plan as a verified vertical slice.
agent: build
---

Implement: $ARGUMENTS

Read AGENTS.md, docs/architecture.md, and the relevant spec. Inspect existing code
and dependencies. Resolve blocking contract decisions before creating geometry
or UI. For a new generator, implement validation and a small geometry/export test
before connecting the editor. Use the same accepted model result for both views.

Before application edits, read docs/plans/<feature>.md and confirm the user approved
the current plan. An explicit request to implement a plan already presented for
review counts as approval; the file's existence or agent-written status alone does
not. If the plan is missing, direct the user to /plan-implementation and stop. If
approval is unclear, ask and stop. Do not write a plan and implement it in one turn.
Record actual user approval in the plan, then follow its tasks and keep it current.
Material changes to scope, architecture, or contracts require renewed review before
implementing the affected work. For small fixes, a reviewed inline plan is sufficient.

You own integration. If delegation was explicitly requested, give each specialist
the spec path, acceptance IDs, owned files, shared contracts, and expected checks.
Parallelize only independent scopes; avoid concurrent edits to the same files.
Keep package/lockfile and shared-contract changes with the integrating agent.
Otherwise perform the work directly using the documented responsibilities.
Apply the KISS, code ownership, comments, and debugging rules in AGENTS.md. Keep
tool-specific behavior local and shared modules independent of tools and the shell.
Document non-obvious behavior and verify the debugging steps added with the feature.

Load matching skills, then implement the smallest complete slice satisfying
acceptance criteria. Add meaningful regression coverage and complete the plan's
documentation tasks: reconcile approved architecture with the actual implementation,
verify documented setup/usage commands, and update roadmap status only from evidence.
Resolve or report any documentation impacts discovered during implementation,
and run npm run check plus relevant UI/mesh checks. Report acceptance evidence,
changed files, and gaps. Review findings must be fixed or explicitly resolved;
rerun checks affected by a fix before declaring completion.
Do not commit, push, or deploy unless the user explicitly requested it.
