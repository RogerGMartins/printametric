# Development workflow

## Dependency follow-up (2026-10-29)

The OpenCode SDK brings four high-severity npm audit findings
through its Zod and Effect/TOML dependencies (resource-exhaustion advisories).
There is no compatible SDK upgrade reported by npm audit; its proposed fix is
an old SDK downgrade. Do not use audit fix --force blindly. Track an upstream
SDK release with corrected dependencies. These packages support development
tools; they are excluded from the application bundle. There is no deployed app.
The SDK's transitive ini package requires Node 24.15 or newer within Node 24;
use current Node 24 LTS to avoid engine warnings. Local checks also passed on
the existing Node 24.6 installation, which emits that warning during install.

## Current stack

Installed tooling: Node.js 24, npm, TypeScript, Node's built-in test runner, and
YAML parsing for configuration checks. T1 installs React 19.3.1, Vite 8.3.5, and
the official React plugin 6.1.2. The planned geometry stack uses Three.js/React
Three Fiber for preview and
Replicad/OpenCascade.js WASM for independent CAD geometry and STEP/STL/3MF exports.
See [architecture.md](architecture.md) for boundaries and the export feasibility gate.
Only the runnable shell is implemented; geometry dependencies are not installed.
Keep one root npm lockfile; run installs from the root. The root dev dependencies
declare the official plugin SDK for typechecking. OpenCode may generate its own
.opencode/package.json and Bun lockfile matching its installed version; these
machine-managed files are ignored so startup cannot invalidate the npm lockfile.

### Application checks and debugging

- `npm run dev` starts Vite with source maps and React StrictMode checks.
- `npm run typecheck:app` checks browser code using `tsconfig.app.json`.
  `npm run typecheck` checks Node-only tools and `vite.config.ts` using `tsconfig.json`.
- `npm run build` checks app types and creates static output in `dist/`.
  `npm run preview` serves that output locally; rebuild after source changes.
- `npm run check` runs scaffold validation, both typechecks, the production build,
  and existing Node tests. CI uses this same gate on Linux and Windows. Browser
  test installation and automated journeys will be added in T5.
- To debug startup, open the dev URL and the browser's Sources panel, find
  `src/main.tsx` or `src/app/App.tsx`, set a breakpoint, and reload. Check the
  browser console and Vite terminal for failures. StrictMode can render twice
  in development. Production output does not contain source maps or debug fixtures.

T1's only keyboard action is `Skip to workspace`: press Tab, then Enter, and
confirm focus moves to the main content. Disable JavaScript and reload to check
the visible startup requirement. The full workspace/error-state journeys arrive
with later tasks; T1 does not implement preference validation or storage.

## Lifecycle

| Stage | Entry point / owner | Required output |
| --- | --- | --- |
| Specify | `/spec wall-art` -> specifier | `docs/specs/wall-art.md`: bounded parameter and mesh contracts, acceptance IDs, exclusions, test plan |
| Design UI | `/design docs/specs/wall-art.md` -> frontend | UI section in that same spec: layout, controls, keyboard/mobile behavior, states |
| Plan implementation | `/plan-implementation docs/specs/wall-art.md` -> build | `docs/plans/<feature>.md`: technical decisions, ordered tasks, dependencies, files, and checks; stop for user review |
| Approve plan | User reviews the plan and requests changes or implementation | Explicit approval of the current plan before coding |
| Implement | `/implement docs/specs/wall-art.md` -> build | Execute the approved plan as a verified vertical slice |
| Verify | `/verify docs/specs/wall-art.md` -> qa | Per-acceptance-ID pass/fail/unverified evidence, browser/mesh checks where relevant |
| Review | `/review <diff or PR scope>` -> reviewer | Reproducible correctness findings; read-only |
| Deliver | `/ship <scope>` -> build | Readiness, actual checks, and remaining gaps; publish only when requested |

Use these stages for meaningful features; small fixes need only relevant steps.
Do not make a separate spec, ceremony, or agent call for every edit. `/design`
is for UI changes; a geometry-only fix does not need a UI design pass.

Keep each decision in one place: the spec states required behavior and acceptance;
`docs/architecture.md` owns shared module/data-flow decisions; the implementation
plan explains the technical work. Use concise task tables with dependencies, files,
contracts, and completion checks. Link to requirements instead of repeating them.
`/plan-implementation` writes the plan and stops with a short review summary. The
user reviews `docs/plans/<feature>.md` and approves it or requests changes. Planning
never continues into coding in the same invocation. A later explicit request to
implement the presented plan counts as approval; a plan file alone does not.
`/implement` requires that approval and stops if the plan or approval is missing.
Keep the plan current; material scope, architecture, or contract changes require
renewed review. Small fixes can use a reviewed inline plan. Read-only plan mode
can explore options; build records the document. Neither phase authorizes delegation.

