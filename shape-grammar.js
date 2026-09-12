/* Original point-cloud study: connected pairs of four-cell shapes.
 * Research inspiration is credited in the scene and SOURCES.md.
 * This is a discrete rule system, not an AI model or Shape Machine port. */
'use strict';
window.PortfolioGrammar = (() => {
  const vocabulary = {
    T: [[0,0,0],[1,0,0],[2,0,0],[1,1,0]],
    L: [[0,0,0],[0,1,0],[0,2,0],[1,2,0]]
  };
  const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const rotations=[];
  for(const a of directions)for(const b of directions){
    if(a.reduce((s,v,i)=>s+v*b[i],0))continue;
    rotations.push([a,b,[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]]);
  }
  const rotate=(p,r)=>r.map(row=>row.reduce((s,v,i)=>s+v*p[i],0));
  const normalize=cells=>{
    const min=[0,1,2].map(i=>Math.min(...cells.map(p=>p[i])));
    return cells.map(p=>p.map((v,i)=>v-min[i]));
  };
  const key=cells=>normalize(cells).map(p=>p.join(',')).sort().join(';');
  const canonical=cells=>rotations.map(r=>key(cells.map(p=>rotate(p,r)))).sort()[0];
  const cache=new Map();
  function enumerate(pair='TL'){
    if(cache.has(pair))return cache.get(pair);
    if(!['TL','TT','LL'].includes(pair))throw new Error('Unknown shape pair');
    const a=vocabulary[pair[0]],b=vocabulary[pair[1]],orientations=new Map();
    rotations.forEach(r=>{const cells=normalize(b.map(p=>rotate(p,r)));orientations.set(key(cells),cells);});
    const seen=new Set(),unique=new Map();
    for(const turned of orientations.values())for(const anchor of a)for(const cell of turned)for(const direction of directions){
      const offset=anchor.map((v,i)=>v+direction[i]-cell[i]);
      const moved=turned.map(p=>p.map((v,i)=>v+offset[i]));
      if(moved.some(p=>a.some(q=>p.every((v,i)=>v===q[i]))))continue;
      const cells=normalize([...a,...moved]),raw=key(cells);
      if(seen.has(raw))continue;seen.add(raw);
      const signature=canonical(cells);
      if(!unique.has(signature))unique.set(signature,{cells,signature,pair});
    }
    // Favor compact spatial arrangements in the opening; retain the full set.
    const forms=[...unique.values()].sort((a,b)=>{
      const score=f=>{const e=[0,1,2].map(i=>1+Math.max(...f.cells.map(p=>p[i])));return Math.max(...e)*5+Math.max(0,2-e[2])*10+Math.abs(e[0]-e[1]);};
      return score(a)-score(b)||a.signature.localeCompare(b.signature);
    });
    cache.set(pair,forms);return forms;
  }
  // cos(2πx)+cos(2πy)+cos(2πz)=0. This periodic porous cell meets its
  // neighbors continuously. Sampling from three axes avoids a preferred view.
  const kernel=[];
  for(let axis=0;axis<3;axis++)for(let i=0;i<24;i++)for(let j=0;j<24;j++){
    const u=(i+.28+axis*.12)/24-.5,v=(j+.61-axis*.1)/24-.5;
    const c=-Math.cos(u*2*Math.PI)-Math.cos(v*2*Math.PI);
    if(Math.abs(c)>1)continue;
    for(const sign of [-1,1]){
      const p=[u,v,sign*Math.acos(c)/(2*Math.PI)];
      const n=p.map(x=>-Math.sin(x*2*Math.PI)),length=Math.hypot(...n)||1;
      kernel.push({p:[p[axis],p[(axis+1)%3],p[(axis+2)%3]],n:[n[axis]/length,n[(axis+1)%3]/length,n[(axis+2)%3]/length]});
    }
  }
  function particles(form){
    const ext=[0,1,2].map(i=>Math.max(...form.cells.map(p=>p[i]))+1);
    const scale=4.9/Math.max(...ext),center=ext.map(v=>(v-1)/2);
    const positions=new Float32Array(kernel.length*8*3),normals=new Float32Array(positions.length),groups=new Float32Array(kernel.length*8);
    const centers=form.cells.map(p=>p.map((v,i)=>(v-center[i])*scale));
    let index=0;
    form.cells.forEach((cell,c)=>kernel.forEach(k=>{
      for(let d=0;d<3;d++){positions[index*3+d]=(cell[d]+k.p[d]-center[d])*scale;normals[index*3+d]=k.n[d];}
      groups[index]=c<4?0:1;index++;
    }));
    return {positions,normals,groups,centers,scale,count:index,signature:form.signature};
  }
  return {enumerate,particles,canonical,rotations,kernel};
})();

