import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { Script } from 'node:vm';
import './check-permutation.mjs';
import './check-focus.mjs';
import './check-city.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const javascript = await readFile(resolve(root, 'script.js'), 'utf8');
new Script(javascript, { filename: 'script.js' });
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs');
const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1]);
const local = new Set();
for (const reference of references) {
  if (/^(?:https?:|mailto:|data:)/.test(reference)) continue;
  if (reference.startsWith('#')) {
    if (!ids.includes(reference.slice(1))) throw new Error('Missing fragment: ' + reference);
    continue;
  }
  const path = reference.split(/[?#]/)[0];
  if (!path) continue;
  if (path.startsWith('/') || path.includes('..')) throw new Error('Nonportable path: ' + path);
  local.add(path);
  if (!(await stat(resolve(root, path))).isFile()) throw new Error('Missing asset: ' + path);
  if (path.endsWith('.js')) new Script(await readFile(resolve(root, path), 'utf8'), { filename: path });
}
if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error('Expected one primary heading');
for (const image of html.matchAll(/<img\b[^>]*>/g)) {
  if (!/\balt="[^"]*"/.test(image[0])) throw new Error('Image is missing alt text');
}
console.log('OK: script syntax, unique IDs, fragment links, ' + local.size + ' local references, and image alternatives.');
