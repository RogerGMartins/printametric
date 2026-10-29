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
| `/spec <feature>` | Write a bounded feature spec and acceptance criteria |
| `/implement <spec path or task>` | Implement and verify a vertical slice |
| `/verify` | Run checks and report evidence and gaps |
| `/review <scope>` | Review correctness, geometry, accessibility, and tests |
| `/ship <scope>` | Check release readiness; publish only when explicitly requested |

Specialists: `@geometry` for parametric geometry, `@reviewer` for independent
review. Skills: `parametric-models` and `delivery`. The `project_check` custom
tool runs the same checks as CI with a fixed command and no shell arguments.
Built-in build/plan agents handle ordinary work. See [AGENTS.md](AGENTS.md).

## Project documents

- [Product direction](docs/product.md)
- [Development workflow and tooling](docs/development.md)
- [Contributing](CONTRIBUTING.md)

## CI and deployment

GitHub Actions runs `npm ci` and `npm run check` on Linux and Windows for pushes
and pull requests. Checks validate the scaffold's local conventions, parse YAML,
typecheck the OpenCode tool, and run its tests. They do not yet test a website.
Dependabot checks npm dependencies and GitHub Actions weekly.

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
