/* Shared WebGL context, eight reusable building grammars, a bounded detail patch. */
'use strict';
window.CityRenderer=(()=>{
  const city=window.CityJourney;
  function create(gl,report=()=>{}){
    const instances=gl.getExtension('ANGLE_instanced_arrays');if(!instances){report('Instancing unavailable');return null;}
    const vertex=`precision highp float;
      attribute vec3 aVertex; attribute vec3 aTargetVertex; attribute vec4 aFace;
      attribute vec3 aFrom; attribute vec3 aTo; attribute vec4 aMeta;
      uniform mat4 uMatrix; uniform mat3 uPose; uniform float uMix; uniform mediump float uFocus; uniform float uSeparate;
      uniform float uRoute; uniform float uRadius;
      varying mediump vec3 vNormal; varying mediump vec2 vUV; varying mediump float vHeight; varying mediump float vSeed; varying mediump float vRoof; varying mediump float vPresence;
      void main(){
        vec3 p=mix(aFrom,aTo,uMix);
        float u=fract(aMeta.x)*6.2831853;
        vec3 n=normalize(p-vec3(2.84*cos(u),2.84*sin(u),0.0));
        vec3 along=vec3(-sin(u),cos(u),0.0);
        vec3 tangent=normalize(along-n*dot(along,n));
        vec3 side=normalize(cross(tangent,n));
        float height=.032+.12*aMeta.y*aMeta.y;
        float distance=abs(mod(fract(aMeta.x)*224.0-uRoute+112.0,224.0)-112.0);
        vPresence=1.0-smoothstep(uRadius-6.0,uRadius-2.0,distance);
        vec3 module=mix(aVertex,aTargetVertex,uMix);
        vec3 local=module*vec3(aMeta.z,height*smoothstep(.06,.72,uFocus)*vPresence,aMeta.w);
        p+=tangent*local.x+n*local.y+side*local.z;
        p=uPose*p;p.x-=uSeparate*.35;
        vNormal=uPose*normalize(tangent*aFace.x+n*aFace.y+side*aFace.z);
        vUV=vec2(mod(aFace.w,2.0),floor(aFace.w/2.0));vHeight=module.y;vSeed=aMeta.y;vRoof=aFace.y;
        gl_Position=uMatrix*vec4(p,1.0);
      }`;
    const fragment=`precision mediump float;
      uniform vec3 uSun; uniform vec3 uView; uniform float uDark; uniform mediump float uFocus; uniform int uMode;
      varying mediump vec3 vNormal; varying mediump vec2 vUV; varying mediump float vHeight; varying mediump float vSeed; varying mediump float vRoof; varying mediump float vPresence;
      void main(){
        if(vPresence<.001)discard;
        float alpha=smoothstep(.04,.3,uFocus)*vPresence;
        vec3 n=normalize(vNormal);
        vec3 ink=mix(vec3(.14,.17,.14),vec3(.71,.82,.75),uDark);
        if(uMode==1){gl_FragColor=vec4(ink,alpha*.72);return;}
        if(uMode==2){gl_FragColor=vec4(n*.38+.5,alpha);return;}
        float light=.22+.78*max(0.0,dot(n,normalize(uSun)));
        float highlight=pow(max(0.0,dot(n,normalize(normalize(uSun)+normalize(uView)))),18.0);
        vec3 paper=mix(vec3(.55,.59,.55),vec3(.98,.97,.92),light);
        vec3 night=mix(vec3(.055,.075,.064),vec3(.34,.40,.35),light);
        vec3 color=mix(paper,night,uDark);
        float glass=step(.82,vSeed)*(1.0-vRoof);
        color=mix(color,mix(vec3(.48,.59,.59),vec3(.08,.17,.16),uDark),glass*.35);
        color+=vec3(highlight*(.12+glass*.18));
        color*=.82+.18*smoothstep(0.0,.20,vHeight);
        float border=min(min(vUV.x,1.0-vUV.x),min(vUV.y,1.0-vUV.y));
        float edge=1.0-smoothstep(.003,.012,border);
        color=mix(color,ink,edge*.34);
        gl_FragColor=vec4(color,alpha);
      }`;
    let program,shaders=[];
    try{
      const compile=(type,source)=>{
        const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'City shader unavailable');return shader;
      };
      program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'City program unavailable');
    }catch(error){report(error.message);if(program)gl.deleteProgram(program);return null;}
    finally{shaders.forEach(shader=>gl.deleteShader(shader));}
    const attrs=Object.fromEntries(['aVertex','aTargetVertex','aFace','aFrom','aTo','aMeta'].map(name=>[name,gl.getAttribLocation(program,name)]));
    const uniforms=Object.fromEntries(['uMatrix','uPose','uMix','uFocus','uSeparate','uSun','uView','uDark','uMode','uRoute','uRadius'].map(name=>[name,gl.getUniformLocation(program,name)]));
    const meshes=city.boxes.map(()=>({solid:gl.createBuffer(),wire:gl.createBuffer(),solidCount:0,wireCount:0,instances:gl.createBuffer(),count:0}));
    let lastFrom=null,lastTo=null,lastPatch='';
    function updateGrammar(from,to){
      meshes.forEach((mesh,type)=>{
        for(const kind of ['solid','wire']){
          const a=city.prototype(type,kind==='wire',from),b=city.prototype(type,kind==='wire',to),count=a.length/7;
          const data=new Float32Array(count*10);
          for(let i=0;i<count;i++){
            data.set(a.subarray(i*7,i*7+3),i*10);data.set(b.subarray(i*7,i*7+3),i*10+3);data.set(a.subarray(i*7+3,i*7+7),i*10+6);
          }
          gl.bindBuffer(gl.ARRAY_BUFFER,mesh[kind]);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);mesh[kind+'Count']=count;
        }
      });
    }
    function update(from,to,route,compact){
      const key=Math.floor((44+route)/2)+':'+compact;
      if(lastFrom===from&&lastTo===to&&lastPatch===key)return;
      if(lastFrom!==from||lastTo!==to)updateGrammar(from,to);
      const groups=meshes.map(()=>[]);
      for(const i of city.patch(route,compact)){
        const seed=city.seed(i),size=city.dimensions(from,to,i);
        groups[city.typeAt(i)].push(...from.positions.subarray(i*3,i*3+3),...to.positions.subarray(i*3,i*3+3),from.groups[i],seed,...size);
      }
      groups.forEach((data,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,meshes[i].instances);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);meshes[i].count=data.length/10;});
      lastFrom=from;lastTo=to;lastPatch=key;
    }
    return {draw({matrix,poses,from,to,mix,focus,route,separation,sun,dark,mode,compact}){
      if(focus<.045)return 0;
      update(from,to,route,compact);gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.uMatrix,false,matrix);gl.uniformMatrix3fv(uniforms.uPose,false,poses[0]);
      gl.uniform1f(uniforms.uMix,mix);gl.uniform1f(uniforms.uFocus,focus);gl.uniform1f(uniforms.uSeparate,separation);
      gl.uniform1f(uniforms.uRoute,((44+route)%224+224)%224);gl.uniform1f(uniforms.uRadius,compact?12:20);
      gl.uniform3fv(uniforms.uSun,sun);gl.uniform1f(uniforms.uDark,dark?1:0);gl.uniform1i(uniforms.uMode,mode==='wireframe'?1:mode==='normals'?2:0);
      gl.uniform3fv(uniforms.uView,[matrix[4]*matrix[9]-matrix[8]*matrix[5],matrix[8]*matrix[1]-matrix[0]*matrix[9],matrix[0]*matrix[5]-matrix[4]*matrix[1]]);
      let count=0;
      for(const mesh of meshes){
        gl.bindBuffer(gl.ARRAY_BUFFER,mode==='wireframe'?mesh.wire:mesh.solid);
        [['aVertex',3,0],['aTargetVertex',3,12],['aFace',4,24]].forEach(([name,size,offset])=>{
          gl.enableVertexAttribArray(attrs[name]);gl.vertexAttribPointer(attrs[name],size,gl.FLOAT,false,40,offset);instances.vertexAttribDivisorANGLE(attrs[name],0);
        });
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.instances);
        [['aFrom',3,0],['aTo',3,12],['aMeta',4,24]].forEach(([name,size,offset])=>{
          gl.enableVertexAttribArray(attrs[name]);gl.vertexAttribPointer(attrs[name],size,gl.FLOAT,false,40,offset);
          instances.vertexAttribDivisorANGLE(attrs[name],1);
        });
        instances.drawArraysInstancedANGLE(mode==='wireframe'?gl.LINES:gl.TRIANGLES,0,mode==='wireframe'?mesh.wireCount:mesh.solidCount,mesh.count);count+=mesh.count;
      }
      // Attribute slots belong to both renderers; restore their divisor and enable state.
      Object.values(attrs).forEach(location=>{instances.vertexAttribDivisorANGLE(location,0);gl.disableVertexAttribArray(location);});
      return count;
    }};
  }
  function fallback(context,{matrix,poses,from,to,mix,focus,route,separation,sun,dark,mode,width,height}){
    if(focus<.045)return 0;
    const faces=[],ids=city.patch(route,true),project=p=>city.project(matrix,p,width,height);
    // Canvas devices show fewer, equally deterministic buildings nearest the camera.
    const candidates=ids.map(i=>({i,d:Math.abs(((Math.floor(i/64)-(44+route)+112)%224+224)%224-112)})).sort((a,b)=>a.d-b.d).slice(0,192);
    for(const {i} of candidates){
      const presence=city.detailWeight(i,route,true);if(presence<.001)continue;
      const basis=city.blendBasis(from,to,i,mix),seed=city.seed(i),size=city.dimensions(from,to,i);
      const growth=Math.min(1,Math.max(0,(focus-.06)/.66))*presence;
      const local=p=>{
        let q=city.add(basis.p,city.add(city.mul(basis.tangent,p[0]*size[0]),city.add(city.mul(basis.n,p[1]*(.032+.12*seed*seed)*growth),city.mul(basis.side,p[2]*size[1]))));
        q=city.rotate(poses[0],q);q[0]-=separation*.35;return project(q);
      };
      const type=city.typeAt(i),start=city.modules(type,from),end=city.modules(type,to);
      const modules=start.map((box,j)=>box.map((v,d)=>v*(1-mix)+end[j][d]*mix));
      for(const box of modules)city.faceCorners.forEach((corners,f)=>{
        const pts=corners.map(c=>local(c.map((v,d)=>box[d]+v*box[d+3])));if(pts.some(p=>!p))return;
        if(pts.every(p=>p[0]<-20)||pts.every(p=>p[0]>width+20)||pts.every(p=>p[1]<-20)||pts.every(p=>p[1]>height+20))return;
        const fn=city.faceNormals[f];
        const normal=city.rotate(poses[0],city.add(city.mul(basis.tangent,fn[0]),city.add(city.mul(basis.n,fn[1]),city.mul(basis.side,fn[2]))));
        const light=Math.max(0,city.dot(normal,sun)),value=dark?30+light*48:178+light*62;
        faces.push({pts,opacity:Math.min(1,focus*3)*presence,depth:pts.reduce((s,p)=>s+p[2],0)/4,color:mode==='normals'?'rgb('+normal.map(n=>Math.round((n*.38+.5)*255)).join(',')+')':`rgb(${value},${value+2},${value})`});
      });
    }
    context.globalAlpha=Math.min(1,focus*3);context.lineWidth=.65;context.strokeStyle=dark?'#abc4b2':'#343b33';
    faces.sort((a,b)=>b.depth-a.depth).forEach(({pts,color,opacity})=>{
      context.globalAlpha=opacity;
      context.beginPath();context.moveTo(pts[0][0],pts[0][1]);pts.slice(1).forEach(p=>context.lineTo(p[0],p[1]));context.closePath();
      if(mode!=='wireframe'){context.fillStyle=color;context.fill();}context.stroke();
    });
    context.globalAlpha=1;return candidates.length;
  }
  return {create,fallback};
})();
