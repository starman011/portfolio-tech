(() => {
  if(typeof document==='undefined')return;
  const canvas=document.querySelector('#surface-canvas');if(!canvas)return;
  const stage=canvas.parentElement,instrument=document.querySelector('#surface-instrument');
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const context=canvas.getContext('2d');if(!context)return;
  const engine=window.PermutationField,city=window.CityJourney,journey=city.createJourney(),preference=matchMedia('(prefers-reduced-motion: reduce)');
  let enabled=[...engine.rules],forms=engine.enumerate(enabled),index=0,nextIndex=1,lastRule=null;
  let from=engine.particles(forms[0]),to=engine.particles(forms[1]);
  let dark=document.body.classList.contains('dark');
  const HOLD=650,MORPH=4800,REST=450;
  let elapsed=0,mix=0,morphDuration=MORPH,angle=-.82,tilt=.92,mode='points',hour=10;
  let separation=0,targetSeparation=0,width=0,height=0,camera;
  let paused=preference.matches,reduced=preference.matches,visible=true,lingering=true,active=true;
  let frame=null,last=0,dragging=false,pointer=null,previous=null;
  let gpu=null,clock=0,journeyUI='',closeFrozen=false,cityMorph=false;

  function createGPU(){
    if(!window.WebGLRenderingContext)return null;
    const element=document.createElement('canvas');element.className='model-gpu-surface';element.setAttribute('aria-hidden','true');
    let gl;try{gl=element.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});}catch{return null;}
    if(!gl)return null;
    let program,buffer,wireBuffer,anchorBuffer,anchorKey='',anchorCount=0,attributes,uniforms,cityGPU,lost=false,dirty=true;
    const vertex=`precision highp float;
      attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aNormal; attribute vec3 aTargetNormal; attribute float aGroup;
      uniform mat4 uMatrix; uniform float uMix; uniform float uSize; uniform float uSeparate; uniform float uTime;
      uniform float uAnchor; uniform float uRoute; uniform float uDetailRadius;
      uniform vec3 uView; uniform vec3 uSun;
      uniform mat3 uPose0; uniform mat3 uPose1;
      varying mediump vec3 vNormal; varying mediump float vAlpha; varying mediump float vGroup;
      void main(){
        vec3 p=mix(aFrom,aTo,uMix);
        vec3 n=normalize(mix(aNormal,aTargetNormal,uMix));
        float part=floor(aGroup),along=fract(aGroup);
        mat3 pose=uPose0;
        if(part>.5)pose=uPose1;
        p=pose*p;n=pose*n;
        p.x+=(part*2.0-1.0)*uSeparate*.35;
        float pulse=pow(max(0.0,cos(along*18.84956-uTime*.65)),12.0);
        vNormal=n;vGroup=aGroup;
        vAlpha=.20+.50*abs(dot(n,uView))+.16*pulse+.10*max(0.0,dot(n,uSun));
        float distance=abs(mod(along*224.0-uRoute+112.0,224.0)-112.0);
        float presence=1.0-smoothstep(uDetailRadius-6.0,uDetailRadius-2.0,distance);
        vAlpha*=mix(1.0,presence,uAnchor);
        gl_Position=uMatrix*vec4(p,1.0);gl_PointSize=uSize*(.85+pulse*.7);
      }`;
    const fragment=`precision mediump float;
      varying mediump vec3 vNormal; varying mediump float vAlpha; varying mediump float vGroup;
      uniform vec3 uInk; uniform vec3 uAccent; uniform int uMode; uniform float uFocus;
      void main(){
        vec3 color=mix(uInk,uAccent,mod(floor(vGroup),2.0));
        if(uMode==2)color=normalize(vNormal)*.38+.5;
        float alpha=vAlpha*(1.0-uFocus*.18);
        if(uMode!=1){
          float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;
          alpha*=1.0-smoothstep(.32,.5,d);
        }
        gl_FragColor=vec4(color,alpha);
      }`;
    function initialize(){
      const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('Point shader unavailable');}return s;};
      const v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment);
      program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Point renderer unavailable');
      buffer=gl.createBuffer();attributes=['aFrom','aTo','aNormal','aTargetNormal','aGroup'].map(n=>gl.getAttribLocation(program,n));
      wireBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,wireBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,engine.wireIndices,gl.STATIC_DRAW);
      anchorBuffer=gl.createBuffer();anchorKey='';
      uniforms=Object.fromEntries(['uMatrix','uMix','uSize','uSeparate','uTime','uView','uSun','uInk','uAccent','uMode','uPose0','uPose1','uFocus','uAnchor','uRoute','uDetailRadius'].map(n=>[n,gl.getUniformLocation(program,n)]));
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);dirty=true;
      delete canvas.dataset.cityIssue;cityGPU=window.CityRenderer.create(gl,message=>{canvas.dataset.cityIssue=message;});
    }
    try{initialize();}catch{return null;}
    stage.append(element);
    element.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;element.hidden=true;draw();});
    element.addEventListener('webglcontextrestored',()=>{try{initialize();lost=false;element.hidden=false;}catch{lost=true;}draw();});
    return {invalidate(){dirty=true;},draw(matrix,view,sun,poses){
      if(lost||gl.isContextLost())return false;
      if(journey.state.focus>.045&&!cityGPU){element.hidden=true;return false;}
      element.hidden=false;
      const dpr=Math.min(devicePixelRatio||1,journey.state.focus>.045?(width<700?1.25:1.5):2),w=Math.round(width*dpr),h=Math.round(height*dpr);
      if(element.width!==w||element.height!==h){element.width=w;element.height=h;}
      gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      if(dirty){
        const data=new Float32Array(from.count*13);
        for(let i=0;i<from.count;i++){data.set(from.positions.subarray(i*3,i*3+3),i*13);data.set(to.positions.subarray(i*3,i*3+3),i*13+3);data.set(from.normals.subarray(i*3,i*3+3),i*13+6);data.set(to.normals.subarray(i*3,i*3+3),i*13+9);data[i*13+12]=from.groups[i];}
        gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);dirty=false;
      }
      [3,3,3,3,1].forEach((size,i)=>{gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],size,gl.FLOAT,false,52,[0,12,24,36,48][i]);});
      gl.uniformMatrix4fv(uniforms.uMatrix,false,matrix);gl.uniform1f(uniforms.uMix,mix);gl.uniform1f(uniforms.uTime,clock);gl.uniform1f(uniforms.uSeparate,separation);
      poses.forEach((pose,i)=>gl.uniformMatrix3fv(uniforms['uPose'+i],false,pose));
      gl.uniform1f(uniforms.uSize,(width<600?1.75:2.5)*dpr);
      gl.uniform1f(uniforms.uAnchor,0);gl.uniform1f(uniforms.uRoute,((44+journey.state.route)%224+224)%224);gl.uniform1f(uniforms.uDetailRadius,width<700?12:20);
      gl.uniform3fv(uniforms.uView,view);gl.uniform3fv(uniforms.uSun,sun);
      const ink=dark?(mode==='wireframe'?[.88,.95,.91]:[.97,.73,.50]):[.08,.09,.08];
      const accent=dark?(mode==='wireframe'?[.88,.95,.91]:[.64,.96,.81]):ink;
      gl.uniform3fv(uniforms.uInk,ink);gl.uniform3fv(uniforms.uAccent,accent);
      gl.uniform1i(uniforms.uMode,mode==='normals'?2:mode==='wireframe'?1:0);
      gl.uniform1f(uniforms.uFocus,journey.state.focus);
      gl.depthMask(false);
      if(mode==='wireframe'){
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,wireBuffer);gl.lineWidth(1);gl.drawElements(gl.LINES,engine.wireIndices.length,gl.UNSIGNED_SHORT,0);
      }else gl.drawArrays(gl.POINTS,0,from.count);
      gl.depthMask(true);
      canvas.dataset.buildings=String(cityGPU?.draw({matrix,poses,from,to,mix,...journey.state,separation,sun,dark,mode,compact:width<700})||0);
      if(mode==='points'&&journey.state.focus>.045){
        // Redraw only the occupied dots as origin markers, legible through their volumes.
        const key=Math.floor((44+journey.state.route)/2)+':'+(width<700);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,anchorBuffer);
        if(key!==anchorKey){const ids=new Uint16Array(city.patch(journey.state.route,width<700));anchorCount=ids.length;gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ids,gl.STATIC_DRAW);anchorKey=key;}
        gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        [3,3,3,3,1].forEach((size,i)=>{gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],size,gl.FLOAT,false,52,[0,12,24,36,48][i]);});
        gl.uniform1f(uniforms.uSize,3.2*dpr);gl.uniform1f(uniforms.uFocus,0);gl.uniform1f(uniforms.uAnchor,1);
        gl.uniform3fv(uniforms.uInk,dark?[.76,.92,.70]:[.08,.09,.08]);gl.uniform3fv(uniforms.uAccent,dark?[.76,.92,.70]:[.08,.09,.08]);
        gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.drawElements(gl.POINTS,anchorCount,gl.UNSIGNED_SHORT,0);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
      }
      return true;
    }};
  }
  function update(){
    $('#building-variation').textContent=String(index+1).padStart(2,'0')+' / '+forms.length;
    $('#permutation-total').textContent=enabled.length+' rule'+(enabled.length===1?'':'s')+' · '+forms.length+' permutation'+(forms.length===1?'':'s');
    const instruction=enabled.length===1?'Enable another rule to compare forms.':lastRule?lastRule+' moved to step '+(forms[index].order.indexOf(lastRule)+1)+'.':'Tap a rule. Change the form.';
    if($('#grammar-description').textContent!==instruction)$('#grammar-description').textContent=instruction;
    canvas.setAttribute('aria-label','Two circular rings at 90 degrees. Their dots reveal procedural buildings when you look closer. '+(mode==='normals'?'RGB normals':mode==='wireframe'?'Wireframe':'Dots')+' view. Surface operations: '+forms[index].order.join(', ')+'. Arrangement '+(index+1)+' of '+forms.length+'. Drag or use arrow keys to look around. Home returns to the whole form.');
    canvas.dataset.variation=String(index+1);canvas.dataset.count=String(forms.length);canvas.dataset.order=forms[index].order.join('/');
    canvas.dataset.orientation=angle.toFixed(3);canvas.dataset.points=String(from.count);
    const bar=$('.grammar-steps'),focused=document.activeElement;
    const order=[...forms[index].order,...engine.rules.filter(r=>!enabled.includes(r))];
    for(const [position,name] of order.entries()){
      const button=$('[data-rule="'+name+'"]');button.hidden=!enabled.includes(name);button.disabled=enabled.length===1;button.classList.toggle('is-active',name===lastRule);
      button.setAttribute('aria-label',name+': move to step '+((position+1)%enabled.length+1)+' and change the ring profile');
      if(bar.children[position]!==button)bar.insertBefore(button,bar.children[position]||null);
    }
    if(bar.contains(focused)&&!focused.hidden&&document.activeElement!==focused)focused.focus({preventScroll:true});
    $$('[data-enabled-rule]').forEach(input=>{input.checked=enabled.includes(input.dataset.enabledRule);input.disabled=input.checked&&enabled.length===1;});
    $('#generate-building').disabled=forms.length<2;
    const off=paused||reduced;
    $('.motion-toggle').textContent=reduced?'Still':off?'Play':'Pause';
    $('.motion-toggle').disabled=reduced;$('.motion-toggle').setAttribute('aria-pressed',String(off));
    $('.motion-toggle').setAttribute('aria-label',reduced?'Animation disabled by reduced motion preference':off?'Play form and camera':'Pause form and camera');
    instrument.dataset.playing=String(!off);
    document.dispatchEvent(new CustomEvent('portfolio:field-state',{detail:{playing:!off&&visible&&active&&!document.hidden}}));
    updateJourney();
  }
  function updateJourney(){
    const state=journey.state,closer=state.focus>.001||state.moving;
    canvas.dataset.journeyProgress=state.focus.toFixed(3);
    const key=[state.phase,closer,reduced,paused].join('/');if(key===journeyUI)return;journeyUI=key;
    $('#city-journey').textContent=closer?'Whole form':'Look closer';
    $('#city-journey').setAttribute('aria-label',closer?'Return to the whole form':'Look closer: reveal the procedural buildings');
    $('#city-journey').setAttribute('aria-pressed',String(closer));
    canvas.dataset.journey=state.phase;
    instrument.dataset.journey=state.phase;
    const caption=state.phase==='overview'?(reduced?'A world inside each point.':'Stay a little. There’s more inside.'):
      state.phase==='city'?'A point becomes a place.':state.phase==='return'?'A different way to see the whole.':'From a field of points to a field of possibilities.';
    if($('#journey-caption').textContent!==caption)$('#journey-caption').textContent=caption;
    const status=state.phase==='city'?'Close-up of a procedural city. '+(paused||reduced?'Motion is paused.':'The camera glides along the ring.')+' Whole form returns to the rings.':
      state.phase==='overview'?'The whole form. Two perpendicular rings of points.':'';
    if(status&&$('#journey-status').textContent!==status)$('#journey-status').textContent=status;
  }
  function appearance(){
    $$('[data-surface-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.surfaceMode===mode)));
    canvas.dataset.mode=mode;canvas.dataset.theme=dark?'dark':'light';
    $('#surface-readout').textContent=mode==='normals'?'Surface orientation, encoded in RGB.':closeFrozen?'The dots stay still while the camera glides. Change the rules to combine simple building volumes.':'Eight basic assemblies. Change their order. Look closer to hold the form and explore its buildings.';
  }
  function blendedNormal(i){
    const n=[0,1,2].map(d=>from.normals[i*3+d]*(1-mix)+to.normals[i*3+d]*mix),length=Math.hypot(...n)||1;
    return n.map(v=>v/length);
  }
  function snapshot(){
    const current={...from,positions:new Float32Array(from.positions.length),normals:new Float32Array(from.normals.length)};
    current.cityForms=city.boxes.map((_,type)=>city.modules(type,from).map((box,j)=>box.map((v,d)=>v*(1-mix)+city.modules(type,to)[j][d]*mix)));
    for(let i=0;i<from.count;i++){
      current.normals.set(blendedNormal(i),i*3);
      for(let d=0;d<3;d++)current.positions[i*3+d]=from.positions[i*3+d]*(1-mix)+to.positions[i*3+d]*mix;
    }
    return current;
  }
  function advance(){
    from=to;index=nextIndex;nextIndex=(index+1)%forms.length;
    to=engine.particles(forms[nextIndex]);elapsed=0;mix=0;morphDuration=MORPH;lastRule=null;
    gpu?.invalidate();update();draw();schedule();
  }
  function freezeField(){
    if(closeFrozen)return;
    from=snapshot();to=from;mix=0;elapsed=0;closeFrozen=true;cityMorph=false;
    gpu?.invalidate();appearance();
  }
  function thawField(){
    if(!closeFrozen)return;
    from=snapshot();nextIndex=(index+1)%forms.length;to=engine.particles(forms[nextIndex]);mix=0;elapsed=0;morphDuration=MORPH;
    closeFrozen=false;cityMorph=false;gpu?.invalidate();appearance();
  }
  function setJourney(target){
    if(target)freezeField();
    journey.request(target,reduced||paused);
    if(!journey.state.focus&&!journey.state.moving)thawField();
    updateJourney();draw();schedule();
  }
  function vertexAt(i,poses){
    const group=from.groups[i],part=Math.floor(group),along=group-part;
    const pose=poses[part],normal=blendedNormal(i),position=[0,1,2].map(d=>from.positions[i*3+d]*(1-mix)+to.positions[i*3+d]*mix);
    const rotate=v=>[pose[0]*v[0]+pose[3]*v[1]+pose[6]*v[2],pose[1]*v[0]+pose[4]*v[1]+pose[7]*v[2],pose[2]*v[0]+pose[5]*v[1]+pose[8]*v[2]];
    const p=rotate(position),n=rotate(normal);
    p[0]+=(part*2-1)*separation*.35;
    const pulse=Math.pow(Math.max(0,Math.cos(along*18.84956-clock*.65)),12);
    return {p,normal:n,part,pulse};
  }
  function draw(){
    if(!width||!height)return;
    const c=Math.cos(angle),s=Math.sin(angle),ct=Math.cos(tilt),st=Math.sin(tilt);
    const compact=matchMedia('(max-width: 900px)').matches;
    // Reserve a full circular envelope through every rotation; the form owns
    // the opening while the copy and controls sit outside its central silhouette.
    const scale=Math.min(width*(compact?.156:.19),(height-(compact?24:64))/6.4)/(1+.12*separation);
    camera={scale,x:width*.5,y:height*(compact?.50:.46)};
    const view=[s*st,c*st,ct],sun=[Math.cos((hour-6)/12*Math.PI),0,Math.sin((hour-6)/12*Math.PI)];
    const overview=new Float32Array([2*scale*c/width,-2*scale*s*ct/height,-s*st/30,0,-2*scale*s/width,-2*scale*c*ct/height,-c*st/30,0,0,2*scale*st/height,-ct/30,0,2*camera.x/width-1,1-2*camera.y/height,0,1]);
    const poses=engine.motion(clock);
    const matrix=city.camera({overview,from,to,mix,poses,...journey.state,separation,aspect:width/height,yaw:angle+.82,pitch:tilt-.92});
    const project=p=>city.project(matrix,p,width,height);
    context.clearRect(0,0,width,height);
    const rendered=gpu?.draw(matrix,view,sun,poses);canvas.dataset.renderer=rendered?'webgl':'canvas';
    if(!rendered){
      const vertices=Array.from({length:from.count},(_,i)=>{
        const vertex=vertexAt(i,poses),n=vertex.normal;
        const facing=Math.abs(n.reduce((v,x,d)=>v+x*view[d],0)),light=Math.max(0,n.reduce((v,x,d)=>v+x*sun[d],0));
        vertex.alpha=(.20+.50*facing+.16*vertex.pulse+.10*light)*(1-journey.state.focus*.18);
        vertex.p=project(vertex.p);return vertex;
      });
      if(mode==='wireframe'){
        const lines=Array.from({length:8},()=>[]);
        for(let i=0;i<engine.wireIndices.length;i+=2){
          const a=engine.wireIndices[i],b=engine.wireIndices[i+1],bucket=Math.min(7,Math.floor((vertices[a].alpha+vertices[b].alpha)*4));
          if(!vertices[a].p||!vertices[b].p)continue;
          lines[bucket].push(a,b);
        }
        context.strokeStyle=dark?'#e0f2e8':'#141714';context.lineWidth=.8;context.lineCap='round';
        lines.forEach((indices,bucket)=>{
          context.globalAlpha=(bucket+.5)/8;context.beginPath();
          for(let i=0;i<indices.length;i+=2){const a=vertices[indices[i]].p,b=vertices[indices[i+1]].p;context.moveTo(a[0],a[1]);context.lineTo(b[0],b[1]);}
          context.stroke();
        });
      }else{
        const buckets=Array.from({length:16},()=>[]),radius=width<600?.72:.96;
        vertices.forEach(vertex=>{if(vertex.p&&vertex.p[0]>-20&&vertex.p[0]<width+20&&vertex.p[1]>-20&&vertex.p[1]<height+20)buckets[Math.min(7,Math.floor(vertex.alpha*8))+(vertex.part%2)*8].push(vertex);});
        buckets.forEach((items,b)=>{
          context.globalAlpha=(b%8+.5)/8;
          if(mode==='normals'){
            for(const {p,normal,pulse} of items){context.fillStyle='rgb('+normal.map(n=>Math.round((n*.38+.5)*255)).join(',')+')';context.beginPath();context.arc(p[0],p[1],radius*(.85+pulse*.7),0,Math.PI*2);context.fill();}
          }else{
            context.fillStyle=dark?(b<8?'#e9bd8c':'#b4eed1'):'#141714';context.beginPath();
            for(const {p,pulse} of items){const r=radius*(.85+pulse*.7);context.moveTo(p[0]+r,p[1]);context.arc(p[0],p[1],r,0,Math.PI*2);}context.fill();
          }
        });
      }
      canvas.dataset.buildings=String(window.CityRenderer.fallback(context,{matrix,poses,from,to,mix,...journey.state,separation,sun,dark,mode,width,height}));
      if(mode==='points'&&journey.state.focus>.045){
        context.fillStyle=dark?'#c1ebb2':'#141714';
        for(const i of city.patch(journey.state.route,true)){
          const p=vertices[i].p,presence=city.detailWeight(i,journey.state.route,true);if(!p||presence<.001)continue;
          context.globalAlpha=.8*presence;context.beginPath();context.arc(p[0],p[1],1.4,0,Math.PI*2);context.fill();
        }
      }
    }
    context.globalAlpha=1;canvas.dataset.mix=mix.toFixed(3);canvas.dataset.clock=clock.toFixed(3);
    canvas.dataset.geometryFrozen=String(closeFrozen);canvas.dataset.cameraRoute=journey.state.route.toFixed(3);
    instrument.style.setProperty('--loop-progress',String(elapsed/(HOLD+morphDuration+REST)));
    updateJourney();
  }
  const canAnimate=()=>!reduced&&visible&&active&&!document.hidden&&((!paused&&!dragging)||Math.abs(separation-targetSeparation)>.001);
  function tick(time){
    frame=null;if(!canAnimate()){last=0;return;}
    if(!last||time-last>=(canvas.dataset.renderer==='webgl'?15:32)){
      const delta=last?Math.min(time-last,100):16;last=time;
      if(!paused&&!dragging){
        journey.advance(delta/1000,{present:lingering,inspecting:$('#scene-inspector').open});
        if(journey.state.focus>0)freezeField();
        else if(!journey.state.moving)thawField();
        if(!closeFrozen){
          clock+=delta/1000;elapsed+=delta;
          if(elapsed>=HOLD+morphDuration+REST)advance();
        }else if(cityMorph)elapsed+=delta;
        if(!closeFrozen||cityMorph){
          const t=Math.max(0,Math.min(1,(elapsed-HOLD)/morphDuration));mix=t*t*t*(10+t*(6*t-15));
          if(closeFrozen&&t===1){from=to;mix=0;cityMorph=false;gpu?.invalidate();}
        }
      }
      separation+=(targetSeparation-separation)*(1-Math.exp(-delta/170));draw();
    }
    if(canAnimate()&&frame===null)frame=requestAnimationFrame(tick);
  }
  function schedule(){if(!canAnimate()){if(frame!==null)cancelAnimationFrame(frame);frame=null;last=0;}else if(frame===null)frame=requestAnimationFrame(tick);document.dispatchEvent(new CustomEvent('portfolio:field-state',{detail:{playing:canAnimate()}}));}
  function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);draw();}
  function choose(order,rule=null){
    const target=forms.findIndex(f=>f.signature===order.join('/'));
    if(target<0)return;
    from=snapshot();index=target;nextIndex=index;elapsed=HOLD;mix=0;morphDuration=1050;
    if(closeFrozen){
      to={...from,signature:forms[index].signature,cityForms:city.boxes.map((_,type)=>city.modules(type,forms[index]))};cityMorph=true;
      if(reduced||paused){from=to;cityMorph=false;elapsed=0;}
    }else{
      to=engine.particles(forms[index]);
      if(reduced||paused){from=to;nextIndex=(index+1)%forms.length;to=engine.particles(forms[nextIndex]);elapsed=0;}
    }
    lastRule=rule;gpu?.invalidate();update();draw();schedule();
  }
  $$('[data-rule]').forEach(button=>button.addEventListener('click',()=>{
    const rule=button.dataset.rule,order=[...forms[index].order],a=order.indexOf(rule),b=(a+1)%order.length;
    if(a<0||order.length<2)return;
    [order[a],order[b]]=[order[b],order[a]];choose(order,rule);
  }));
  $$('[data-enabled-rule]').forEach(input=>input.addEventListener('change',()=>{
    const next=$$('[data-enabled-rule]').filter(i=>i.checked).map(i=>i.dataset.enabledRule);
    if(!next.length){input.checked=true;return;}
    const previous=[...forms[index].order];enabled=next;forms=engine.enumerate(enabled);
    choose([...previous.filter(r=>enabled.includes(r)),...enabled.filter(r=>!previous.includes(r))]);
  }));
  $('#generate-building').addEventListener('click',()=>choose(forms[(index+7)%forms.length].order));
  $('.motion-toggle').addEventListener('click',()=>{paused=!paused;update();schedule();});
  $('#city-journey').addEventListener('click',()=>setJourney(journey.state.focus>.001||journey.state.moving?0:1));
  $$('[data-surface-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.surfaceMode;appearance();update();draw();}));
  $('#sun-time').addEventListener('input',event=>{hour=Number(event.target.value);const time=String(Math.floor(hour)).padStart(2,'0')+':'+String(Math.round(hour%1*60)).padStart(2,'0');$('#sun-time-value').value=$('#sun-time-value').textContent=time;draw();});
  $('#explode-pavilion').addEventListener('click',()=>{targetSeparation=targetSeparation?0:1;$('#explode-pavilion').setAttribute('aria-pressed',String(!!targetSeparation));$('#explode-pavilion').textContent=targetSeparation?'Gather the field':'Open the field';if(reduced)separation=targetSeparation;instrument.dataset.assembly=targetSeparation?'exploded':'assembled';draw();schedule();});
  const reset=()=>{angle=-.82;tilt=.92;setJourney(0);update();};$('#reset-pavilion').addEventListener('click',reset);
  canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();if(event.key==='Home')reset();else if(event.key==='ArrowLeft')angle-=.13;else if(event.key==='ArrowRight')angle+=.13;else tilt=Math.max(.25,Math.min(1.55,tilt+(event.key==='ArrowUp'?-.08:.08)));update();draw();});
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0||dragging)return;dragging=true;pointer=event.pointerId;previous={x:event.clientX,y:event.clientY};canvas.setPointerCapture?.(pointer);canvas.classList.add('is-dragging');schedule();});
  canvas.addEventListener('pointermove',event=>{if(!dragging||event.pointerId!==pointer)return;angle+=(event.clientX-previous.x)*.007;if(event.pointerType!=='touch')tilt=Math.max(.25,Math.min(1.55,tilt+(event.clientY-previous.y)*.004));previous={x:event.clientX,y:event.clientY};update();draw();},{passive:true});
  const finish=event=>{if(!dragging||event.pointerId!==pointer)return;dragging=false;pointer=null;previous=null;if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);canvas.classList.remove('is-dragging');schedule();};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,finish);
  const inspector=$('#scene-inspector');inspector.addEventListener('keydown',event=>{if(event.key==='Escape'){inspector.open=false;inspector.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',event=>{if(inspector.open&&!inspector.contains(event.target))inspector.open=false;});
  document.addEventListener('portfolio:theme',()=>{dark=document.body.classList.contains('dark');appearance();draw();});
  document.addEventListener('visibilitychange',schedule);
  preference.addEventListener('change',event=>{reduced=event.matches;if(reduced){separation=targetSeparation;setJourney(0);}update();schedule();draw();});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;lingering=entries[0].intersectionRatio>.55;schedule();},{threshold:[0,.05,.55]}).observe(canvas);
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
  window.addEventListener('pagehide',()=>{active=false;schedule();});window.addEventListener('pageshow',()=>{active=true;schedule();});
  gpu=createGPU();appearance();update();resize();schedule();
})();
