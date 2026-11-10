/** Whole-interval Bernstein composition bound with explicit floating error. */
type Polynomial = { values: readonly number[]; error: number };
const binomial: number[][] = [[1]];
function choose(n: number, k: number): number {
  while (binomial.length <= n) {
    const prior = binomial.at(-1)!;
    binomial.push(Array.from({ length: prior.length + 1 }, (_, i) => (prior[i - 1] ?? 0) + (prior[i] ?? 0)));
  }
  return binomial[n]![k]!;
}
const norm = (p: Polynomial) => Math.max(...p.values.map(Math.abs));
function multiply(a: Polynomial, b: Polynomial): Polynomial {
  const m = a.values.length - 1, n = b.values.length - 1;
  const values = Array.from({ length: m + n + 1 }, (_, k) => {
    let value = 0;
    for (let i = Math.max(0, k - n); i <= Math.min(m, k); i++) value += a.values[i]! * b.values[k - i]! * choose(m, i) * choose(n, k - i) / choose(m + n, k);
    return value;
  });
  return { values, error: a.error * norm(b) + b.error * norm(a) + a.error * b.error + 32 * Number.EPSILON * (Math.min(m, n) + 1) * norm(a) * norm(b) };
}
function add(a: Polynomial, b: Polynomial): Polynomial {
  return { values: a.values.map((value, i) => value + b.values[i]!), error: a.error + b.error + 4 * Number.EPSILON * (norm(a) + norm(b)) };
}
function halves(values: readonly number[]): [number[], number[]] {
  let row = [...values]; const left = [row[0]!], right = [row.at(-1)!];
  while (row.length > 1) { row = row.slice(0, -1).map((v, i) => (v + row[i + 1]!) / 2); left.push(row[0]!); right.unshift(row.at(-1)!); }
  return [left, right];
}
/** g and z describe one native Bezier span; h is evaluated at g. Null means
 * the complete-curve residual cannot be certified within the work/error bounds. */
export function boundCurveResidual(g: readonly number[], z: readonly number[], h: readonly number[], allowance: number, charge = () => {}): number | null {
  if (g.length < 2 || g.length > 26 || z.length !== g.length || h.length < 2 || h.length > 19 || ![...g, ...z, ...h, allowance].every(Number.isFinite) || allowance <= 0) throw Error('Invalid residual polynomial input.');
  const degree = (g.length - 1) * (h.length - 1);
  if (degree > 216) return null;
  const coordinate = { values: g, error: 64 * Number.EPSILON * Math.max(1, ...g.map(Math.abs)) };
  const complement = { values: g.map(value => 1 - value), error: coordinate.error + 4 * Number.EPSILON };
  let row: Polynomial[] = h.map(value => ({ values: [value], error: 0 }));
  while (row.length > 1) row = row.slice(0, -1).map((p, i) => add(multiply(p, complement), multiply(row[i + 1]!, coordinate)));
  const elevated = multiply({ values: z, error: 0 }, { values: Array<number>(degree - z.length + 2).fill(1), error: 0 });
  const residual = add(row[0]!, { values: elevated.values.map(value => -value), error: elevated.error });
  function bound(values: readonly number[], depth: number): number | null {
    charge();
    const maximum = Math.max(...values.map(Math.abs)) + residual.error + 4096 * Number.EPSILON * Math.max(1, ...z.map(Math.abs));
    if (maximum <= allowance) return maximum;
    if (depth === 8 || Math.abs(values[0]!) > allowance || Math.abs(values.at(-1)!) > allowance) return null;
    const [left, right] = halves(values), a = bound(left, depth + 1); if (a === null) return null;
    const b = bound(right, depth + 1); return b === null ? null : Math.max(a, b);
  }
  return bound(residual.values, 0);
}
