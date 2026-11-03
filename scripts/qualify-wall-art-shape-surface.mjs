/** P1 isolated native capability probe. Default includes regular and boundary
 * cells; a smooth interior alone cannot pass this gate. Never a production model. */
import { Worker } from 'node:worker_threads';
import { mkdir, writeFile } from 'node:fs/promises';
import { SURFACE_FAMILIES } from '../src/tools/wall-art/model/parameters-v3.ts';

const directory = new URL('../artifacts/wall-art-shape-surface/checkpoint/', import.meta.url);
await mkdir(directory, { recursive: true });
const boundaries = process.argv.includes('--boundaries');
const family = process.argv.find(argument => argument.startsWith('--family='))?.slice(9);
if (family && !SURFACE_FAMILIES.includes(family)) throw Error('Unknown surface family.');
if (process.argv.slice(2).some(argument => argument !== '--boundaries' && argument !== `--family=${family}`)) throw Error('Supported options: --boundaries --family=<family>');
const worker = new Worker(new URL('../tests/support/shape-surface-probe.mjs', import.meta.url), { workerData: { boundaries, family } });
let peakRss = process.memoryUsage().rss;
const sampler = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  if (peakRss > 2_000_000_000) { failure = new Error('Aggregate process memory exceeded 2,000,000,000 bytes.'); void worker.terminate(); }
}, 100);
let report, failure;
const watchdog = setTimeout(() => { failure = new Error('Native capability probe exceeded 120 seconds.'); void worker.terminate(); }, 120_000);
worker.on('message', value => { report = value; });
worker.on('error', error => { failure = error; });
const exitCode = await new Promise(resolve => worker.on('exit', resolve));
clearTimeout(watchdog); clearInterval(sampler);
peakRss = Math.max(peakRss, process.memoryUsage().rss);
if (peakRss > 2_000_000_000 && !failure) failure = new Error('Aggregate process memory exceeded 2,000,000,000 bytes.');
const result = { stage: 'native-capability', node: process.version, platform: process.platform,
  peakProcessRssBytes: peakRss, memoryMeasurement: 'Sampled whole Node process RSS; not an exact transient peak or browser measurement.',
  ...report, failure: failure?.message ?? report?.failure ?? (exitCode ? `Worker exited ${exitCode}` : !report?.complete ? 'Worker did not complete its matrix.' : null),
  checkpointComplete: false };
const filename = `native-${boundaries ? 'boundaries' : 'capability'}-${family ?? 'all'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(new URL(filename, directory), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (result.failure) process.exitCode = 1;
