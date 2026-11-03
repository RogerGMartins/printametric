// Assembler for the pinned OCCT writer's AP214 subset. Each bounded
// fragment is checked twice; only its entity-ID set survives between scan passes.
// The caller owns the temporary sink and must remove it after any failure.
import type { ByteSink, StreamOptions } from './stream.ts';
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_FRAGMENT_BYTES = 32 * 1024 * 1024;
const SCHEMA = "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));";

function* statements(text: string) {
  let start = 0, code = '', quote = false, comment = false, depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (comment) { if (c === '*' && next === '/') { comment = false; i++; code += ' '; } continue; }
    if (quote) {
      if (c === "'") { if (next === "'") i++; else { quote = false; code += "''"; } }
      continue;
    }
    if (c === '/' && next === '*') { comment = true; i++; continue; }
    if (c === "'") { quote = true; continue; }
    if (c === '"' || c === '\0') throw Error('Unsupported STEP token');
    if (c === '(') depth++;
    if (c === ')' && --depth < 0) throw Error('Unbalanced STEP record');
    code += c;
    if (c === ';') {
      if (depth !== 0) throw Error('Unbalanced STEP record');
      yield { text: text.slice(start, i + 1), code: code.trim() };
      start = i + 1; code = '';
    }
  }
  if (quote || comment || depth || code.trim()) throw Error('Truncated STEP fragment');
}

function idOf(code: string) {
  const match = /^#([1-9]\d*)\s*=\s*(?:[A-Z][A-Z0-9_]*\s*\(|\()/.exec(code);
  if (!match || !code.endsWith(');')) throw Error('Unsupported STEP entity');
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id)) throw Error('STEP ID outside safe range');
  validateEntitySyntax(code);
  return id;
}

