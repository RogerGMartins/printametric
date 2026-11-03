/** P0 provisional numerical contracts; these are not final visual/CAD approval. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMETERS_V3 as defaults, NUMERIC_RULES_V3, PARAMETER_NAMES_V3, BOOLEAN_NAMES_V3, SURFACE_FAMILIES } from '../src/tools/wall-art/model/parameters-v3.ts';
import { validateParametersV3, layoutParametersV3 } from '../src/tools/wall-art/model/validation-v3.ts';
import { surfaceRandomWords } from '../src/tools/wall-art/model/surface-random.ts';
import { createSurfaceField } from '../src/tools/wall-art/geometry/surface-fields.ts';
import { enumerateCells } from '../src/tools/wall-art/geometry/layouts/cells.ts';
import { validateDesignDefinition } from '../src/tools/wall-art/model/definition.ts';

const field = (overrides = {}) => createSurfaceField({ ...defaults, ...overrides });
const near = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('checkpoint parameter boundary validates every numeric and inactive field without quantization', () => {
  assert.deepEqual(validateParametersV3(defaults), defaults);
  assert.notEqual(validateParametersV3(defaults), defaults);
  for (const [name, rule] of Object.entries(NUMERIC_RULES_V3)) {
    for (const value of [rule.min, rule.max]) assert.equal(validateParametersV3({ ...defaults, [name]: value })[name], value);
    for (const value of [rule.min - 0.001, rule.max + 0.001, NaN, Infinity, -Infinity, '1', null, true]) {
      assert.throws(() => validateParametersV3({ ...defaults, family: 'dome', depth: 0, [name]: value }), { code: 'PARAMETER', field: name });
    }
    if (['seed', 'surfaceSeed', 'spiralArms'].includes(name)) {
      assert.throws(() => validateParametersV3({ ...defaults, [name]: rule.min + 0.5 }), { field: name });
    } else {
      const value = rule.min + (rule.max - rule.min) * 0.1234567;
      assert.equal(validateParametersV3({ ...defaults, [name]: value })[name], value);
    }
  }
  for (const name of BOOLEAN_NAMES_V3) for (const value of ['false', 0, null, undefined]) {
    assert.throws(() => validateParametersV3({ ...defaults, [name]: value }), { field: name });
  }
  for (const name of ['family', 'layout', 'outline']) assert.throws(() => validateParametersV3({ ...defaults, [name]: 'unknown' }), { field: name });
  assert.throws(() => validateParametersV3({ ...defaults, plinthEnabled: false, minimumRelief: 0, depth: 0 }), { code: 'FEATURE_SIZE' });
  assert.equal(validateParametersV3({ ...defaults, minimumRelief: 0, depth: 0 }).plinthEnabled, true);
});

test('checkpoint rejects malformed records and stays outside production version dispatch', () => {
  for (const name of PARAMETER_NAMES_V3) {
    const missing = { ...defaults }; delete missing[name];
    assert.throws(() => validateParametersV3(missing), { code: 'FIELDS' });
  }
  for (const extra of [{ reliefHeight: 20 }, { modelSchemaVersion: 3 }, { unexpected: 0 }]) {
    assert.throws(() => validateParametersV3({ ...defaults, ...extra }), { code: 'FIELDS' });
  }
  let read = false;
  const accessor = { ...defaults };
  Object.defineProperty(accessor, 'surfaceSeed', { enumerable: true, get() { read = true; return 1; } });
  assert.throws(() => validateParametersV3(accessor), { code: 'FIELDS' }); assert.equal(read, false);
  for (const bad of [null, [], Object.create(defaults)]) assert.throws(() => validateParametersV3(bad));
  for (const versions of [[3,3], [2,3], [3,2]]) assert.throws(() => validateDesignDefinition({
    modelSchemaVersion: versions[0], generatorVersion: versions[1], parameters: defaults,
  }), { code: 'VERSION' });
});

// Literal word vectors pin the proposed UTF-8 key and draw order for review.
const vectors = {
  dunes: [[908993162,809921842,2036328632],[641011860,1768115507,692590631],[3175552319,3447599592,2960953484]],
  ridges: [[266696782],[2592949211],[2992120585]],
  random: [[1852698298,2790135328,3026656547,3252840211,802328289,17553595,1430226167,2857236556,1040545926,4241800195,1028701779,793990317],
    [709985994,1953816950,2211475447,3829657196,226672639,2142233776,2999608050,2700849794,3812835180,3697689877,2626475381,3142456682],
    [4273481,3334736794,1391687681,3576718011,2664304186,334631753,2559723375,1181807087,2307381534,1592472330,1641882600,2571194243]],
};
test('provisional relief stream vectors are fixed and distinct from layout ownership', () => {
  for (const [family, expected] of Object.entries(vectors)) [1,5000,9999].forEach((seed, i) => {
    assert.deepEqual(surfaceRandomWords(family, seed), expected[i]);
  });
  for (const seed of [0,10000,1.5,NaN,Infinity,'1']) assert.throws(() => surfaceRandomWords('random', seed), { code: 'RANDOM_KEY' });
  assert.throws(() => surfaceRandomWords('wave', 1), { code: 'RANDOM_KEY' });
  const p = { ...defaults, layout: 'irregular', width: 80, height: 80, seed: 5000, surfaceSeed: 9999 };
  assert.deepEqual(enumerateCells(layoutParametersV3(p)), enumerateCells(layoutParametersV3({ ...p, surfaceSeed: 1 })));
  assert.notDeepEqual(enumerateCells(layoutParametersV3(p)), enumerateCells(layoutParametersV3({ ...p, seed: 1 })));
  for (const family of SURFACE_FAMILIES) {
    const a = field({ family, seed: 1 }), b = field({ family, seed: 9999 });
    for (const [x,y] of [[-127,37],[0,0],[250,-70],[400,500]]) assert.equal(a.evaluate(x,y), b.evaluate(x,y));
  }
});

test('seven provisional fields are bounded at density/seed extremes and every spiral arm count', () => {
  for (const family of SURFACE_FAMILIES) for (const density of [0.2,12]) for (const surfaceSeed of [1,9999]) {
    for (const spiralArms of family === 'spiral' ? Array.from({length:16},(_,i)=>i+1) : [5]) {
      const f = field({ family, density, surfaceSeed, spiralArms, width: 80, height: 2000 });
      for (let x = -50; x <= 50; x += 5) for (let y = -1000; y <= 1000; y += 37) {
        const value = f.evaluate(x,y); assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, family);
      }
      for (const bad of [NaN,Infinity,-Infinity]) assert.throws(() => f.evaluate(bad,0), { code: 'SURFACE_FIELD' });
      assert.throws(() => f.evaluate(Number.MAX_VALUE, Number.MAX_VALUE), { code: 'SURFACE_FIELD' });
    }
  }
});

test('wave fixtures establish two physical repeats and independent analytic reference values', () => {
  const f = field();
  near(f.evaluate(0,0), .5); near(f.evaluate(62.5,0), 1); near(f.evaluate(187.5,0), 0);
  near(f.evaluate(312.5,20), 1); near(f.evaluate(-62.5,100), 0);
  // Half density doubles the physical wavelength, not the vertical amplitude.
  near(field({ density: 1 }).evaluate(125,0), 1);
  const input = { ...defaults }, frozen = createSurfaceField(input);
  input.density = 12; near(frozen.evaluate(62.5,0), 1);
});

test('radial fields preserve circles and low ring center while cropping in physical space', () => {
  for (const family of ['ring','dome']) for (const [width,height] of [[500,500],[80,2000],[2000,80]]) {
    const f = field({ family, width, height }), radius = Math.min(width,height) * .3;
    for (const angle of [0,.37,1.5,3.7]) near(f.evaluate(radius*Math.cos(angle),radius*Math.sin(angle)), f.evaluate(radius,0));
    near(f.evaluate(0,0), family === 'ring' ? 0 : 1);
    if (family === 'dome') near(f.evaluate(Math.min(width,height)/2,0), 0);
  }
  near(field({ family:'spiral' }).evaluate(0,0), .5);
});

test('inverse coordinates implement actual CCW rotation on square, wide and tall panels', () => {
  for (const family of ['wave','dunes','spiral','ridges','random']) for (const [width,height] of [[500,500],[80,2000],[2000,80]]) {
    for (const rotation of [30,90]) {
      const a = field({ family,width,height }), b = field({ family,width,height,rotation });
      const angle = rotation*Math.PI/180, x=11, y=-7;
      near(a.evaluate(x,y), b.evaluate(x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)));
    }
  }
});

test('shorter nominal side controls resizing, not layout, boundary overflow or material bounds', () => {
  for (const family of SURFACE_FAMILIES) {
    for (const [w,h,k] of [[500,500,2],[400,200,2],[80,80,25]]) {
      const a=field({family,width:w,height:h}),b=field({family,width:w*k,height:h*k});
      near(a.evaluate(13,-19),b.evaluate(13*k,-19*k));
    }
    for (const [w,h,expected] of [[400,400,400],[800,400,400],[800,600,600],[800,799,799],[800,800,800],[800,801,800]]) {
      for (const [width,height] of [[w,h],[h,w]]) {
        const f=field({family,width,height}); assert.equal(f.referenceLength,expected);
        near(f.evaluate(expected*.13,expected*-.21),field({family}).evaluate(500*.13,500*-.21));
      }
    }
    const baseline=field({family}).evaluate(300,260); // Deliberately outside nominal square.
    for (const outline of ['rectangle','ellipse','hexagon','arch']) for (const layout of ['square','triangular','hexagonal']) {
      assert.equal(field({family,outline,layout,straightBoundary:false}).evaluate(300,260),baseline);
    }
  }
});

test('provisional endpoint equivalence and inactive values preserve fields without changing stored parameters', () => {
  for (const family of SURFACE_FAMILIES) {
    const values = [[-12,53],[14,-55],[0,0],[73,91]];
    for (const [x,y] of values) {
      const a=field({family});
      assert.equal(a.evaluate(x,y),field({family,rotation:360,phase:1}).evaluate(x,y));
      assert.equal(a.evaluate(x,y),field({family,depth:0,stepBlend:.5,planarTops:true,minimumRelief:120,topRatio:1}).evaluate(x,y));
      if (['wave','ring','dome','spiral'].includes(family)) assert.equal(a.evaluate(x,y),field({family,surfaceSeed:9999}).evaluate(x,y));
      if (['ring','dome'].includes(family)) assert.equal(a.evaluate(x,y),field({family,rotation:37,phase:.27}).evaluate(x,y));
      if (family==='dome') assert.equal(a.evaluate(x,y),field({family,density:12}).evaluate(x,y));
    }
  }
  for (const family of ['dunes','ridges','random']) {
    const a=field({family}),b=field({family,surfaceSeed:9999});
    assert.ok(Math.abs(a.evaluate(14,37)-b.evaluate(14,37))>1e-6);
  }
  assert.equal(validateParametersV3({...defaults,rotation:360,phase:1}).rotation,360);
  assert.equal(validateParametersV3({...defaults,rotation:360,phase:1}).phase,1);
});
