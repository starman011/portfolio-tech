import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const scope = { window: {} };
runInNewContext(await readFile(new URL('../building-model.js', import.meta.url), 'utf8'), scope);
const {buildPortfolioModel: build, posePortfolioModel: pose, portfolioModuleTransform: transform} = scope.window;
const materials = new Set(['stone', 'trim', 'glass', 'core', 'roof', 'slab', 'plinth']);
for (const seed of [24, 0, 51, 72, 99999, -1, NaN]) {
  const model = build({seed});
  assert.equal(model.family, 'modular');
  assert.equal(model.components.storeys, 2);
  assert.equal(model.components.bays, 6);
  assert.equal(model.components.modules, 19);
  assert.ok(model.faces.length > 900, 'Frame, glazing, screens, and terrace have real geometry');
  assert.equal(model.fitPoints.length, 8);
  for (const face of model.faces) {
    assert.ok(materials.has(face.material));
    assert.ok(Math.abs(Math.hypot(...face.normal) - 1) < 1e-6, 'Unit surface normal');
    for (const vector of [...face.vertices, face.normal, face.movement]) assert.ok(vector.every(Number.isFinite));
    if(face.motion){
      assert.ok(Math.abs(Math.hypot(...face.motion.axis)-1)<1e-6);
      assert.ok([...face.motion.pivot,...face.motion.rule].every(Number.isFinite));
    }
  }
  for (const point of [...model.points, ...model.fitPoints]) assert.ok([...point.position, ...point.movement].every(Number.isFinite));
}
const model=build();
assert.equal(build({seed:0}).seed,0,'Zero is a valid seed');
assert.equal(JSON.stringify(model),JSON.stringify(build({seed:24})),'Seeded geometry is deterministic');
assert.notEqual(JSON.stringify(model.faces),JSON.stringify(build({seed:51}).faces),'Remix changes the actual façade');
const dynamic=model.faces.findIndex(f=>f.motion),fixed=model.faces.findIndex(f=>f.part==='columns');
const states=[0,4,8,12].map(time=>pose(model,time));
assert.equal(new Set(states.map(s=>JSON.stringify(s.faces[dynamic].vertices))).size,4,'Four distinct arrangements');
for(const state of states){
  assert.equal(state.faces.length,model.faces.length);
  assert.equal(JSON.stringify(state.faces[fixed]),JSON.stringify(model.faces[fixed]),'The building frame remains fixed');
  for(const f of state.faces){
    assert.ok(Math.abs(Math.hypot(...f.normal)-1)<1e-6);
    assert.ok(f.vertices.flat().every(Number.isFinite));
  }
}
for(const time of [0,.1,3.99,7.6,15.999,48.2]){
  const a=pose(model,time),b=pose(model,time+16);
  a.faces.forEach((f,i)=>f.vertices.forEach((p,j)=>p.forEach((v,k)=>{
    assert.ok(Math.abs(v-b.faces[i].vertices[j][k])<1e-10,'Seamless 16-second periodic geometry');
  })));
}
const face=model.faces[dynamic],t=7,shift=transform(face.motion,t).shift;
const animated=pose(model,t).faces[dynamic];
face.vertices.forEach((p,j)=>{
  const a=Math.hypot(...p.map((v,i)=>v-face.motion.pivot[i]));
  const b=Math.hypot(...animated.vertices[j].map((v,i)=>v-face.motion.pivot[i]-(i<2?face.movement[i]*shift:0)));
  assert.ok(Math.abs(a-b)<1e-10,'Hinged modules stay rigid');
});
// Camera fit uses a stable envelope; moving modules must not be cropped when
// orbiting or exploding on either a narrow or wide canvas.
for(const separation of [0,1])for(const [width,height] of [[360,300],[1440,620]])for(const tilt of [.55,1.09,1.5])for(const angle of [-.62,0,1.5,3.14]){
  const project=p=>[p[0]*Math.cos(angle)-p[1]*Math.sin(angle),(p[0]*Math.sin(angle)+p[1]*Math.cos(angle))*Math.cos(tilt)-p[2]*Math.sin(tilt)];
  const fit=model.fitPoints.map(p=>project(p.position.map((v,i)=>v+p.movement[i]*separation)));
  const lo=[0,1].map(i=>Math.min(...fit.map(p=>p[i]))),hi=[0,1].map(i=>Math.max(...fit.map(p=>p[i])));
  const top=width<760?44:26,bottom=height-(width<760?30:68);
  const scale=Math.min(width*(width<760?.94:.84)/(hi[0]-lo[0]),(bottom-top)/(hi[1]-lo[1]));
  for(const state of states)for(const f of state.faces)for(const vertex of f.vertices){
    const p=project(vertex.map((v,i)=>v+f.movement[i]*separation));
    const x=width/2+(p[0]-(lo[0]+hi[0])/2)*scale,y=(top+bottom)/2+(p[1]-(lo[1]+hi[1])/2)*scale;
    assert.ok(x>=0&&x<=width&&y>=0&&y<=height,'Posed and exploded geometry stays inside the camera');
  }
}
console.log('OK: two-storey geometry, deterministic remixes, four poses, seamless loop, fixed frame, rigid hinges, normals, and narrow/wide camera fit.');
