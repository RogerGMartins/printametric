# Development workflow

## Dependency follow-up (2026-10-29)

The OpenCode SDK brings four high-severity npm audit findings
through its Zod and Effect/TOML dependencies (resource-exhaustion advisories).
There is no compatible SDK upgrade reported by npm audit; its proposed fix is
an old SDK downgrade. Do not use audit fix --force blindly. Track an upstream
SDK release with corrected dependencies. These packages support development
tools; there is no deployed application or application dependency bundle yet.
The SDK's transitive ini package requires Node 24.15 or newer within Node 24;
use current Node 24 LTS to avoid engine warnings. Local checks also passed on
the existing Node 24.6 installation, which emits that warning during install.

## Current stack

Node.js 24, npm, TypeScript for OpenCode tools, Node's built-in test
runner, and YAML parsing for configuration checks. The web stack is undecided.
Keep one root npm lockfile; run installs from the root. The root dev dependencies
declare the official plugin SDK for typechecking. OpenCode may generate its own
.opencode/package.json and Bun lockfile matching its installed version; these
machine-managed files are ignored so startup cannot invalidate the npm lockfile.

## Lifecycle

1. Specify: use /spec to write docs/specs/<feature>.md with inputs, constraints,
   acceptance criteria, test strategy, and exclusions. Use /spec wall-art for
   the first slice. Record product assumptions explicitly.
2. Implement: use /implement with the spec path. Finish a runnable slice before
   adding abstractions. Update docs when decisions change.
3. Verify: npm run check is the shared local/CI gate. Add application build and
   geometry/browser tests to that gate as those components are introduced.
4. Review: use /review; prioritize reproducible bugs over stylistic preferences.
5. Ship: use /ship for readiness. Commit, push, PR creation, releases, and actual
   deployment still require an explicit request.

## Available tools

project_check runs the same Node entry point as npm run check, without a shell, with
a two-minute timeout. Run npm ci first. CI uses no model API keys or MCP servers.
The validator checks repository conventions, not the complete upstream OpenCode
schema. Validate new config fields against https://opencode.ai/config.json and
current documentation before adding them.

Use existing filesystem/Git tools and gh for GitHub tasks. Existing user-level
MCP connections remain available; no project credentials or machine-specific
paths are configured. Use browser automation for UI work when available and
mesh/slicer tools for geometry verification when needed. Report unavailable
checks instead of claiming success. No custom plugin is needed at this stage.

## Definition of done

- Acceptance criteria have evidence, including invalid/boundary inputs.
- npm run check succeeds; new runtime features have runnable tests and build checks.
- UI changes include keyboard/error-state checks and a reviewed screenshot.
- Export changes include mesh validation and a slicer import when available.
- Changes are documented; no secrets or accidental generated artifacts are staged.
- Handoff states what changed, what ran, and remaining limitations.

## Hosting direction

Keep the first generator client-side where practical. Avoid a hosted-service
dependency for basic design/export. Add deployment configuration for the actual
target once chosen; do not assume a particular cloud provider. The official
host may monetize under the owner's retained rights in LICENSE.
