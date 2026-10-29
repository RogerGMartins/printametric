---
description: Verify readiness and perform only explicitly requested publishing actions.
agent: build
---

Prepare delivery for: $ARGUMENTS

Load delivery. Inspect status, diff, acceptance criteria, and CI. Run the required
checks and summarize readiness. This command alone does not authorize commits,
pushes, PR creation, releases, or deployments; perform those only when explicitly
requested in the arguments or conversation. Return actual URLs when applicable.