Documentation follows the same handoff: the spec lists affected document paths,
required changes, and unresolved decisions; the technical plan assigns updates to
tasks. Build drafts shared architecture proposals during planning and applies the
approved decisions and verified setup/usage/status updates during implementation.
Check architecture, product/roadmap, README, and development docs as relevant; avoid
duplicating them in the spec. Record no change when none is needed. A milestone is
not complete while required documentation updates are unresolved.

Resolve blocking contract decisions before implementation. Build starts with
validation and a small headless geometry/export path, then connects the editor.
`npm run check` remains the shared local/CI gate; extend it with app build and
geometry/browser tests as those components are introduced. QA verifies the
implementation; reviewer independently inspects the diff. Build fixes failures
and reruns the affected checks. Neither AI review replaces CI.

### Delegation and handoffs

Invoking a specialist command requests that specialist, not a multi-agent fan-out.
For parallel work, explicitly request delegation from build, for example:
`/implement docs/specs/wall-art.md; delegate frontend and geometry after agreeing
the shared contract`. Build remains responsible for the integrated result.

Each assignment states the spec path, acceptance IDs, input/output contracts,
owned file paths, required checks, and dependencies on other work. Build owns
package manifests, lockfiles, and shared-contract edits during parallel work.
Geometry owns validation/generation/export; frontend owns the editor/preview;
QA owns requested test additions. Assign test paths explicitly to avoid overlap.
Start dependent work only after its contract is stable; a stub is not evidence
that integration works. Specialists return changes and blockers to build without
launching nested agents or overwriting another scope.

Handoff format: acceptance IDs covered; files changed; contract changes requested;
commands/results and artifact paths; blockers and unverified behavior. Verification
may be summarized in the task/PR; no separate report file is required by default.

## Available tools

### Agent responsibilities

- Built-in `plan`: explore requirements and technical options without editing.
- Built-in `build`: own implementation, shared contracts/dependencies, integration,
  fixes, and delivery; perform routine work directly.
- `specifier`: write feature contracts and testable acceptance criteria; edit only
  `docs/specs/`, not application code.
- `frontend`: editor UX, visual design, accessible controls, and browser behavior.
- `geometry`: deterministic generation, collision/printability checks, and export.
- `qa`: verify against acceptance criteria; add regression tests only when requested.
  `/verify` itself is verification-only and does not modify tests or application code.
- `reviewer`: independent, read-only correctness review.

Commands provide repeatable task prompts to these roles. `/spec` now invokes a
specifier with a limited document-editing scope; built-in plan remains read-only.
`/plan-implementation` uses build with a documentation-only task and a mandatory
review stop. `/implement` uses build to execute the user-approved plan.
Use specialists directly or delegate only when requested. Skills supply reusable
procedures; tools execute concrete operations.

### Local checks

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

## Codex pull request reviews

Use the official ChatGPT/Codex GitHub integration. It runs independently of
OpenCode's local reviewer and the deterministic GitHub Actions CI checks.
No OpenAI API key or custom Actions workflow is required for this route.

Account setup (not enabled by adding these files):

1. Sign in to ChatGPT/Codex and connect GitHub. Grant the integration access to
   RogerGMartins/printametric; select only this repository if that is the intended scope.
2. Open https://chatgpt.com/settings/code-review, select this repository, and
   enable Automatic review under Review code. Check personal Automatic review
   preferences and the Review trigger setting as well.
3. Confirm the account's review availability and usage limits before enabling
   automatic runs. This uses Codex account entitlement, not GitHub CI minutes alone.
4. On a representative PR, comment `@codex review`. Confirm a reaction and a
   completed review from the Codex connector. A configured toggle alone does not
   verify end-to-end operation.

Codex reads applicable `AGENTS.md` files, including the root Code Review Rules.
Those rules must be published with the repository changes to be available on
GitHub. Keep CI as a separate gate; AI reviews are advisory and can miss issues.

Setup verified on 2026-10-29 by reloading the repository's Codex settings:

- Repository connected; automatic code review enabled for all PRs, on every push.
- Exhaustive review off to avoid repeated review passes.
- Automatic security review enabled for all PRs whenever code review runs.
- Security reporting thresholds: High for automatic reviews, Medium for manual.

The repository-specific settings override personal review preferences. Settings
verification alone is not an end-to-end test: confirm a completed Codex review on
a representative PR and record its result there. Codex can use the review rules
once the branch containing AGENTS.md is published on GitHub.

Official documentation: https://developers.openai.com/codex/integrations/github
