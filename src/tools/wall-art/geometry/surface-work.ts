/** Worker-local accounting. Charge before native construction or numerical sampling;
 * the coordinator reserves these allowances across concurrent workers. */
import type { Kernel } from '../../../shared/geometry/kernel.ts';
import { DesignError } from '../model/budget.ts';

export const SURFACE_WORK_LIMITS = Object.freeze({ operations: 200_000, evaluations: 4_000_000, partEvaluations: 65_536 });
export function surfaceWork(operationLimit: number, evaluationLimit: number, check: () => void = () => {}) {
  if (!Number.isSafeInteger(operationLimit) || operationLimit < 1 || operationLimit > SURFACE_WORK_LIMITS.operations ||
      !Number.isSafeInteger(evaluationLimit) || evaluationLimit < 0 || evaluationLimit > SURFACE_WORK_LIMITS.evaluations)
    throw new DesignError('GENERATION_BUDGET', 'Invalid surface work reservation.');
  let operations = 0, evaluations = 0, partEvaluations = 0;
  return {
    get operations() { return operations; }, get evaluations() { return evaluations; },
    beginPart() { partEvaluations = 0; },
    operation() {
      if (operations === operationLimit) throw new DesignError('GENERATION_BUDGET', 'Native operation allowance exhausted. Increase pitch or simplify the surface.', 'pitch');
      check(); operations++;
    },
    evaluate(count: number) {
      if (!Number.isSafeInteger(count) || count < 0 || evaluations + count > evaluationLimit || partEvaluations + count > SURFACE_WORK_LIMITS.partEvaluations)
        throw new DesignError('SURFACE_BUDGET', 'Surface evaluation allowance exhausted. Increase pitch or reduce surface density.', 'density');
      check(); evaluations += count; partEvaluations += count;
    },
  };
}

/** Count actual kernel requests, including calls made inside Replicad. Constructors
 * and subsequent Build/Perform calls each consume work. Value/handle access does not. */
export function countedSurfaceKernel(kernel: Kernel, count: () => void): Kernel {
  const classes = new Map<PropertyKey, unknown>();
  const active = /^(BRep|GeomAPI_|Geom2dAPI_|GeomConvert_|Geom2dConvert_|Geom_BSpline|Geom2d_BSpline|ShapeFix_|STEPControl_)/;
  const action = /^(Build|Perform|Add|Sew|Init|Read|Write|Transfer|SurfaceProperties|VolumeProperties|LinearProperties|AddOptimal|Triangulation|CurveToBSplineCurve)/;
  return new Proxy(kernel, { get(target, key) {
    const value: unknown = Reflect.get(target, key);
    if (typeof key !== 'string' || !active.test(key) || typeof value !== 'function') return value;
    if (classes.has(key)) return classes.get(key);
    const wrapped = new Proxy(value, {
      construct(constructor, args) {
        count();
        const object = Reflect.construct(constructor, args);
        return new Proxy(object, { get(instance, name) {
          const method: unknown = Reflect.get(instance, name);
          if (typeof method !== 'function') return method;
          return (...arguments_: unknown[]) => {
            if (typeof name === 'string' && action.test(name)) count();
            return Reflect.apply(method, instance, arguments_);
          };
        } });
      },
      get(constructor, name) {
        const method: unknown = Reflect.get(constructor, name);
        if (typeof method !== 'function' || typeof name !== 'string' || !action.test(name)) return method;
        return (...args: unknown[]) => { count(); return Reflect.apply(method, constructor, args); };
      },
    });
    classes.set(key, wrapped); return wrapped;
  } });
}
