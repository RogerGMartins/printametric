---
description: Implement a specified feature as a verified vertical slice.
agent: build
---

Implement: $ARGUMENTS

Read AGENTS.md, docs/architecture.md, and the relevant spec. Inspect existing code
and dependencies. Resolve blocking contract decisions before creating geometry
or UI. For a new generator, implement validation and a small geometry/export test
before connecting the editor. Use the same accepted model result for both views.

You own integration. If delegation was explicitly requested, give each specialist
the spec path, acceptance IDs, owned files, shared contracts, and expected checks.
Parallelize only independent scopes; avoid concurrent edits to the same files.
Keep package/lockfile and shared-contract changes with the integrating agent.
Otherwise perform the work directly using the documented responsibilities.

Load matching skills, then implement the smallest complete slice satisfying
acceptance criteria. Add meaningful regression coverage, update affected docs,
and run npm run check plus relevant UI/mesh checks. Report acceptance evidence,
changed files, and gaps. Review findings must be fixed or explicitly resolved;
rerun checks affected by a fix before declaring completion.
Do not commit, push, or deploy unless the user explicitly requested it.
