/* Two circular rings in perpendicular planes. Rule permutations only change
 * the swept cross-section; the paths and their right angle remain invariant. */
'use strict';
window.PermutationField=(()=>{
  const rules=['Fold','Twist','Shift','Stretch'];
  const operators={
    Fold:([x,y])=>[x,y+.72*x],
    Twist:([x,y])=>{const c=Math.cos(.65),s=Math.sin(.65);return [c*x-s*y,s*x+c*y];},
    Shift:([x,y])=>[x+.60*y,y],
    Stretch:([x,y])=>[x*1.45,y*.70]
  };
  const rings=[{radius:2.84,normal:[0,0,1]},{radius:2.18,normal:[0,1,0]}];
  const cache=new Map(),count=224*64;
  const wireIndices=(()=>{
    const edges=[];
    for(let part=0;part<2;part++){
      for(let v=0;v<32;v+=4)for(let u=0;u<224;u++)edges.push(u*64+part*32+v,((u+1)%224)*64+part*32+v);
      for(let u=0;u<224;u+=8)for(let v=0;v<32;v++)edges.push(u*64+part*32+v,u*64+part*32+(v+1)%32);
    }
    return new Uint16Array(edges);
  })();
  function enumerate(active=rules){
    if(!active.length||active.some(r=>!Object.hasOwn(operators,r))||new Set(active).size!==active.length)throw Error('Choose one or more distinct rules');
    const list=rules.filter(r=>active.includes(r));
    const permute=a=>a.length===1?[a]:a.flatMap((v,i)=>permute(a.filter((_,j)=>j!==i)).map(t=>[v,...t]));
    return permute(list).map(order=>({order,signature:order.join('/')}));
  }
  function profile(v,order){
    let p=[Math.cos(v),.72*Math.sin(v)];
    for(const rule of order)p=operators[rule](p);
    return p;
  }
  function particles(form){
    if(cache.has(form.signature))return cache.get(form.signature);
    let maxProfile=0;
    for(let j=0;j<256;j++)maxProfile=Math.max(maxProfile,Math.hypot(...profile(j/256*Math.PI*2,form.order)));
    const scale=.24/maxProfile;
    const point=(u,v,part)=>{
      const section=profile(v,form.order),twist=(part===0?1:-1)*u,c=Math.cos(twist),s=Math.sin(twist);
      const radial=(section[0]*c-section[1]*s)*scale,axial=(section[0]*s+section[1]*c)*scale;
      const radius=rings[part].radius+radial;
      return part===0?[radius*Math.cos(u),radius*Math.sin(u),axial]:[radius*Math.cos(u),axial,radius*Math.sin(u)];
    };
    const positions=new Float32Array(count*3),normals=new Float32Array(count*3),groups=new Float32Array(count);
    for(let uIndex=0;uIndex<224;uIndex++)for(let j=0;j<64;j++){
      const index=uIndex*64+j,part=Math.floor(j/32),u=uIndex/224*Math.PI*2,v=(j%32)/32*Math.PI*2;
      const p=point(u,v,part),a=point(u+.0001,v,part).map((x,d)=>x-p[d]),b=point(u,v+.0001,part).map((x,d)=>x-p[d]);
      const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n)||1;
      positions.set(p,index*3);normals.set(n.map(x=>x/length),index*3);groups[index]=part+uIndex/224;
    }
    const result={positions,normals,groups,count,signature:form.signature};cache.set(form.signature,result);return result;
  }
  const rotateX=a=>{const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,c,s,0,-s,c];};
  const rotateY=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,1,0,s,0,c];};
  const rotateZ=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,s,0,-s,c,0,0,0,1];};
  const multiply=(a,b)=>{
    const result=new Float32Array(9);
    for(let col=0;col<3;col++)for(let row=0;row<3;row++)for(let k=0;k<3;k++)result[col*3+row]+=a[k*3+row]*b[col*3+k];
    return result;
  };
  function motion(time){
    const assembly=multiply(rotateZ(time*.055),rotateX(.24*Math.sin(time*.12)));
    // Opposite in-plane spins cannot change a ring's plane normal.
    // The common rigid assembly rotation keeps those normals perpendicular.
    return [multiply(assembly,rotateZ(time*.18)),multiply(assembly,rotateY(-time*.16))];
  }
  return {rules,rings,enumerate,particles,wireIndices,motion};
})();