function validateEntitySyntax(code: string) {
  // String contents/comments are already blanked by the scanner. Recognize the
  // remaining Part 21 value grammar, including complex entity records; unknown
  // syntax must not pass merely because it contains a valid leading assignment.
  const token = /\s*(#[1-9]\d*|''|\.[A-Z_][A-Z0-9_]*\.|[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:E[+-]?\d+)?|[A-Z_][A-Z0-9_]*|[(),=;$*])/y;
  let position = 0, current: string | undefined;
  const next = () => {
    if (position === code.length) { current = undefined; return; }
    token.lastIndex = position; const match = token.exec(code);
    if (!match) throw Error('Unsupported STEP value token');
    current = match[1]; position = token.lastIndex;
  };
  const expect = (expected: string) => { if (current !== expected) throw Error('Invalid STEP value syntax'); next(); };
  const argumentsList = (depth: number) => {
    if (depth > 64) throw Error('STEP entity nesting exceeds limit');
    expect('(');
    if (current !== ')') {
      value(depth + 1);
      while (current === ',') { next(); value(depth + 1); }
    }
    expect(')');
  };
  const record = (depth: number) => {
    if (!current || !/^[A-Z_]/.test(current)) throw Error('Expected STEP record');
    next(); argumentsList(depth + 1);
  };
  const value = (depth: number) => {
    if (!current) throw Error('Truncated STEP value');
    if (current === '(') argumentsList(depth + 1);
    else if (/^[A-Z_]/.test(current)) record(depth + 1);
    else if (current === "''" || current === '$' || current === '*' || /^[#.+\-\d]/.test(current)) next();
    else throw Error('Unsupported STEP value');
  };
  next();
  if (!current?.startsWith('#')) throw Error('Expected STEP entity ID');
  next(); expect('=');
  if (current === '(') { next(); record(0); while ((current as string | undefined) !== ')') record(0); expect(')'); }
  else record(0);
  expect(';'); if (current !== undefined) throw Error('Trailing STEP entity tokens');
}

function inspect(bytes: Uint8Array) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_FRAGMENT_BYTES) throw Error('STEP fragment exceeds bounded buffer');
  const text = decoder.decode(bytes), records = statements(text), ids = new Set(), header = [];
  const take = () => { const item = records.next(); if (item.done) throw Error('Truncated STEP fragment'); return item.value; };
  for (const expected of ['ISO-10303-21;', 'HEADER;']) { const item = take(); if (item.code !== expected) throw Error('Unsupported STEP header'); header.push(item.text); }
  for (const name of ['FILE_DESCRIPTION', 'FILE_NAME', 'FILE_SCHEMA']) {
    const item = take();
    if (!item.code.startsWith(`${name}(`)) throw Error('Unsupported STEP header');
    if (name === 'FILE_SCHEMA' && item.text.trim() !== SCHEMA) throw Error('STEP schema mismatch');
    header.push(item.text);
  }
  if (take().code !== 'ENDSEC;' || take().code !== 'DATA;') throw Error('Unsupported STEP sections');
  let maxId = 0, units = 0;
  for (;;) {
    const item = take(); if (item.code === 'ENDSEC;') break;
    const id = idOf(item.code);
    if (ids.has(id)) throw Error('Duplicate STEP entity'); ids.add(id); maxId = Math.max(maxId, id);
    if (/\bLENGTH_UNIT\s*\(/.test(item.code)) {
      if (!/SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/.test(item.code)) throw Error('STEP length unit is not millimeters');
      units++;
    }
  }
  if (!ids.size || !units || take().code !== 'END-ISO-10303-21;' || !records.next().done) throw Error('Unsupported STEP tail or units');
  // References cannot cross fragments. This makes offset ranges sufficient; a
  // whole-output ID set would grow with the full file and defeat bounded memory.
  for (const item of statements(text)) if (item.code.startsWith('#')) {
    for (const match of item.code.matchAll(/#(\d+)/g)) if (!ids.has(Number(match[1]))) throw Error('Dangling STEP reference');
  }
  return { text, header: `${header.join('\n')}\nENDSEC;\nDATA;\n`, maxId, entities: ids.size };
}

function remap(text: string, offset: number) {
  let output = '', quote = false, comment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1]; output += c;
    if (comment) { if (c === '*' && next === '/') { output += next; i++; comment = false; } continue; }
    if (quote) { if (c === "'") { if (next === "'") { output += next; i++; } else quote = false; } continue; }
    if (c === "'") { quote = true; continue; }
    if (c === '/' && next === '*') { output += next; i++; comment = true; continue; }
    if (c === '#') {
      const start = ++i; while (i < text.length && /\d/.test(text[i]!)) i++;
      const value = Number(text.slice(start, i)) + offset;
      if (!Number.isSafeInteger(value)) throw Error('Remapped STEP ID outside safe range');
      output += value; i--;
    }
  }
  return output;
}

export async function assembleSTEP(fragments: AsyncIterable<Uint8Array> | Iterable<Uint8Array>, sink: ByteSink, { signal, maxBytes = 2 * 1024 ** 3 }: StreamOptions = {}) {
  let offset = 0, totalBytes = 0, totalEntities = 0, count = 0;
  const write = async (text: string) => {
    signal?.throwIfAborted(); const bytes = encoder.encode(text);
    if (totalBytes + bytes.length > maxBytes) throw Error('Temporary STEP file budget exceeded');
    await sink.write(bytes); totalBytes += bytes.length;
  };
  for await (const bytes of fragments) {
    signal?.throwIfAborted(); const fragment = inspect(bytes);
    if (!count) await write(fragment.header);
    let pending = '';
    for (const item of statements(fragment.text)) if (item.code.startsWith('#')) {
      pending += `${remap(item.text, offset)}\n`;
      if (pending.length >= 64 * 1024) { await write(pending); pending = ''; }
    }
    if (pending) await write(pending);
    offset += fragment.maxId; totalEntities += fragment.entities; count++;
  }
  if (!count) throw Error('No native STEP fragments');
  await write('ENDSEC;\nEND-ISO-10303-21;\n');
  return { fragments: count, entities: totalEntities, bytes: totalBytes };
}
