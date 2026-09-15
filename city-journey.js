/* A bounded change of scale: every building inherits a point on the ring.
 * Procedural geometry, not a trained model or a simulation of a real city. */
'use strict';
window.CityJourney=(()=>{
  const TAU=Math.PI*2,wrap=(n,m)=>((n%m)+m)%m;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const ease=n=>{const t=clamp(n);return t*t*t*(10+t*(6*t-15));};
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,n)=>a.map(v=>v*n);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const unit=a=>mul(a,1/(Math.hypot(...a)||1));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const rotate=(m,p)=>[0,1,2].map(r=>m[r]*p[0]+m[r+3]*p[1]+m[r+6]*p[2]);
  const seed=i=>{let n=Math.imul(i+17,1597334677);n^=n>>>16;n=Math.imul(n,2246822519);return (n>>>0)/4294967296;};
  const index=(u,v=0,part=0)=>wrap(u,224)*64+part*32+wrap(v,32);
  const boxes=[
    [[0,.08,0,1,.16,1],[0,.36,0,.68,.40,.74],[0,.70,0,.42,.28,.46]],
    [[0,.14,0,1,.28,1],[-.16,.41,0,.68,.26,.82],[-.28,.64,0,.42,.20,.64]],
    [[-.36,.29,0,.28,.58,1],[.36,.39,0,.28,.78,1],[0,.19,-.36,.44,.38,.28],[0,.19,.36,.44,.38,.28]],
    [[0,.10,0,1,.20,1],[-.14,.36,0,.52,.32,.74],[.04,.64,0,.80,.24,.56],[.16,.85,0,.44,.18,.52]],
    [[0,.06,0,1,.12,1],[-.3,.47,0,.32,.70,.68],[.3,.38,0,.32,.52,.68],[0,.60,0,.28,.12,.42]],
    [[-.35,.21,0,.30,.42,1],[.15,.14,-.34,.70,.28,.32]],
    [[-.33,.32,0,.28,.64,.62],[.33,.32,0,.28,.64,.62],[0,.69,0,.94,.18,.70]],
    [[0,.10,0,.94,.20,.94],[0,.34,0,.64,.28,.42],[0,.57,0,.42,.18,.86],[0,.79,0,.28,.26,.34]]
  ];
  const typologies=['Setback tower','Stepped terraces','Courtyard','Offset stack','Paired towers','Garden court','Bridge house','Cross-axis stack'];
  const layoutCache=new Map();
  function modules(type,form){
    if(form?.cityForms)return form.cityForms[type];
    const signature=form?.signature||'Fold/Twist/Shift/Stretch',key=type+':'+signature;
    if(layoutCache.has(key))return layoutCache.get(key);
    const result=boxes[type].map(box=>[...box]);
    for(const rule of signature.split('/'))for(const [i,b] of result.entries()){
      const upper=b[1]>.28;
      if(rule==='Fold'&&upper){b[0]*=.65;b[2]+=(i%2?1:-1)*b[1]*.12;}
      if(rule==='Twist'&&upper){[b[0],b[2]]=[-b[2],b[0]];[b[3],b[5]]=[b[5],b[3]];}
      if(rule==='Shift'&&upper)b[0]+=.24*b[1];
      if(rule==='Stretch'){b[0]*=1.2;b[3]*=1.2;b[2]*=.82;b[5]*=.82;}
    }
    // The plot's centre is its anchor: even a courtyard or bridge has a grounded base.
    result.unshift([0,.022,0,1,.044,1]);
    const extent=Math.max(...result.flatMap(b=>[Math.abs(b[0])+b[3]/2,Math.abs(b[2])+b[5]/2]));
    for(const b of result)for(const d of [0,2,3,5])b[d]/=extent*2;
    layoutCache.set(key,result);return result;
  }
  const typeAt=i=>Math.floor(seed(i+7919)*boxes.length);

  function createJourney(){
    let dwell=0,focus=0,route=0,automatic=true,transition=null;
    const state=()=>({focus,route,dwell,automatic,moving:!!transition,phase:focus<.001?'overview':transition?.target===0?'return':focus>.995?'city':'approach'});
    return {
      get state(){return state();},
      request(target,immediate=false){
        automatic=false;transition=immediate?null:{from:focus,target,time:0,duration:target?8:4};
        if(immediate)focus=target;
        return state();
      },
      advance(seconds,{playing=true,present=true,inspecting=false,reduced=false}={}){
        if(!playing||!present||inspecting||reduced)return state();
        const dt=Math.max(0,Math.min(seconds,.1));
        if(transition){
          transition.time+=dt;
          focus=transition.from+(transition.target-transition.from)*ease(transition.time/transition.duration);
          if(transition.time>=transition.duration){focus=transition.target;transition=null;}
        }else if(automatic){dwell+=dt;focus=ease((dwell-9)/18);}
        if(focus>.9)route+=dt*.34;
        return state();
      }
    };
  }

  function basis(field,i){
    const part=Math.floor(field.groups[i]),u=wrap(Math.floor(i/64),224)/224*TAU;
    const p=Array.from(field.positions.subarray(i*3,i*3+3));
    const center=part===0?[2.84*Math.cos(u),2.84*Math.sin(u),0]:[2.18*Math.cos(u),0,2.18*Math.sin(u)];
    // Buildings stand out from the centreline through their own anchor point.
    // A twisted ellipse's differential normal leans away from that radial axis.
    const n=unit(sub(p,center));
    const along=part===0?[-Math.sin(u),Math.cos(u),0]:[-Math.sin(u),0,Math.cos(u)];
    const tangent=unit(sub(along,mul(n,dot(along,n))));
    return {p,n,tangent,side:unit(cross(tangent,n))};
  }
  function blendBasis(from,to,i,mix){
    const part=Math.floor(from.groups[i]),u=wrap(Math.floor(i/64),224)/224*TAU;
    const p=[0,1,2].map(d=>from.positions[i*3+d]*(1-mix)+to.positions[i*3+d]*mix);
    const center=part===0?[2.84*Math.cos(u),2.84*Math.sin(u),0]:[2.18*Math.cos(u),0,2.18*Math.sin(u)];
    const n=unit(sub(p,center)),along=part===0?[-Math.sin(u),Math.cos(u),0]:[-Math.sin(u),0,Math.cos(u)];
    const tangent=unit(sub(along,mul(n,dot(along,n))));
    return {p,n,tangent,side:unit(cross(tangent,n))};
  }
  function dimensions(from,to,i){
    const u=Math.floor(i/64),v=i%32,part=Math.floor(from.groups[i]);
    const distance=(field,j)=>Math.hypot(...[0,1,2].map(d=>field.positions[j*3+d]-field.positions[i*3+d]));
    const spacing=neighbors=>Math.min(...neighbors.flatMap(j=>[distance(from,j),distance(to,j)]));
    return [spacing([index(u-2,v,part),index(u+2,v,part)])*.68,
      spacing([index(u,v-2,part),index(u,v+2,part)])*.68];
  }
  function patch(route,compact=false){
    const center=Math.floor((44+route)/2)*2,radius=compact?12:20,ids=[];
    for(let u=center-radius;u<=center+radius;u+=2)for(let v=0;v<32;v+=2)ids.push(index(u,v));
    return ids;
  }
  function perspective(eye,target,up,aspect){
    const z=unit(sub(eye,target)),x=unit(cross(up,z)),y=cross(z,x);
    const f=1/Math.tan(.43),near=.008,far=35,a=(far+near)/(near-far),b=2*far*near/(near-far);
    const distance=Math.hypot(...sub(eye,target));
    // Normalize homogeneous scale before blending with the overview projection.
    return new Float32Array([
      f/aspect*x[0],f*y[0],a*z[0],-z[0],
      f/aspect*x[1],f*y[1],a*z[1],-z[1],
      f/aspect*x[2],f*y[2],a*z[2],-z[2],
      -f/aspect*dot(x,eye),-f*dot(y,eye),-a*dot(z,eye)+b,dot(z,eye)
    ].map(v=>v/distance));
  }
  function camera({overview,from,to,mix,poses,separation=0,focus,route,aspect,yaw=0,pitch=0}){
    if(focus===0)return new Float32Array(overview);
    const u=44+route,base=Math.floor(u),fraction=u-base;
    const a=blendBasis(from,to,index(base),mix),b=blendBasis(from,to,index(base+1),mix);
    const lerp=(x,y)=>add(mul(x,1-fraction),mul(y,fraction));
    const p=rotate(poses[0],lerp(a.p,b.p)),n=unit(rotate(poses[0],lerp(a.n,b.n)));
    const tangent=unit(rotate(poses[0],lerp(a.tangent,b.tangent))),side=unit(cross(tangent,n));
    p[0]-=separation*.35;
    const turn=Math.max(-1,Math.min(1,yaw))*.65;
    const back=add(mul(tangent,-.34*Math.cos(turn)),mul(side,.18+.25*Math.sin(turn)));
    const eye=add(add(p,back),mul(n,.27+Math.max(-.08,Math.min(.16,pitch*.12))));
    const target=add(add(p,mul(tangent,.15)),mul(n,.05));
    const close=perspective(eye,target,n,aspect);
    return new Float32Array(overview.map((v,i)=>v*(1-focus)+close[i]*focus));
  }
  function project(matrix,p,width,height){
    const clip=[0,1,2,3].map(r=>matrix[r]*p[0]+matrix[r+4]*p[1]+matrix[r+8]*p[2]+matrix[r+12]);
    if(clip[3]<=.00001||Math.abs(clip[2])>clip[3])return null;
    return [(clip[0]/clip[3]+1)*width/2,(1-clip[1]/clip[3])*height/2,clip[2]/clip[3]];
  }
  const faceCorners=[
    [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],
    [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],
    [[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],
    [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],
    [[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]
  ];
  const faceNormals=[[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0]];
  function prototype(type,lines=false,form){
    const vertices=[];
    for(const box of modules(type,form)){
      if(lines){
        const corners=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,.5,.5],[-.5,.5,.5]];
        for(const j of [0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7])vertices.push(...corners[j].map((v,d)=>box[d]+v*box[d+3]),...unit(corners[j]),0);
      }else faceCorners.forEach((corners,f)=>{
        for(const j of [0,1,2,0,2,3])vertices.push(...corners[j].map((v,d)=>box[d]+v*box[d+3]),...faceNormals[f],[0,1,3,2][j]);
      });
    }
    return new Float32Array(vertices);
  }
  return {createJourney,seed,index,boxes,typologies,modules,typeAt,faceCorners,faceNormals,basis,blendBasis,dimensions,patch,camera,project,prototype,rotate,add,mul,dot};
})();
