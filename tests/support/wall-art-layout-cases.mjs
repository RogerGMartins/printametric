// Executable field inventory for schema 2; geometry-dependent failures belong to CAD tests.
export const layoutParameterCases = {
  width: [500, [80, 2000], [79.99, 2000.01], 499.123],
  height: [500, [80, 2000], [79.99, 2000.01], 501.123],
  pitch: [50, [50, 200], [49.99, 200.01], 50.123],
  gap: [2.5, [2.5, 6], [2.49, 6.01], 2.543],
  baseThickness: [10, [10, 40], [9.99, 40.01], 10.123],
  reliefHeight: [20, [0, 120], [-0.01, 120.01], 0.01],
  topRatio: [0.12, [0.1, 1], [0.099, 1.001], 0.123],
  seed: [1, [1, 9999], [0, 10000, 1.5], 5000],
  engravingDepth: [1, [0, 3], [-0.01, 3.01], 1.123],
  numeralRatio: [0.34, [0.1, 0.6], [0.099, 0.601], 0.333],
};
