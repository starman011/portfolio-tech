import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';

const scope = { window: {} };
runInNewContext(await readFile(new URL('../permutation-engine.js', import.meta.url), 'utf8'), scope);
const engine = scope.window.PermutationField;
assert.equal(engine.rings.length, 2, 'Exactly two circular rings');
assert.equal(engine.wireIndices.length, 10752);
const edges = new Set();
for (let i = 0; i < engine.wireIndices.length; i += 2) {
  const a = engine.wireIndices[i], b = engine.wireIndices[i + 1];
  assert.ok(a < 14336 && b < 14336 && a !== b);
  assert.equal(Math.floor((a % 64) / 32), Math.floor((b % 64) / 32), 'Wire edges stay within one ring');
  edges.add([Math.min(a, b), Math.max(a, b)].join('/'));
}
assert.equal(edges.size, 5376, 'Wire topology has no duplicate edges');
const apply = (matrix, vector) => [0,1,2].map(row => vector.reduce((sum, v, col) => sum + matrix[col * 3 + row] * v, 0));
for (const time of [0, .5, 4, 15, 45, 120]) {
  const poses = engine.motion(time);
  assert.equal(poses.length, 2);
  const normals = engine.rings.map((ring, i) => apply(poses[i], ring.normal));
  assert.ok(Math.abs(normals[0].reduce((sum, v, i) => sum + v * normals[1][i], 0)) < 1e-6, 'Ring planes remain 90 degrees apart throughout animation');
  for (const matrix of poses) {
    assert.ok(matrix.every(Number.isFinite));
    for (let col = 0; col < 3; col++) assert.ok(Math.abs(Math.hypot(...matrix.subarray(col * 3, col * 3 + 3)) - 1) < 1e-6);
  }
}
const factorial = n => n < 2 ? 1 : n * factorial(n - 1);
let sequences = 0;
for (let mask = 1; mask < 16; mask++) {
  const active = engine.rules.filter((_, i) => mask & (1 << i));
  const forms = engine.enumerate(active);
  assert.equal(forms.length, factorial(active.length));
  const hashes = new Set();
  for (const form of forms) {
    const field = engine.particles(form);
    assert.equal(field.count, 14336, 'All forms retain particle correspondence');
    assert.equal(field.positions.length, field.count * 3);
    assert.equal(field.normals.length, field.count * 3);
    assert.ok(field.positions.every(Number.isFinite));
    assert.ok(field.normals.every(Number.isFinite));
    assert.ok(field.groups.every(g => g >= 0 && g < 2));
    for (let i = 0; i < field.count; i += 127) {
      assert.ok(Math.abs(Math.hypot(...field.normals.subarray(i * 3, i * 3 + 3)) - 1) < 1e-6);
      assert.ok(Math.hypot(...field.positions.subarray(i * 3, i * 3 + 3)) <= 3.15001);
    }
    for (let part = 0; part < 2; part++) for (let u = 0; u < 224; u += 28) {
      const center = [0,0,0];
      for (let v = 0; v < 32; v++) for (let d = 0; d < 3; d++) center[d] += field.positions[(u * 64 + part * 32 + v) * 3 + d] / 32;
      const angle = u / 224 * Math.PI * 2, radius = engine.rings[part].radius;
      const expected = part === 0 ? [radius * Math.cos(angle), radius * Math.sin(angle), 0] : [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
      assert.ok(center.every((value, d) => Math.abs(value - expected[d]) < 1e-6), 'Every rule order preserves exact circular centerlines and perpendicular planes');
    }
    hashes.add(createHash('sha256').update(new Uint8Array(field.positions.buffer)).digest('hex'));
    assert.equal(engine.particles(form), field, 'Generated positions are cached');
    sequences++;
  }
  assert.equal(hashes.size, forms.length, 'Every permutation in the set changes the geometry');
}
assert.throws(() => engine.enumerate([]));
assert.throws(() => engine.enumerate(['Fold', 'Fold']));
assert.throws(() => engine.enumerate(['unknown']));
console.log('OK: exactly two circles, 90-degree animated planes, circular centerlines across all '+sequences+' rule sequences, unique profiles, finite points and unit normals.');
