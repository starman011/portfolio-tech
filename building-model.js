/* A small modular façade grammar. The frame stays fixed while prefabricated
 * screens fold and slide. Deterministic variations, not trained-AI output. */
'use strict';
window.buildPortfolioModel = function ({seed=24}={}) {
  seed=Number.isFinite(Number(seed))?Math.max(0,Math.round(Number(seed)))%100000:24;
  const faces=[],lines=[],points=[],zero=[0,0,0];
  const components={storeys:2,bays:6,modules:0};
  function face(vertices,material,part,movement=zero,motion=null,outward){
    const a=vertices[0],u=vertices[1].map((v,i)=>v-a[i]),v=vertices[2].map((v,i)=>v-a[i]);
    let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...n);if(length<1e-9)return;n=n.map(v=>v/length);
    if(outward&&n.reduce((s,v,i)=>s+v*outward[i],0)<0){vertices=[...vertices].reverse();n=n.map(v=>-v);}
    faces.push({vertices,normal:n,material,part,movement,motion});
  }
  function box(x,y,z,w,d,h,material='trim',part='frame',movement=zero,motion=null,orientation=0){
    const c=Math.cos(orientation),s=Math.sin(orientation);
    const at=(u,v,t)=>[x+u*c-v*s,y+u*s+v*c,z+t];
    const a=[at(-w/2,-d/2,-h/2),at(w/2,-d/2,-h/2),at(w/2,d/2,-h/2),at(-w/2,d/2,-h/2)];
    const b=a.map(p=>[p[0],p[1],p[2]+h]);
    const add=vertices=>{
      const outward=vertices.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/vertices.length),[0,0,0]).map((v,i)=>v-[x,y,z][i]);
      face(vertices,material,part,movement,motion,outward);
    };
    for(let i=0;i<4;i++){const j=(i+1)%4;add([a[i],a[j],b[j],b[i]]);}
    add(b);add([...a].reverse());
  }
  const random=i=>{
    let x=Math.imul(seed+17,i+91)^Math.imul(i+5,374761393);
    x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967296;
  };
  const storey=1.88;
  box(0,0,-.10,10.5,5.25,.12,'plinth','ground');
  box(0,0,.035,9.35,3.90,.17,'stone','ground-slab');
  box(0,0,storey+.035,9.42,3.98,.16,'trim','terrace-slab',[0,0,.28]);
  box(.75,0,storey*2+.06,8.02,4.04,.14,'trim','roof',[0,0,.56]);
  for(let level=0;level<2;level++){
    const start=level?1:0,z=.15+level*storey;
    for(let bay=start;bay<=6;bay++)for(const y of [-1.72,1.72]){
      box(-4.5+bay*1.5,y,z+.81,.105,.13,1.73,'trim','columns');
    }
    box(level?.75:0,-1.55,z+.79,level?7.40:8.9,.065,1.51,'core','interior');
    // Warm floors can be seen behind the changing screens.
    box(level?.75:0,0,z-.018,level?7.4:8.95,3.5,.045,'roof','interior-floor',[0,0,level*.28]);
  }
  let moduleIndex=0;
  function module(x,y,level,orientation,width,entry=false){
    const n=[Math.sin(orientation),Math.cos(orientation)],t=[Math.cos(orientation),-Math.sin(orientation)];
    const index=moduleIndex++,z=.15+level*storey,h=1.64;
    const movement=[n[0]*.72,n[1]*.72,level*.28];
    const type=entry?3:Math.floor(random(index)*3),direction=random(index+37)>.5?1:-1;
    const material=random(index+71)>.82?'core':'roof';
    const offset=(u,d,z)=>[x+t[0]*u+n[0]*d,y+t[1]*u+n[1]*d,z];
    box(...offset(0,-.065,z+h/2),width-.13,.028,h-.07,'glass','glazing-'+index,[0,0,level*.28],null,-orientation);
    for(const side of [-1,1])box(...offset(side*(width-.08)/2,.015,z+h/2),.055,.095,h,'trim','window-frame',[0,0,level*.28],null,-orientation);
    for(const height of [0,h])box(...offset(0,.015,z+height),width-.03,.095,.048,'trim','window-frame',[0,0,level*.28],null,-orientation);
    if(type===0){
      for(let i=0;i<7;i++){
        const p=offset((i-3)*(width-.19)/7,.14,z+h/2);
        const motion={pivot:p,axis:[0,0,1],rule:[direction,1,.75,index*.095]};
        box(...p,(width-.23)/7,.045,h-.09,material,'vertical-screen-'+index,movement,motion,-orientation);
      }
    }else if(type===1){
      for(let i=0;i<3;i++){
        const p=offset(0,.15,z+(i+.5)*h/3);
        const motion={pivot:[p[0],p[1],p[2]+h/6-.025],axis:[...t,0],rule:[direction,.8,.58,index*.095]};
        box(...p,width-.16,.045,h/3-.09,material,'horizontal-screen-'+index,movement,motion,-orientation);
      }
    }else if(type===2){
      for(const side of [-1,1]){
        const p=offset(side*(width-.17)/4,.16,z+h/2),pivot=offset(side*(width-.17)/2,.16,z+h/2);
        const motion={pivot,axis:[0,0,1],rule:[side,.74,.45,index*.095]};
        box(...p,(width-.19)/2,.045,h-.09,material,'folding-screen-'+index,movement,motion,-orientation);
      }
    }else{
      box(...offset(.08,.04,z+h/2),.025,.07,h-.12,'trim','entry-door',zero,null,-orientation);
      box(...offset(.17,.095,z+.76),.022,.025,.21,'roof','door-handle',zero,null,-orientation);
    }
    components.modules++;
  }
  for(let level=0;level<2;level++){
    for(let bay=level?1:0;bay<6;bay++){
      module(-3.75+bay*1.5,1.74,level,0,1.5,level===0&&bay===1);
      // The back is mostly glass: the front and ends carry the rule sequence.
      box(-3.75+bay*1.5,-1.76,.15+level*storey+.81,1.38,.04,1.59,'glass','back-glazing',[0,0,level*.28]);
    }
    for(const side of [-1,1])for(const y of [-.84,.84]){
      const x=side<0?(level?-3:-4.5):4.5;
      module(x,y,level,side*Math.PI/2,1.68);
    }
  }
  // The setback leaves a small roof terrace and establishes architectural scale.
  for(const x of [-4.5,-3.03])for(const y of [-1.73,0,1.73])box(x,y,storey+.44,.028,.028,.72,'core','terrace-rail');
  for(const x of [-4.5,-3.03])box(x,0,storey+.80,.035,3.48,.035,'core','terrace-rail');
  box(-3.76,1.74,storey+.80,1.5,.035,.035,'core','terrace-rail');
  box(-3.72,-.55,storey+.31,.96,.59,.35,'core','terrace-planter');
  box(-3.72,-.55,storey+.50,.86,.48,.08,'stone','terrace-planter');
  box(-3.72,.55,storey+.24,.84,.43,.12,'roof','terrace-bench');
  const unique=new Map();
  for(const item of faces)for(const p of item.vertices){
    const key=p.map(v=>v.toFixed(4)).join('/')+'/'+item.part;
    unique.set(key,{position:p,movement:item.movement,motion:item.motion});
  }
  points.push(...unique.values());
  const fitPoints=[];
  for(const x of [-5.0,5.0])for(const y of [-2.5,2.85])for(const z of [-.17,storey*2+.16]){
    fitPoints.push({position:[x,y,z],movement:[Math.sign(x)*1.05,Math.sign(y)*1.05,z>0?.56:0]});
  }
  return {faces,lines,points,fitPoints,components,seed,family:'modular',ground:-.16,top:storey*2+.13};
};
window.portfolioModuleTransform=function(motion,time){
  if(!motion)return null;
  const p=(((time-motion.rule[3])/4)%4+4)%4,i=Math.floor(p),f=p-i;
  const t=Math.max(0,Math.min(1,(f-.16)/.7)),ease=t*t*(3-2*t);
  const sign=motion.rule[0],scale=motion.rule[1],depth=motion.rule[2];
  const angles=[1.28*scale,.08,.68*sign*scale,-.35*sign*scale],shifts=[0,0,.15,depth];
  return {angle:angles[i]+(angles[(i+1)%4]-angles[i])*ease,shift:shifts[i]+(shifts[(i+1)%4]-shifts[i])*ease};
};
window.posePortfolioModel=function(model,time){
  const cache=new Map();
  function transform(item,p,normal=false){
    if(!item.motion)return p;
    const m=item.motion;
    if(!cache.has(m))cache.set(m,window.portfolioModuleTransform(m,time));
    const pose=cache.get(m),a=m.axis,c=Math.cos(pose.angle),s=Math.sin(pose.angle);
    const v=normal?p:p.map((x,i)=>x-m.pivot[i]),dot=v.reduce((sum,x,i)=>sum+x*a[i],0);
    const cross=[a[1]*v[2]-a[2]*v[1],a[2]*v[0]-a[0]*v[2],a[0]*v[1]-a[1]*v[0]];
    const result=v.map((x,i)=>x*c+cross[i]*s+a[i]*dot*(1-c));
    return normal?result:result.map((x,i)=>x+m.pivot[i]+(i<2?item.movement[i]*pose.shift:0));
  }
  return {...model,
    faces:model.faces.map(item=>({...item,vertices:item.vertices.map(p=>transform(item,p)),normal:transform(item,item.normal,true)})),
    points:model.points.map(item=>({...item,position:transform(item,item.position)}))};
};
