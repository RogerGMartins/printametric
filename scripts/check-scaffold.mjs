import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

export function definition(text, label) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(text);
  assert(match, `${label}: frontmatter and body required`);
  const metadata = parse(match[1]);
  assert(typeof metadata?.description === 'string' && metadata.description.trim(),
    `${label}: description required`);
  assert(match[2].trim(), `${label}: body required`);
  return metadata;
}

export async function check(root = process.cwd()) {
  const read = (path) => readFile(join(root, path), 'utf8');
  const config = JSON.parse(await read('opencode.json'));
  assert.equal(config.$schema, 'https://opencode.ai/config.json');
  for (const path of config.instructions ?? []) await read(path);
  for (const path of ['AGENTS.md', 'LICENSE', 'README.md', 'docs/product.md', 'docs/development.md']) {
    assert((await read(path)).trim(), `${path}: empty document`);
  }
  const agents = new Set(['build', 'plan']);
  for (const file of await readdir(join(root, '.opencode/agents'))) {
    if (!file.endsWith('.md')) continue;
    const metadata = definition(await read(`.opencode/agents/${file}`), file);
    assert(['primary', 'subagent', 'all'].includes(metadata.mode), `${file}: invalid mode`);
    agents.add(basename(file, '.md'));
  }
  for (const file of await readdir(join(root, '.opencode/commands'))) {
    if (!file.endsWith('.md')) continue;
    const metadata = definition(await read(`.opencode/commands/${file}`), file);
    assert(agents.has(metadata.agent), `${file}: unknown agent ${metadata.agent}`);
  }
  for (const folder of await readdir(join(root, '.opencode/skills'))) {
    const file = `.opencode/skills/${folder}/SKILL.md`;
    const metadata = definition(await read(file), file);
    assert.equal(metadata.name, basename(dirname(file)), `${file}: skill name must match folder`);
    assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(metadata.name), `${file}: invalid name`);
  }
  const workflow = parse(await read('.github/workflows/ci.yml'));
  assert(workflow.on.push && workflow.on.pull_request, 'CI must cover pushes and PRs');
  assert.equal(workflow.permissions.contents, 'read');
  assert(workflow.jobs.check.steps.some((step) => step.run === 'npm run check'));
  parse(await read('.github/dependabot.yml'));
  console.log('Scaffold checks passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await check();
}
