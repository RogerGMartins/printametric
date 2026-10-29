# Working on Printametric

## Product

Build a self-hosted site containing parametric 3D-model tools. Start with modular
wall art. Read docs/product.md before product work. The repository is publicly
visible but personal-use source-available, not OSI open source. Preserve LICENSE
and the owner's commercial-hosting rights.

## Engineering

- Prefer the smallest working vertical slice and installed dependencies.
- Use TypeScript for the future web application. Select the UI/rendering stack
  when implementing the first slice; record the choice in docs/development.md.
- Keep geometry deterministic and independent of UI state. Use millimeters,
  explicit seeds, bounded parameters, and versioned saved designs.
- Preview and export must share geometry. Reject invalid inputs before expensive
  work; bound part counts and memory. Never silently export invalid geometry.
- Include accessible labels, keyboard operation, and visible error states.
- Do not copy third-party branding, source, assets, or proprietary algorithms.
- Add a meaningful regression check for nontrivial behavior. Run npm run check
  before handoff; report actual output and unverified behavior honestly.
- Keep generated models in artifacts/ unless intentionally adding small fixtures.
- Never commit credentials. Do not start hardware prints or billable generation
  as part of ordinary development or CI.

## Collaboration

Use built-in build/plan for routine work. Use the geometry and reviewer agents
when requested or when the user explicitly asks for delegated work. Do not
spawn agents automatically. Load skills only when their descriptions match.
Use /spec, /implement, /verify, /review, and /ship for the development lifecycle.
Only commit, push, create PRs, or deploy when explicitly requested.
