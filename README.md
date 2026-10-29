# Printametric

A planned self-hosted website with browser-based parametric 3D model generators.
The first generator will create modular wall art.

**Status:** development scaffolding only; the web application is not implemented yet.

## Develop

Install Node.js 24 and OpenCode, then run from the repository root:

```sh
npm ci
npm run check
opencode
```

Quit and restart OpenCode after changing its configuration, agents, commands,
skills, or tools. Models and credentials come from your own OpenCode setup.

## OpenCode workflow

| Command | Purpose |
| --- | --- |
| `/spec <feature>` | Specifier writes bounded contracts and acceptance criteria |
| `/design <spec path>` | Frontend defines layout, accessible controls, and UI states |
| `/implement <spec path or task>` | Implement and verify a vertical slice |
| `/verify <spec path>` | QA checks acceptance criteria and reports evidence and gaps |
| `/review <scope>` | Review correctness, geometry, accessibility, and tests |
| `/ship <scope>` | Check release readiness; publish only when explicitly requested |

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

## Project documents

- [MVP roadmap and checklist](docs/mvp-roadmap.md)
- [Product direction](docs/product.md)
- [Application stack and architecture](docs/architecture.md)
- [Development workflow and tooling](docs/development.md)
- [Contributing](CONTRIBUTING.md)

Selected application stack: **React + TypeScript + Vite**, **Three.js + React
Three Fiber**, plain CSS, and **Replicad/OpenCascade.js WASM** for CAD geometry.
Required exports: **STEP, STL, and 3MF**, derived from the same CAD model.
Start client-side with versioned JSON design files and static self-hosting.
The web application and its dependencies will be added with the first feature.

## CI and deployment

GitHub Actions runs `npm ci` and `npm run check` on Linux and Windows for pushes
and pull requests. Checks validate the scaffold's local conventions, parse YAML,
typecheck the OpenCode tool, and run its tests. They do not yet test a website.
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
