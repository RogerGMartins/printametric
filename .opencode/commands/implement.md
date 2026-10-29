---
description: Implement a specified feature as a verified vertical slice.
agent: build
---

Implement: $ARGUMENTS

Read AGENTS.md and the relevant spec. Inspect existing code and dependencies.
Load matching skills, then implement the smallest complete slice satisfying
acceptance criteria. Add meaningful regression coverage, update affected docs,
and run npm run check plus relevant UI/mesh checks. Report evidence and gaps.
Do not commit, push, or deploy unless the user explicitly requested it.
