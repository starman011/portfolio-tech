import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const scope={window:{}};
for(const file of ['permutation-engine.js','city-journey.js'])runInNewContext(await readFile(new URL('../'+file,import.meta.url),'utf8'),scope);
const engine=scope.window.PermutationField,city=scope.window.CityJourney;
const advance=(journey,seconds,options)=>{for(let i=0;i<seconds*20;i++)journey.advance(.05,options);};
const journey=city.createJourney();
advance(journey,8);assert.equal(journey.state.focus,0,'Start with the untouched dotted form');
advance(journey,8);assert(journey.state.focus>.1&&journey.state.focus<.9);
const stopped=JSON.stringify(journey.state);
for(const options of [{playing:false},{present:false},{inspecting:true},{reduced:true}]){
  advance(journey,5,options);assert.equal(JSON.stringify(journey.state),stopped,'Respect pause, visibility, inspection and reduced motion');
}
advance(journey,20);assert.equal(journey.state.focus,1);assert(journey.state.route>0);
journey.request(0);advance(journey,5);assert.equal(journey.state.phase,'overview');
advance(journey,60);assert.equal(journey.state.focus,0,'Do not pull the visitor back in after returning');
journey.request(1,true);assert.equal(journey.state.focus,1,'Reduced-motion and paused controls are instant');
journey.request(0,true);assert.equal(journey.state.focus,0);
assert.equal(new Set(city.patch(10000)).size,336,'Bound the close-up patch, even after a long visit');
assert.equal(city.patch(0,true).length,208);
assert(city.patch(10000).every(i=>i>=0&&i<14336&&i%64<32));
const forms=engine.enumerate(),overview=new Float32Array([.31,0,0,0,0,.31,0,0,0,0,-.03,0,0,0,0,1]);
// Compare velocities either side of a sample, including the cyclic wrap.
const frozen=engine.particles(forms[0]);
const at=route=>Array.from(city.camera({overview,from:frozen,to:frozen,mix:0,poses:engine.motion(1),focus:1,route,aspect:1.6}));
let worstVelocityJump=0;
for(const route of [...Array.from({length:32},(_,i)=>1+i*7),180,404]){
  const a=at(route-.01),b=at(route),c=at(route+.01);
  const left=b.map((v,i)=>(v-a[i])/.01),right=c.map((v,i)=>(v-b[i])/.01);
  const jump=Math.hypot(...left.map((v,i)=>v-right[i]))/(Math.hypot(...left)+Math.hypot(...right));
  worstVelocityJump=Math.max(worstVelocityJump,jump);
  assert(jump<.005,'Camera velocity must stay continuous through each dot and the ring seam');
}
for(const compact of [false,true])for(const route of [2,180,224,404,10000]){
  const before=new Set(city.patch(route-.001,compact)),after=new Set(city.patch(route+.001,compact));
  for(const i of new Set([...before,...after])){
    const a=city.detailWeight(i,route-.001,compact),b=city.detailWeight(i,route+.001,compact);
    assert(a>=0&&a<=1&&b>=0&&b<=1);
    if(!before.has(i)||!after.has(i))assert.equal(a+b,0,'Replaced rows must be invisible before their buffers change');
    else assert(Math.abs(a-b)<.002,'Shared buildings and anchors fade continuously');
  }
  assert.equal(city.detailWeight(city.index(44+route),route,compact),1,'Buildings near the camera remain fully visible');
}
console.log('OK: smooth cyclic camera path (max relative velocity jump '+worstVelocityJump.toFixed(4)+') and invisible patch-boundary swaps.');
const types=new Set();
for(const [f,form] of forms.entries()){
  const from=engine.particles(form),to=engine.particles(forms[(f+1)%forms.length]);
  for(const i of city.patch(f*9).filter((_,j)=>j%17===0)){
    const seed=city.seed(i);assert.equal(seed,city.seed(i));assert(seed>=0&&seed<1);types.add(city.typeAt(i));
    const size=city.dimensions(from,to,i);assert(size.every(v=>Number.isFinite(v)&&v>0&&v<.3));
    const basis=city.blendBasis(from,to,i,.5);
    assert(Math.abs(Math.hypot(...basis.n)-1)<1e-6);assert(Math.abs(city.dot(basis.n,basis.tangent))<1e-6);
    const anchored=city.basis(from,i),u=Math.floor(i/64)/224*Math.PI*2;
    const radial=[anchored.p[0]-2.84*Math.cos(u),anchored.p[1]-2.84*Math.sin(u),anchored.p[2]];
    assert(Math.abs(city.dot(anchored.n,radial)/Math.hypot(...radial)-1)<1e-6,'The building rises radially through its own dot, without a tangential lean');
    const blendedRadial=[basis.p[0]-2.84*Math.cos(u),basis.p[1]-2.84*Math.sin(u),basis.p[2]];
    assert(Math.abs(city.dot(basis.n,blendedRadial)/Math.hypot(...blendedRadial)-1)<1e-6,'Preserve radial anchoring during a morph, not only at its endpoints');
  }
  for(const focus of [0,.1,.5,.9,1])for(const aspect of [.8,1.75]){
    const matrix=city.camera({overview,from,to,mix:.5,poses:engine.motion(f),focus,route:500+f,aspect});
    assert(matrix.every(Number.isFinite));
    if(focus===0)assert.deepEqual(Array.from(matrix),Array.from(overview),'Overview projection stays unchanged');
    for(const i of city.patch(500+f).filter((_,j)=>j%64===0)){
      const basis=city.blendBasis(from,to,i,.5),point=city.project(matrix,city.rotate(engine.motion(f)[0],basis.p),1200,760);
      assert(point===null||point.every(Number.isFinite));
    }
  }
}
assert.equal(types.size,8);
for(let i=0;i<8;i++)for(const wire of [false,true]){
  const versions=new Set();let length;
  for(const form of forms){
    const mesh=city.prototype(i,wire,form);assert.equal(mesh.length%7,0);assert(mesh.every(Number.isFinite));
    length??=mesh.length;assert.equal(mesh.length,length,'Keep vertex correspondence while changing rule order');
    versions.add(JSON.stringify(Array.from(mesh)));
    for(let j=0;j<mesh.length;j+=7){assert(mesh[j]>=-.50001&&mesh[j]<=.50001);assert(mesh[j+1]>=-.00001&&mesh[j+1]<=1.01);assert(mesh[j+2]>=-.50001&&mesh[j+2]<=.50001);}
  }
  if(i===3)assert(versions.size>=16,'Rule order changes the building assembly, not just its height');
  if(wire)assert.equal(length/7,(city.boxes[i].length+1)*24,'Twelve unique edges per cuboid including the foundation, without face-edge duplication');
}
console.log('OK: bounded city grammar, eight permuted typologies, shared vertex correspondence, camera projections, pause/visibility/reduced-motion gates and reversible journey.');
