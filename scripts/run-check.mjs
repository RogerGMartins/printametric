import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// ponytail: run the gate directly so the OpenCode tool needs no shell or npm.cmd.
const require = createRequire(import.meta.url);
for (const args of [
  ['scripts/check-scaffold.mjs'],
  [join(dirname(require.resolve('typescript/package.json')), 'bin/tsc'), '--noEmit'],
  [join(dirname(require.resolve('typescript/package.json')), 'bin/tsc'), '--project', 'tsconfig.app.json'],
  [join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), 'build'],
  ['--test'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
