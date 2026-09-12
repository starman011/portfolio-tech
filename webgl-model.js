/* Small depth-buffered renderer for the existing model contract. No dependency
 * or network request. The 2D renderer remains available when WebGL is absent.
 */
'use strict';
window.createPortfolioRenderer = function(stage) {
  if (!window.WebGLRenderingContext) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'model-gpu-surface';
  canvas.setAttribute('aria-hidden', 'true');
  let gl;
  try { gl = canvas.getContext('webgl', {alpha:true,antialias:true,depth:true,premultipliedAlpha:false}); } catch { return null; }
  if (!gl) return null;
  const vertexSource = `
    precision highp float;
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aMovement;
    attribute float aMaterial;
    attribute vec3 aPivot;
    attribute vec4 aMotion;
    attribute vec3 aAxis;
    uniform mat4 uMatrix;
    uniform float uSeparation;
    uniform float uPointSize;
    uniform float uTime;
    varying mediump vec3 vNormal;
    varying mediump float vMaterial;
    vec3 rotate(vec3 v, vec3 axis, float angle) {
      float c=cos(angle),s=sin(angle);
      return v*c+cross(axis,v)*s+axis*dot(axis,v)*(1.0-c);
    }
    vec2 pose(float phase) {
      if(phase<.5)return vec2(1.28*aMotion.y,0.0);
      if(phase<1.5)return vec2(.08,0.0);
      if(phase<2.5)return vec2(.68*aMotion.x*aMotion.y,.15);
      return vec2(-.35*aMotion.x*aMotion.y,aMotion.z);
    }
    void main() {
      vec3 p=aPosition,n=aNormal;
      if(abs(aMotion.x)>.1) {
        float phase=mod((uTime-aMotion.w)/4.0,4.0),i=floor(phase);
        float t=clamp((fract(phase)-.16)/.7,0.0,1.0);
        vec2 state=mix(pose(i),pose(mod(i+1.0,4.0)),t*t*(3.0-2.0*t));
        p=rotate(p-aPivot,aAxis,state.x)+aPivot+vec3(aMovement.xy*state.y,0.0);
        n=rotate(n,aAxis,state.x);
      }
      vNormal=n;
      vMaterial=aMaterial;
      gl_Position=uMatrix*vec4(p+aMovement*uSeparation,1.0);
      gl_PointSize=uPointSize;
    }`;
  const fragmentSource = `
    precision mediump float;
    varying mediump vec3 vNormal;
    varying mediump float vMaterial;
    uniform vec3 uSun;
    uniform vec3 uView;
    uniform vec3 uPalette[7];
    uniform vec3 uInk;
    uniform int uMode;
    uniform int uPass;
    vec3 materialColor() {
      if(vMaterial<0.5)return uPalette[0];
      if(vMaterial<1.5)return uPalette[1];
      if(vMaterial<2.5)return uPalette[2];
      if(vMaterial<3.5)return uPalette[3];
      if(vMaterial<4.5)return uPalette[4];
      if(vMaterial<5.5)return uPalette[5];
      return uPalette[6];
    }
    void main() {
      if(uPass==2) {
        if(length(gl_PointCoord-vec2(.5))>.5)discard;
        gl_FragColor=vec4(uInk,.92);return;
      }
      if(uPass==1) {gl_FragColor=vec4(uInk,1.0);return;}
      vec3 n=normalize(vNormal);
      if(uMode==2) {gl_FragColor=vec4(n*.5+.5,1.0);return;}
      vec3 base=materialColor();
      float direct=max(dot(n,uSun),0.0);
      float fill=max(dot(n,normalize(vec3(-.7,.8,.45))),0.0);
      float light=.52+direct*.40+fill*.18;
      if(uMode==1)light=.90;
      vec3 result=base*light;
      if(vMaterial>1.5 && vMaterial<2.5 && uMode==0) {
        float fresnel=pow(1.0-max(dot(n,uView),0.0),3.0);
        float highlight=pow(max(dot(reflect(-uSun,n),uView),0.0),32.0);
        result+=vec3(.17,.18,.17)*fresnel+vec3(.23)*highlight;
      }
      gl_FragColor=vec4(result,1.0);
    }`;
  let program, uniforms, attributes, lost=false, currentModel=null, batches=[];
  const materialIds={stone:0,trim:1,glass:2,core:3,roof:4,slab:5,plinth:6};
  function compile(type,source){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message);}
    return shader;
  }
  function initialize(){
    const vertex=compile(gl.VERTEX_SHADER,vertexSource),fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);
    program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw new Error(message);}
    attributes=['aPosition','aNormal','aMovement','aMaterial','aPivot','aMotion','aAxis'].map(name=>gl.getAttribLocation(program,name));
    uniforms=Object.fromEntries(['uMatrix','uSeparation','uPointSize','uTime','uSun','uView','uPalette[0]','uInk','uMode','uPass'].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
    // The portfolio's existing screen-space projection reverses winding.
    gl.frontFace(gl.CW);gl.clearColor(0,0,0,0);
    currentModel=null;batches=[];
  }
  try { initialize(); } catch { return null; }
  stage.append(canvas);
  function upload(model){
    for(const batch of batches)gl.deleteBuffer(batch.buffer);
    const triangles=[],lines=[],wire=[],dots=[];
    function push(data,p,n,item,material){
      data.push(...p,...n,...item.movement,material,...(item.motion?.pivot||[0,0,0]),...(item.motion?.rule||[0,0,0,0]),...(item.motion?.axis||[0,0,1]));
    }
    for(const face of model.faces){
      const id=materialIds[face.material];
      for(let i=1;i<face.vertices.length-1;i++)for(const p of [face.vertices[0],face.vertices[i],face.vertices[i+1]])push(triangles,p,face.normal,face,id);
      face.vertices.forEach((p,i)=>{push(wire,p,face.normal,face,id);push(wire,face.vertices[(i+1)%face.vertices.length],face.normal,face,id);});
    }
    for(const item of model.lines)for(let i=0;i<item.vertices.length-1;i++){
      push(lines,item.vertices[i],item.normal||[0,0,1],item,0);
      push(lines,item.vertices[i+1],item.normal||[0,0,1],item,0);
    }
    for(const item of model.points)push(dots,item.position,[0,0,1],item,0);
    batches=[triangles,lines,wire,dots].map(data=>{
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
      return {buffer,count:data.length/20};
    });
    currentModel=model;
  }
  function bind(batch){
    gl.bindBuffer(gl.ARRAY_BUFFER,batch.buffer);
    [3,3,3,1,3,4,3].forEach((size,i)=>{gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],size,gl.FLOAT,false,80,[0,12,24,36,40,52,68][i]);});
  }
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();lost=true;canvas.hidden=true;
    document.dispatchEvent(new Event('portfolio:render'));
  });
  canvas.addEventListener('webglcontextrestored',()=>{
    try{initialize();lost=false;canvas.hidden=false;}catch{lost=true;}
    document.dispatchEvent(new Event('portfolio:render'));
  });
  return {
    get element(){return canvas;},
    draw({model,camera,width,height,angle,viewTilt,separation,mode,sun,dark,time=0}){
      if(lost||gl.isContextLost())return false;
      if(model!==currentModel)upload(model);
      const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(width*dpr),h=Math.round(height*dpr);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      const c=Math.cos(angle),s=Math.sin(angle),ct=Math.cos(viewTilt),st=Math.sin(viewTilt),k=camera.scale;
      const matrix=new Float32Array([
        2*k*c/width,-2*k*s*ct/height,-s*st/30,0,
        -2*k*s/width,-2*k*c*ct/height,-c*st/30,0,
        0,2*k*st/height,-ct/30,0,
        2*camera.x/width-1,1-2*camera.y/height,0,1
      ]);
      gl.uniformMatrix4fv(uniforms.uMatrix,false,matrix);
      gl.uniform1f(uniforms.uSeparation,separation);gl.uniform1f(uniforms.uPointSize,2.4*dpr);
      gl.uniform1f(uniforms.uTime,time);
      gl.uniform3fv(uniforms.uSun,sun);gl.uniform3fv(uniforms.uView,[s*st,c*st,ct]);
      const palette=dark
        ? [.69,.71,.66, .92,.93,.86, .27,.32,.32, .12,.14,.14, .67,.46,.29, .36,.39,.37, .22,.25,.23]
        : [.83,.83,.78, .985,.98,.94, .29,.35,.36, .14,.16,.16, .73,.53,.35, .48,.50,.47, .84,.83,.78];
      gl.uniform3fv(uniforms['uPalette[0]'],palette);
      gl.uniform1i(uniforms.uMode,mode==='normals'?2:mode==='mesh'?1:0);
      if(mode==='points'){
        gl.uniform3fv(uniforms.uInk,dark?[.88,.91,.84]:[.19,.23,.20]);gl.uniform1i(uniforms.uPass,2);
        bind(batches[3]);gl.drawArrays(gl.POINTS,0,batches[3].count);return true;
      }
      gl.uniform1i(uniforms.uPass,0);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
      bind(batches[0]);gl.drawArrays(gl.TRIANGLES,0,batches[0].count);gl.disable(gl.POLYGON_OFFSET_FILL);
      if(mode!=='normals'){
        gl.uniform1i(uniforms.uPass,1);gl.uniform3fv(uniforms.uInk,dark?[.45,.49,.43]:[.36,.38,.34]);
        if(batches[1].count){bind(batches[1]);gl.drawArrays(gl.LINES,0,batches[1].count);}
        if(mode==='mesh'){gl.uniform3fv(uniforms.uInk,dark?[.35,.43,.33]:[.36,.39,.33]);bind(batches[2]);gl.drawArrays(gl.LINES,0,batches[2].count);}
      }
      return true;
    }
  };
};
