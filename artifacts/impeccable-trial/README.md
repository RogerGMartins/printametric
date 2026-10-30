# Gridline visual study

This is a reviewable prototype, separate from the application. The user selected
Gridline, a full-window preview below a cobalt header, with one collapsible
settings panel across the bottom. The panel starts closed and opens over the
canvas. The other generated directions retain the initial comparison studies.

## Run

From the repository root, after `npm ci`:

```sh
node artifacts/impeccable-trial/build-previews.mjs
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `/artifacts/impeccable-trial/index.html?direction=gridline&standalone=1`.
Omit `standalone=1` to show the comparison navigation.

Generated HTML, screenshots, and detector output are ignored. The generator,
selected layout, wrapper, prototype copy, and browser verification source are
retained for review. There is no application dependency on these files.

## Verification

`verify-gridline.cjs` is an async function expression for the browser tool's
`browser_run_code_unsafe` `filename` input. Run it against Vite on port 5173.
It checks both themes, full-window bounds (including wide windows), the single
disclosure, keyboard control, view-specific groups, retained settings, and modal
focus. Its screenshots are written beside this file through relative paths.
It is not part of `npm run check`; application browser CI remains a separate task.

The prototype does not generate models, persist preferences, or implement browser
history for view changes. Help describes prototype behavior. About imports the
root LICENSE without modification. Application implementation still requires an
approved technical plan.
