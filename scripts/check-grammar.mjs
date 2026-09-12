import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const scope={window:{}};
runInNewContext(await readFile(new URL('../shape-grammar.js',import.meta.url),'utf8'),scope);
const engine=scope.window.PortfolioGrammar;
assert.equal(engine.rotations.length,24);
let pointCount;
for(const pair of ['TL','TT','LL']){
  const forms=engine.enumerate(pair);
  assert.ok(forms.length>100);
  assert.equal(new Set(forms.map(f=>f.signature)).size,forms.length,'No rotational duplicates');
  for(const {cells} of forms){
    assert.equal(cells.length,8);
    assert.equal(new Set(cells.map(p=>p.join(','))).size,8,'No overlapping cells');
    const visited=new Set([0]),queue=[0];
    while(queue.length){const p=cells[queue.pop()];cells.forEach((q,i)=>{if(!visited.has(i)&&q.reduce((s,v,d)=>s+Math.abs(v-p[d]),0)===1){visited.add(i);queue.push(i);}});}
    assert.equal(visited.size,8,'Both pieces form one face-connected shape');
  }
  const first=engine.particles(forms[0]),last=engine.particles(forms.at(-1));
  pointCount??=first.count;
  assert.equal(first.count,pointCount);assert.equal(last.count,pointCount,'Morph correspondence is stable');
  assert.notEqual(JSON.stringify(first.positions),JSON.stringify(last.positions));
  assert.ok(first.positions.every(Number.isFinite));assert.ok(last.positions.every(Number.isFinite));
  assert.ok(first.groups.every(g=>g===0||g===1));
  assert.equal(engine.enumerate(pair),forms,'Enumeration is cached');
}
for(const {p,n} of engine.kernel){
  assert.ok(Math.abs(p.reduce((sum,x)=>sum+Math.cos(x*2*Math.PI),0))<1e-9,'Points satisfy the porous-cell equation');
  assert.ok(Math.abs(Math.hypot(...n)-1)<1e-9);
  assert.ok(p.every(x=>Math.abs(x)<=.5));
}
assert.throws(()=>engine.enumerate('XX'));
console.log('OK: TL / TT / LL enumeration, connected nonoverlapping cells, rotational deduplication, periodic surface normals, and '+pointCount+' corresponding particles.');
