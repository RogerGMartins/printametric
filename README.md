# Printametric

A planned self-hosted website with browser-based parametric 3D model generators.
The first generator will create modular wall art.

**Status:** T1–T4 implemented: a responsive workspace with Design, Print layout,
and Assembly navigation, display settings, and System/Light/Dark themes. Only the
theme persists across reloads. Preview and summaries show honest unavailable states.
Help/About dialogs include keyboard support and the full license. Model generation
and downloads come later.

The app currently uses the original T3 styling and theme dropdown. The selected
[Gridline visual study](artifacts/impeccable-trial/README.md) is a separate prototype.
Application implementation requires a reviewed technical plan.

## Develop

Install current Node.js 24 LTS, then run from the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). To check
the app and serve its production output:

```sh
npm run test:browser:install
npm run check
npm run build
npm run preview
```

Preview normally uses `http://localhost:4173` and is for local verification,
not production hosting. `npm run build` typechecks the app and creates `dist/`.
Use `npm run typecheck:app` for browser types or `npm run typecheck` for Node/tooling
types. See [development notes](docs/development.md#application-checks-and-debugging).
Browser installation is needed after `npm ci` on a new machine or a Playwright
upgrade. The shared check runs Node regressions and Chromium journeys against
served production output and the development build.

For the agent workflow, install OpenCode and run `opencode` from this directory.
OpenCode reloads command files automatically. Models and credentials come from
your own OpenCode setup.

## OpenCode workflow

| Command | Purpose |
| --- | --- |
| `/spec <feature>` | Specifier writes bounded contracts and acceptance criteria |
| `/design <spec path>` | Frontend defines layout, accessible controls, and UI states |
| `/plan-implementation <spec path>` | Write the technical task plan; stop for your review and approval |
| `/implement <spec path or task>` | Execute the approved plan and verify the working slice |
| `/verify <spec path>` | QA checks acceptance criteria and reports evidence and gaps |
| `/review <scope>` | Review correctness, geometry, accessibility, and tests |
| `/ship <scope>` | Check release readiness; publish only when explicitly requested |
| `/pr [files or task; title/body guidance]` | Check, commit, push, and open a PR for the selected changes |

Use `/pr` after reviewing a completed task. For example:
`/pr T2; title: Add foundation state and browser adapters`.
You can supply explicit file paths and description notes instead. With no arguments,
it uses the completed task in the conversation. Invocation authorizes the commit,
push, and PR for that scope; `/ship` remains the broader readiness command.

Specialists: `@specifier` for feature contracts, `@frontend` for editor design and
implementation, `@geometry` for parametric geometry, `@qa` for verification and
requested regression tests, and `@reviewer` for independent review.
Skills: `parametric-models` and `delivery`. The `project_check` custom
tool runs the same checks as CI with a fixed command and no shell arguments.
Built-in build/plan agents handle ordinary work. See [AGENTS.md](AGENTS.md).

Commands are workflow entry points; agents are the roles executing them.
`build` is the implementation/integration agent; `plan` is for read-only exploration
and planning. `/spec`, `/design`, `/verify`, and `/review` invoke their specialists.
Specialists can be addressed directly without creating a command for each role.

Review the technical plan in `docs/plans/<feature>.md` after `/plan-implementation`.
Request changes or approve it and run `/implement`. Planning does not start coding.

## Project documents

- [MVP roadmap and checklist](docs/mvp-roadmap.md)
- [Editor capabilities and design findings](docs/editor-capability-findings.md)
- [Product direction](docs/product.md)
- [Application stack and architecture](docs/architecture.md)
- [Development workflow and tooling](docs/development.md)
- [Contributing](CONTRIBUTING.md)

Selected application stack: **React + TypeScript + Vite**, **Three.js + React
Three Fiber**, plain CSS, and **Replicad/OpenCascade.js WASM** for CAD geometry.
Required exports: **STEP, STL, and 3MF**, derived from the same CAD model.
Start client-side with versioned JSON design files and static self-hosting.
React and Vite are installed; geometry and rendering dependencies arrive with
their implementation tasks.

## CI and deployment

GitHub Actions runs `npm ci`, installs Playwright Chromium and its system dependencies,
and runs `npm run check` on Linux and Windows for pushes and pull requests. Checks
validate the scaffold's local conventions, parse YAML, typecheck tooling, browser
tests, and the app, build production output, and run Node and browser regressions.
Failed browser runs retain traces, screenshots, and an HTML report as CI artifacts.
Dependabot checks npm dependencies and GitHub Actions weekly.

For ChatGPT-connected PR reviews, use the official Codex GitHub integration.
Repository review guidance is in `AGENTS.md`; account connection and automatic
reviews must be enabled in Codex. See [setup instructions](docs/development.md#codex-pull-request-reviews).

The application is intended for owner-managed hosting with portable build
artifacts. Hosting, a domain, and deployment automation will be chosen when the
first runnable application exists. Potential revenue includes ads or paid
services on the owner's official hosted instance.

## License

Source-available under the custom [Printametric Personal Use License](LICENSE).
Individuals may run and privately modify it for personal, noncommercial use.
Company use, commercial derivatives, redistribution, and public third-party
hosting require separate written permission. This is **not open source** in the
OSI sense. The owner reserves commercial hosting rights. Contributions include
the rights grant described in the license; read it before submitting a PR.