(() => {
  if(typeof document==='undefined')return;
  const canvas=document.querySelector('#surface-canvas');if(!canvas)return;
  const stage=canvas.parentElement,instrument=document.querySelector('#surface-instrument');
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const context=canvas.getContext('2d');if(!context)return;
  const engine=window.PortfolioGrammar,preference=matchMedia('(prefers-reduced-motion: reduce)');
  let pair='TL',forms=engine.enumerate(pair),index=0,nextIndex=1;
  let from=engine.particles(forms[0]),to=engine.particles(forms[1]);
  let elapsed=0,mix=0,angle=-.62,tilt=1.05,mode='points',hour=10;
  let separation=0,targetSeparation=0,width=0,height=0,camera;
  let paused=preference.matches,reduced=preference.matches,visible=true,active=true;
  let frame=null,last=0,dragging=false,pointer=null,previous=null;
  let gpu=null,dark=document.body.classList.contains('dark');

  function createGPU(){
    if(!window.WebGLRenderingContext)return null;
    const element=document.createElement('canvas');element.className='model-gpu-surface';element.setAttribute('aria-hidden','true');
    let gl;try{gl=element.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});}catch{return null;}
    if(!gl)return null;
    let program,buffer,attributes,uniforms,lost=false,dirty=true;
    const vertex=`precision highp float;
      attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aNormal; attribute float aGroup;
      uniform mat4 uMatrix; uniform float uMix; uniform float uSize; uniform float uSeparate;
      uniform vec3 uView; uniform vec3 uSun;
      varying mediump vec3 vNormal; varying mediump float vAlpha; varying mediump float vGroup;
      void main(){
        vec3 p=mix(aFrom,aTo,uMix);
        p.z+=sin(uMix*3.14159265)*.22*(aGroup*2.0-1.0);
        p.x+=(aGroup*2.0-1.0)*uSeparate*.8;
        vNormal=aNormal;vGroup=aGroup;
        vAlpha=.18+.67*max(dot(aNormal,uView),0.0)+.1*max(dot(aNormal,uSun),0.0);
        gl_Position=uMatrix*vec4(p,1.0);gl_PointSize=uSize;
      }`;
    const fragment=`precision mediump float;
      varying mediump vec3 vNormal; varying mediump float vAlpha; varying mediump float vGroup;
      uniform vec3 uInk; uniform vec3 uAccent; uniform int uMode;
      void main(){
        float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;
        vec3 color=mix(uInk,uAccent,vGroup*.48);
        if(uMode==2)color=normalize(vNormal)*.38+.5;
        float alpha=vAlpha*(1.0-smoothstep(.32,.5,d));
        gl_FragColor=vec4(color,alpha);
      }`;
    function initialize(){
      const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('Point shader unavailable');}return s;};
      const v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment);
      program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Point renderer unavailable');
      buffer=gl.createBuffer();attributes=['aFrom','aTo','aNormal','aGroup'].map(n=>gl.getAttribLocation(program,n));
      uniforms=Object.fromEntries(['uMatrix','uMix','uSize','uSeparate','uView','uSun','uInk','uAccent','uMode'].map(n=>[n,gl.getUniformLocation(program,n)]));
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);dirty=true;
    }
    try{initialize();}catch{return null;}
    stage.append(element);
    element.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;element.hidden=true;draw();});
    element.addEventListener('webglcontextrestored',()=>{try{initialize();lost=false;element.hidden=false;}catch{lost=true;}draw();});
    return {invalidate(){dirty=true;},draw(matrix,view,sun){
      if(lost||gl.isContextLost())return false;
      const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(width*dpr),h=Math.round(height*dpr);
      if(element.width!==w||element.height!==h){element.width=w;element.height=h;}
      gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      if(dirty){
        const data=new Float32Array(from.count*10);
        for(let i=0;i<from.count;i++){data.set(from.positions.subarray(i*3,i*3+3),i*10);data.set(to.positions.subarray(i*3,i*3+3),i*10+3);data.set(from.normals.subarray(i*3,i*3+3),i*10+6);data[i*10+9]=from.groups[i];}
        gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);dirty=false;
      }
      [3,3,3,1].forEach((size,i)=>{gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],size,gl.FLOAT,false,40,[0,12,24,36][i]);});
      gl.uniformMatrix4fv(uniforms.uMatrix,false,matrix);gl.uniform1f(uniforms.uMix,mix);gl.uniform1f(uniforms.uSeparate,separation);
      gl.uniform1f(uniforms.uSize,(width<600?1.65:2.15)*dpr);
      gl.uniform3fv(uniforms.uView,view);gl.uniform3fv(uniforms.uSun,sun);
      gl.uniform3fv(uniforms.uInk,dark?[.88,.91,.80]:[.10,.16,.14]);gl.uniform3fv(uniforms.uAccent,dark?[.77,.94,.30]:[.34,.45,.20]);
      gl.uniform1i(uniforms.uMode,mode==='normals'?2:0);gl.drawArrays(gl.POINTS,0,from.count);return true;
    }};
  }
  function update(){
    $('#building-variation').textContent=String(index+1).padStart(3,'0')+' / '+forms.length+' forms';
    $('#grammar-description').textContent=pair[0]+' + '+pair[1]+' · join without overlap · rotations removed';
    canvas.setAttribute('aria-label','Dotted porous 3D shape, combination '+pair[0]+' plus '+pair[1]+', arrangement '+(index+1)+' of '+forms.length+'. Drag or use arrow keys to orbit. Home resets the view.');
    canvas.dataset.family=pair;canvas.dataset.variation=String(index+1);canvas.dataset.count=String(forms.length);
    canvas.dataset.orientation=angle.toFixed(3);canvas.dataset.points=String(from.count);
    const off=paused||reduced;
    $('.motion-toggle').textContent=reduced?'Still':off?'Play ▷':'Pause Ⅱ';
    $('.motion-toggle').disabled=reduced;$('.motion-toggle').setAttribute('aria-pressed',String(off));
    $('.motion-toggle').setAttribute('aria-label',reduced?'Animation disabled by reduced motion preference':off?'Play shape transformations':'Pause shape transformations');
    instrument.dataset.playing=String(!off);
  }
  function snapshot(){
    const current={...from,positions:new Float32Array(from.positions.length),centers:from.centers.map((p,i)=>p.map((v,d)=>v*(1-mix)+to.centers[i][d]*mix)),scale:from.scale*(1-mix)+to.scale*mix};
    for(let i=0;i<from.count;i++)for(let d=0;d<3;d++)current.positions[i*3+d]=from.positions[i*3+d]*(1-mix)+to.positions[i*3+d]*mix+(d===2?Math.sin(mix*Math.PI)*.22*(from.groups[i]*2-1):0);
    return current;
  }
  function advance(manual=false){
    from=manual?snapshot():to;index=manual?(index+1)%forms.length:nextIndex;nextIndex=(index+1)%forms.length;
    to=engine.particles(forms[nextIndex]);elapsed=0;mix=0;
    if(manual){to=engine.particles(forms[index]);nextIndex=index;elapsed=1700;}
    if(reduced){from=to;index=nextIndex;nextIndex=(index+1)%forms.length;to=engine.particles(forms[nextIndex]);elapsed=0;}
    gpu?.invalidate();update();draw();schedule();
  }
  function draw(){
    if(!width||!height)return;
    const c=Math.cos(angle),s=Math.sin(angle),ct=Math.cos(tilt),st=Math.sin(tilt);
    const scale=Math.min(width*(width<700?.125:.12),(height-(width<700?60:95))/.9/7.6);
    camera={scale,x:width*.5,y:height*.49};
    const project=p=>[camera.x+(p[0]*c-p[1]*s)*scale,camera.y+((p[0]*s+p[1]*c)*ct-p[2]*st)*scale];
    const view=[s*st,c*st,ct],sun=[Math.cos((hour-6)/12*Math.PI),0,Math.sin((hour-6)/12*Math.PI)];
    const matrix=new Float32Array([2*scale*c/width,-2*scale*s*ct/height,-s*st/30,0,-2*scale*s/width,-2*scale*c*ct/height,-c*st/30,0,0,2*scale*st/height,-ct/30,0,2*camera.x/width-1,1-2*camera.y/height,0,1]);
    context.clearRect(0,0,width,height);
    const rendered=gpu?.draw(matrix,view,sun);canvas.dataset.renderer=rendered?'webgl':'canvas';
    if(!rendered){
      const buckets=Array.from({length:16},()=>[]),radius=width<600?.72:.96;
      for(let i=0;i<from.count;i++){
        const p=[0,1,2].map(d=>from.positions[i*3+d]*(1-mix)+to.positions[i*3+d]*mix);
        p[2]+=Math.sin(mix*Math.PI)*.22*(from.groups[i]*2-1);p[0]+=(from.groups[i]*2-1)*separation*.8;
        const facing=Math.max(0,[0,1,2].reduce((v,d)=>v+from.normals[i*3+d]*view[d],0));
        const light=Math.max(0,[0,1,2].reduce((v,d)=>v+from.normals[i*3+d]*sun[d],0));
        const bucket=Math.min(7,Math.floor((facing*.85+light*.15)*7))+from.groups[i]*8;
        buckets[bucket].push({p:project(p),i});
      }
      buckets.forEach((items,b)=>{
        context.globalAlpha=.18+(b%8)/7*.68;
        if(mode==='normals'){
          for(const {p,i} of items){context.fillStyle='rgb('+[0,1,2].map(d=>Math.round((from.normals[i*3+d]*.38+.5)*255)).join(',')+')';context.beginPath();context.arc(...p,radius,0,Math.PI*2);context.fill();}
        }else{
          context.fillStyle=dark?(b<8?'#e0e8cd':'#c6da91'):(b<8?'#1b2924':'#53643d');context.beginPath();
          for(const {p} of items){context.moveTo(p[0]+radius,p[1]);context.arc(...p,radius,0,Math.PI*2);}context.fill();
        }
      });
    }
    if(mode==='mesh'){
      context.globalAlpha=.12;context.strokeStyle=dark?'#eee9de':'#20231f';context.lineWidth=.65;
      from.centers.forEach((center,i)=>{
        const p=center.map((v,d)=>v*(1-mix)+to.centers[i][d]*mix),r=(from.scale*(1-mix)+to.scale*mix)/2;
        p[0]+=(i<4?-1:1)*separation*.8;
        for(let axis=0;axis<3;axis++)for(const a of [-1,1])for(const b of [-1,1]){
          const q=[...p],v=[...p];q[axis]-=r;v[axis]+=r;q[(axis+1)%3]+=a*r;v[(axis+1)%3]+=a*r;q[(axis+2)%3]+=b*r;v[(axis+2)%3]+=b*r;
          context.beginPath();context.moveTo(...project(q));context.lineTo(...project(v));context.stroke();
        }
      });
    }
    context.globalAlpha=1;canvas.dataset.mix=mix.toFixed(3);instrument.style.setProperty('--loop-progress',String(elapsed/5800));
  }
  const canAnimate=()=>!reduced&&visible&&active&&!document.hidden&&((!paused&&!dragging)||Math.abs(separation-targetSeparation)>.001);
  function tick(time){
    frame=null;if(!canAnimate()){last=0;return;}
    if(!last||time-last>=32){
      const delta=last?Math.min(time-last,100):16;last=time;
      if(!paused&&!dragging){elapsed+=delta;if(elapsed>=5800)advance();const t=Math.max(0,Math.min(1,(elapsed-1700)/3400));mix=t*t*(3-2*t);}
      separation+=(targetSeparation-separation)*(1-Math.exp(-delta/170));draw();
    }
    if(canAnimate()&&frame===null)frame=requestAnimationFrame(tick);
  }
  function schedule(){if(!canAnimate()){if(frame!==null)cancelAnimationFrame(frame);frame=null;last=0;}else if(frame===null)frame=requestAnimationFrame(tick);}
  function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);draw();}
  $$('[data-grammar-pair]').forEach(button=>button.addEventListener('click',()=>{
    pair=button.dataset.grammarPair;forms=engine.enumerate(pair);index=0;nextIndex=1;from=engine.particles(forms[0]);to=engine.particles(forms[1]);elapsed=0;mix=0;
    $$('[data-grammar-pair]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));gpu?.invalidate();update();draw();schedule();
  }));
  $('#generate-building').addEventListener('click',()=>{
    if(paused||reduced){index=(index+1)%forms.length;nextIndex=(index+1)%forms.length;from=engine.particles(forms[index]);to=engine.particles(forms[nextIndex]);elapsed=0;mix=0;gpu?.invalidate();update();draw();}
    else advance(true);
  });
  $('.motion-toggle').addEventListener('click',()=>{paused=!paused;update();schedule();});
  $$('[data-surface-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.surfaceMode;$$('[data-surface-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('#surface-readout').textContent=mode==='normals'?'RGB encodes surface orientation.':'A rule-based study, not a trained AI model.';draw();}));
  $('#sun-time').addEventListener('input',event=>{hour=Number(event.target.value);const time=String(Math.floor(hour)).padStart(2,'0')+':'+String(Math.round(hour%1*60)).padStart(2,'0');$('#sun-time-value').value=$('#sun-time-value').textContent=time;draw();});
  $('#explode-pavilion').addEventListener('click',()=>{targetSeparation=targetSeparation?0:1;$('#explode-pavilion').setAttribute('aria-pressed',String(!!targetSeparation));$('#explode-pavilion').textContent=targetSeparation?'Join the pieces':'Separate the pieces';if(reduced)separation=targetSeparation;instrument.dataset.assembly=targetSeparation?'exploded':'assembled';draw();schedule();});
  const reset=()=>{angle=-.62;tilt=1.05;update();draw();};$('#reset-pavilion').addEventListener('click',reset);
  canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();if(event.key==='Home')reset();else if(event.key==='ArrowLeft')angle-=.13;else if(event.key==='ArrowRight')angle+=.13;else tilt=Math.max(.25,Math.min(1.55,tilt+(event.key==='ArrowUp'?-.08:.08)));update();draw();});
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0||dragging)return;dragging=true;pointer=event.pointerId;previous={x:event.clientX,y:event.clientY};canvas.setPointerCapture?.(pointer);canvas.classList.add('is-dragging');schedule();});
  canvas.addEventListener('pointermove',event=>{if(!dragging||event.pointerId!==pointer)return;angle+=(event.clientX-previous.x)*.007;if(event.pointerType!=='touch')tilt=Math.max(.25,Math.min(1.55,tilt+(event.clientY-previous.y)*.004));previous={x:event.clientX,y:event.clientY};update();draw();},{passive:true});
  const finish=event=>{if(!dragging||event.pointerId!==pointer)return;dragging=false;pointer=null;previous=null;if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);canvas.classList.remove('is-dragging');schedule();};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,finish);
  const inspector=$('#scene-inspector');inspector.addEventListener('keydown',event=>{if(event.key==='Escape'){inspector.open=false;inspector.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',event=>{if(inspector.open&&!inspector.contains(event.target))inspector.open=false;});
  document.addEventListener('portfolio:theme',()=>{dark=document.body.classList.contains('dark');draw();});
  document.addEventListener('visibilitychange',schedule);
  preference.addEventListener('change',event=>{reduced=event.matches;if(reduced){mix=0;elapsed=0;separation=targetSeparation;}update();schedule();draw();});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.05}).observe(canvas);
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
  window.addEventListener('pagehide',()=>{active=false;schedule();});window.addEventListener('pageshow',()=>{active=true;schedule();});
  gpu=createGPU();update();resize();schedule();
})();
