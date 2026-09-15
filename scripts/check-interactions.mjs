import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

// Dependency-free DOM/WebGL doubles: lifecycle proof, not a GPU/visual benchmark.
class Element {
  constructor(attrs={}){
    this.attrs=attrs;this.dataset={};this.events=new Map();this.children=[];this.disabled=false;this.hidden=false;this.textContent='';
    for(const [key,value] of Object.entries(attrs))if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
    const classes=new Set((attrs.class||'').split(' '));
    this.classList={add:(...names)=>names.forEach(n=>classes.add(n)),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle:(n,on)=>{on??=!classes.has(n);on?classes.add(n):classes.delete(n);return on;}};
    this.style={setProperty(){}};this.open=false;
  }
  setAttribute(k,v){this.attrs[k]=v;}
  getAttribute(k){return this.attrs[k];}
  addEventListener(k,fn){if(!this.events.has(k))this.events.set(k,[]);this.events.get(k).push(fn);}
  removeEventListener(k,fn){this.events.set(k,(this.events.get(k)||[]).filter(f=>f!==fn));}
  dispatchEvent(event){return Promise.all((this.events.get(event.type)||[]).map(fn=>fn(event)));}
  click(){return this.dispatchEvent({type:'click',target:this});}
  append(child){this.children.push(child);child.parentElement=this;}
  contains(child){return this.children.includes(child);}
  insertBefore(child,next){this.children=this.children.filter(c=>c!==child);const at=this.children.indexOf(next);this.children.splice(at<0?this.children.length:at,0,child);}
  getBoundingClientRect(){return {x:0,y:0,width:1200,height:760};}
  focus(){}
}
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const elements=[...html.matchAll(/<(?:button|input|canvas|details|p|span|div)\b([^>]*)>/g)].map(([,tag])=>new Element(Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]))));
const select=selector=>elements.filter(e=>selector.startsWith('#')?e.attrs.id===selector.slice(1):selector.startsWith('.')?e.classList.contains(selector.slice(1)):(()=>{
  const match=selector.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);return match&&match[1] in e.attrs&&(match[2]===undefined||e.attrs[match[1]]===match[2]);
})());
const get=selector=>select(selector)[0];
const body=new Element(),document=new Element(),window=new Element();
Object.assign(document,{body,documentElement:new Element(),querySelector:get,querySelectorAll:select,activeElement:body,hidden:false});
const canvas=get('#surface-canvas'),stage=new Element();stage.append(canvas);
const summary=new Element();get('#scene-inspector').querySelector=()=>summary;
get('.grammar-steps').children=select('[data-rule]');
const canvas2D=new Proxy({},{get:()=>()=>{}});
let draws=0;
const shaderCheck=source=>{
  const stack=[];
  for(const c of source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'')){
    if('([{'.includes(c))stack.push(c);
    else if(')]}'.includes(c))assert.equal(stack.pop(),'([{'[')]}'.indexOf(c)],'Balanced shader source');
  }
  assert.equal(stack.length,0);
};
const noops=['shaderSource','compileShader','deleteShader','attachShader','linkProgram','deleteProgram','bindBuffer','enable','disable','blendFunc','depthFunc','clearColor','viewport','clear','useProgram','enableVertexAttribArray','disableVertexAttribArray','lineWidth','depthMask'];
const gl=new Proxy({
  createShader:()=>({}),shaderSource:(_shader,source)=>shaderCheck(source),getShaderParameter:()=>true,
  createProgram:()=>({attrs:new Map()}),getProgramParameter:()=>true,
  createBuffer:()=>({}),isContextLost:()=>false,
  getAttribLocation:(program,name)=>{if(!program.attrs.has(name))program.attrs.set(name,program.attrs.size);return program.attrs.get(name);},
  getUniformLocation:(_program,name)=>name,
  bufferData:(_target,data)=>{if(data?.length)assert(data.every(Number.isFinite),'Finite GPU payload');},
  vertexAttribPointer:location=>assert(location>=0),
  uniformMatrix4fv:(_location,_transpose,data)=>assert(data.every(Number.isFinite)),
  uniformMatrix3fv:(_location,_transpose,data)=>assert(data.every(Number.isFinite)),
  uniform3fv:(_location,data)=>assert(data.every(Number.isFinite)),uniform1f:(_location,v)=>assert(Number.isFinite(v)),uniform1i(){},
  drawElements(){draws++;},drawArrays(){draws++;},
  getExtension:()=>({vertexAttribDivisorANGLE(){},drawArraysInstancedANGLE(){draws++;}})
},{get:(obj,key)=>key in obj?obj[key]:noops.includes(key)?()=>{}:key});
canvas.getContext=()=>canvas2D;
document.createElement=()=>{const e=new Element();e.getContext=()=>gl;return e;};
let reduced=false;
const media={get matches(){return reduced;},addEventListener(){}};
const raf=new Map();let rafID=0,time=100;
const scope=createContext({document,window,matchMedia:q=>q.includes('reduced')?media:{matches:false},devicePixelRatio:1,
  requestAnimationFrame:fn=>{raf.set(++rafID,fn);return rafID;},cancelAnimationFrame:id=>raf.delete(id),
  Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,data){this.type=type;Object.assign(this,data);}},
  localStorage:{getItem(){throw Error('Storage denied');},setItem(){throw Error('Storage denied');}}
});
window.matchMedia=()=>media;window.WebGLRenderingContext=true;
const pageScript=await readFile(new URL('../script.js',import.meta.url),'utf8');
runInContext(pageScript.slice(0,pageScript.indexOf('  const menuButton'))+'})();',scope);
for(const file of ['permutation-engine.js','city-journey.js','city-renderer.js','permutation-scene.js'])runInContext(await readFile(new URL('../'+file,import.meta.url),'utf8'),scope);
const step=seconds=>{for(let i=0;i<seconds*20;i++){time+=50;const pending=[...raf.values()];raf.clear();pending.forEach(fn=>fn(time));assert(raf.size<=1,'Only one model frame may be scheduled');}};
step(1);
await get('#city-journey').click();
const frozenClock=canvas.dataset.clock,frozenMix=canvas.dataset.mix;
step(12);
assert.equal(canvas.dataset.geometryFrozen,'true');assert.equal(canvas.dataset.journey,'city');
assert.equal(canvas.dataset.clock,frozenClock,'Look closer freezes the ring rotation');
assert.equal(canvas.dataset.mix,frozenMix,'Look closer freezes dot twisting');
assert(Number(canvas.dataset.cameraRoute)>0,'The independent camera keeps gliding');
assert.equal(canvas.dataset.buildings,'336');assert.equal(canvas.dataset.renderer,'webgl');
await get('[data-rule="Fold"]').click();step(2);
assert.equal(canvas.dataset.clock,frozenClock,'Changing building modules must not restart the ring');
await get('.motion-toggle').click();const paused=JSON.stringify(canvas.dataset);step(3);
assert.equal(JSON.stringify(canvas.dataset),paused,'Pause stops camera and form together');
await get('#city-journey').click();assert.equal(canvas.dataset.journey,'overview');assert.equal(canvas.dataset.geometryFrozen,'false');
await get('.motion-toggle').click();step(1);assert.notEqual(canvas.dataset.clock,frozenClock,'Whole form resumes the original study');
await get('.theme-toggle').click();assert(body.classList.contains('dark'),'Theme works without view-transition support or storage');
let transitions=0;
document.startViewTransition=commit=>{transitions++;commit();return {ready:Promise.resolve(),finished:Promise.resolve()};};
await get('.theme-toggle').click();assert(!body.classList.contains('dark'));assert.equal(transitions,1);assert.equal(get('.theme-toggle').disabled,false);
document.startViewTransition=()=>{throw Error('Transition unavailable');};
await get('.theme-toggle').click();assert(body.classList.contains('dark'));assert.equal(get('.theme-toggle').disabled,false);
reduced=true;await get('.theme-toggle').click();assert(!body.classList.contains('dark'));assert.equal(transitions,1);
for(let cycle=0;cycle<6;cycle++){
  await get('.theme-toggle').click();assert(body.classList.contains('dark'));assert.equal(canvas.dataset.theme,'dark');
  assert.equal(document.documentElement.dataset.theme,'dark');
  await get('.theme-toggle').click();assert(!body.classList.contains('dark'));assert.equal(canvas.dataset.theme,'light');
  assert.equal(document.documentElement.dataset.theme,'light');
}
// A fresh document restores only dark/light; no intermediate palette is saved.
const stored=new Map();
for(let visit=0;visit<3;visit++){
  const visitBody=new Element(),visitButton=new Element(),visitLabel=new Element();
  const schemeMeta=new Element(),chromeMeta=new Element();
  const visitDocument=new Element();
  Object.assign(visitDocument,{body:visitBody,documentElement:new Element(),querySelector:selector=>selector==='.theme-toggle'?visitButton:selector==='.theme-label'?visitLabel:selector==='meta[name="color-scheme"]'?schemeMeta:selector==='meta[name="theme-color"]'?chromeMeta:null});
  const visitScope=createContext({document:visitDocument,window:{matchMedia:()=>({matches:true})},Event:scope.Event,
    localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)}});
  runInContext(pageScript.slice(0,pageScript.indexOf('  const menuButton'))+'})();',visitScope);
  assert(!visitBody.classList.contains('dark'),'Each reopening restores the same light class');
  assert.equal(visitLabel.textContent,'Dark mode');
  assert.equal(schemeMeta.getAttribute('content'),'only light');assert.equal(chromeMeta.getAttribute('content'),'#eee9de');
  await visitButton.click();assert.equal(stored.get('sk-theme'),'dark');
  assert.equal(schemeMeta.getAttribute('content'),'dark');assert.equal(chromeMeta.getAttribute('content'),'#181c19');
  await visitButton.click();assert.equal(stored.get('sk-theme'),'light');
  assert.equal(schemeMeta.getAttribute('content'),'only light');assert.equal(chromeMeta.getAttribute('content'),'#eee9de');
}
assert(draws>0);
console.log('OK: frozen close-up geometry, independent camera, reversible return, paused state, manual assembly changes, repeated theme switching/reopening, theme fallback and reduced motion (DOM/WebGL doubles).');
