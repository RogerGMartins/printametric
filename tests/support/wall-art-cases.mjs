// Phase-01 executable input cases and traceability. Later phases are not covered here.
export const parameterCases = {
  width: { normal: 300, boundaries: [80, 500], invalid: [79, 501], edge: 499.123 },
  height: { normal: 300, boundaries: [80, 500], invalid: [79, 501], edge: 499.123 },
  pitch: { normal: 100, boundaries: [50, 200], invalid: [49, 201], edge: 75.123 },
  gap: { normal: 3, boundaries: [2.5, 6], invalid: [2.49, 6.01], edge: 3.123 },
  baseThickness: { normal: 20, boundaries: [10, 40], invalid: [9.99, 40.01], edge: 10.123 },
  reliefHeight: { normal: 40, boundaries: [0, 120], invalid: [-0.01, 120.01], edge: 0.001 },
  topRatio: { normal: 0.5, boundaries: [0.1, 1], invalid: [0.099, 1.001], edge: 0.12345 },
  seed: { normal: 5000, boundaries: [1, 9999], invalid: [0, 10000, 1.5], edge: 2 },
};
export const coverage = [
  { ac: [1, 2, 3, 8], controls: Object.keys(parameterCases), test: 'core validation: every parameter boundary, finite types, exact keys and synthetic budgets', file: 'tests/wall-art-core.test.mjs' },
  { ac: [3, 8], controls: ['JSON load', 'JSON save'], test: 'editable JSON rejects versions, depth, bytes, types and unsafe keys', file: 'tests/wall-art-core.test.mjs' },
  { ac: [1, 2, 4, 5, 8], controls: ['STEP', 'STL', '3MF', 'relief zero', 'ratio one', 'inert seed'], test: 'canonical CAD, deterministic boundaries, shared meshes and independent round trips', file: 'tests/wall-art-core.test.mjs' },
  { ac: [6, 7, 10], controls: ['cancel generation', 'cancel export', 'retry', 'watchdog', 'crash'], test: 'hard cancellation, crash and watchdog invalidate handles and require restoration', file: 'tests/wall-art-worker.test.mjs' },
  { ac: [6, 7], controls: ['Enter/blur', 'latest queue', 'invalid load retention'], test: 'worker latest-only queue rejects stale results and preserves failed accepted snapshots', file: 'tests/wall-art-worker.test.mjs' },
  { ac: [6, 7], controls: ['export capture', 'selected serializer'], test: 'export pins one revision while edits queue; generation cancel does not cancel export', file: 'tests/wall-art-worker.test.mjs' },
  { ac: [7, 10], controls: ['STEP worker retirement'], test: 'STEP completion retires native heap and preserves the latest queued design', file: 'tests/wall-art-worker.test.mjs' },
  { ac: [1, 4, 6, 8, 9], controls: ['camera', 'Revert', 'Review model settings', 'JSON upload/download', 'format buttons', 'navigation retention'], test: 'core controls, retained revisions, JSON recovery, camera and all assembled exports', file: 'tests/browser/wall-art-core.spec.ts' },
  { ac: [7, 9, 10], controls: ['initialization failure', 'Retry CAD', 'save ungenerated'], test: 'failed kernel retains controls and allows explicit ungenerated save; Retry recovers', file: 'tests/browser/wall-art-core.spec.ts' },
  { ac: [9, 10], controls: ['WebGL fallback'], test: 'CAD and exports remain usable without WebGL', file: 'tests/browser/wall-art-core.spec.ts' },
];
export const deferred = ['preset catalogue', 'random layouts', 'colours', 'angle', 'mounting', 'packing', 'library'];
