import './check.mjs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const files = new Set(['index.html']);
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  if (/^(?:https?:|mailto:|data:|#)/.test(match[1])) continue;
  const path = match[1].split(/[?#]/)[0];
  if (path) files.add(path);
}
for (const path of files) {
  const destination = resolve(output, path);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, path), destination);
}
console.log('Built ' + files.size + ' public files into dist/.');
