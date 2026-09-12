import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Non-browser contract checks. Shader compilation and rendered appearance are
// not implied by this simulated GL context.
const modelSource=await readFile(new URL('../building-model.js',import.meta.url),'utf8');
const rendererSource=await readFile(new URL('../webgl-model.js',import.meta.url),'utf8');
const listeners=new Map(),draws=[],uploads=[],enabled=new Set(),uniforms=new Map();
let nextBuffer=0,deleted=0,shaderOK=true,contextAvailable=true;
const gl={};
for(const [i,name] of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','DEPTH_TEST','LEQUAL','CULL_FACE','BACK','CW','ARRAY_BUFFER','STATIC_DRAW','FLOAT','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','POINTS','POLYGON_OFFSET_FILL','TRIANGLES','LINES'].entries())gl[name]=i+1;
Object.assign(gl,{
  createShader:()=>({}),shaderSource:()=>{},compileShader:()=>{},getShaderParameter:()=>shaderOK,getShaderInfoLog:()=>'',deleteShader:()=>{},
  createProgram:()=>({}),attachShader:()=>{},linkProgram:()=>{},getProgramParameter:()=>true,getProgramInfoLog:()=>'',deleteProgram:()=>{},
  getAttribLocation:(_,name)=>['aPosition','aNormal','aMovement','aMaterial','aPivot','aMotion','aAxis'].indexOf(name),getUniformLocation:(_,name)=>name,
  enable:mode=>enabled.add(mode),disable:mode=>enabled.delete(mode),depthFunc:value=>assert.equal(value,gl.LEQUAL),cullFace:value=>assert.equal(value,gl.BACK),frontFace:value=>assert.equal(value,gl.CW),clearColor:()=>{},
  createBuffer:()=>++nextBuffer,deleteBuffer:()=>deleted++,bindBuffer:()=>{},bufferData:(_,data)=>{assert.equal(data.length%20,0);assert.ok(data.every(Number.isFinite));uploads.push(data.length);},
  enableVertexAttribArray:location=>assert.ok(location>=0&&location<8),vertexAttribPointer:(_,size,type,normalized,stride,offset)=>{assert.equal(stride,80);assert.ok([0,12,24,36,40,52,68].includes(offset));},
  viewport:(_,__,w,h)=>{assert.ok(w>0&&h>0);},clear:()=>{},useProgram:()=>{},
  uniformMatrix4fv:(name,transpose,data)=>{assert.equal(transpose,false);assert.equal(data.length,16);assert.ok(data.every(Number.isFinite));uniforms.set(name,data);},
  uniform1f:(name,value)=>{assert.ok(Number.isFinite(value));uniforms.set(name,value);},uniform1i:(name,value)=>uniforms.set(name,value),
  uniform3fv:(name,data)=>{assert.ok(data.every(Number.isFinite));uniforms.set(name,data);},polygonOffset:()=>{},
  drawArrays:(mode,first,count)=>{assert.equal(first,0);assert.ok(Number.isInteger(count)&&count>0);draws.push({mode,count});},isContextLost:()=>false
});
const canvas={width:0,height:0,setAttribute:()=>{},getContext:()=>contextAvailable?gl:null,addEventListener:(name,fn)=>listeners.set(name,fn)};
const scope={window:{WebGLRenderingContext:function(){},devicePixelRatio:2},document:{createElement:()=>canvas,dispatchEvent:()=>{}},Event:class{}};
runInNewContext(modelSource,scope);runInNewContext(rendererSource,scope);
let appended=0;
const renderer=scope.window.createPortfolioRenderer({append:()=>appended++});
assert.ok(renderer);assert.equal(appended,1);
const model=scope.window.buildPortfolioModel();
const args={model,camera:{scale:44,x:480,y:350},width:960,height:700,angle:-.62,viewTilt:1.09,separation:0,mode:'daylight',sun:[.5,0,Math.sqrt(.75)],dark:false};
assert.equal(renderer.draw(args),true);assert.equal(uploads.length,4);assert.ok(enabled.has(gl.DEPTH_TEST));
assert.deepEqual(draws.map(d=>d.mode),[gl.TRIANGLES]);
for(const mode of ['mesh','normals','points'])assert.equal(renderer.draw({...args,mode,separation:1,dark:true}),true);
renderer.draw({...args,time:7.5});assert.equal(uniforms.get('uTime'),7.5,'Loop time reaches the vertex shader');
assert.equal(uploads.length,4,'Motion, orbit, theme, mode, and assembly reuse GPU geometry');
const matrix=uniforms.get('uMatrix');
const ndc=p=>[0,1,2].map(row=>matrix[row]*p[0]+matrix[4+row]*p[1]+matrix[8+row]*p[2]+matrix[12+row]);
const front=ndc([0,1,0]),back=ndc([0,-1,0]);
assert.ok(front[2]<back[2],'Near geometry wins the depth comparison');
const [a,b,c]=[[1,1,1],[1,1,-1],[-1,1,-1]].map(ndc);
assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0,'Projection uses the configured clockwise front face');
renderer.draw({...args,model:scope.window.buildPortfolioModel({seed:51})});
assert.equal(deleted,4,'Replacing a form disposes its old buffers');
let prevented=false;listeners.get('webglcontextlost')({preventDefault:()=>prevented=true});
assert.ok(prevented);assert.equal(renderer.draw(args),false,'Context loss activates the existing fallback');
listeners.get('webglcontextrestored')();assert.equal(renderer.draw(args),true);
shaderOK=false;assert.equal(scope.window.createPortfolioRenderer({append:()=>assert.fail('Invalid renderer appended')}),null,'Compile failure leaves the fallback intact');
contextAvailable=false;assert.equal(scope.window.createPortfolioRenderer({append:()=>assert.fail('Unavailable renderer appended')}),null);
console.log('OK: GPU buffer contract, depth/winding, cached modes, replacement disposal, and context-loss fallback (simulated GL).');
