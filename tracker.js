(() => {
  'use strict';
  const root = document.getElementById('tracking-study');
  const canvas = document.getElementById('tracking-canvas');
  if (!root || !canvas) return;
  const $ = selector => root.querySelector(selector);
  const select = $('#tracked-object');
  let ctx;
  try { ctx = canvas.getContext('2d'); } catch { /* Static fallback below. */ }
  if (!ctx || !window.portfolioLand) {
    $('#track-name').textContent = 'Open the globe to explore.';
    root.querySelectorAll('button,select').forEach(control => { control.disabled = true; });
    return;
  }
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const routes = [
    ['New York → Los Angeles', [-74,40.7], [-118.4,34]],
    ['Seattle → Chicago', [-122.3,47.6], [-87.6,41.9]],
    ['Toronto → Miami', [-79.4,43.7], [-80.2,25.8]],
    ['Dallas → San Francisco', [-96.8,32.8], [-122.4,37.8]],
    ['Mexico City → Houston', [-99.1,19.4], [-95.4,29.8]],
    ['Vancouver → Denver', [-123.1,49.3], [-104.9,39.7]],
    ['Boston → Atlanta', [-71.1,42.4], [-84.4,33.7]],
    ['Los Angeles → New York', [-118.4,34], [-74,40.7]],
    ['Chicago → Seattle', [-87.6,41.9], [-122.3,47.6]],
    ['Miami → Toronto', [-80.2,25.8], [-79.4,43.7]],
    ['Houston → Mexico City', [-95.4,29.8], [-99.1,19.4]],
    ['Denver → Vancouver', [-104.9,39.7], [-123.1,49.3]]
  ]
    .map((route,index) => ({ id:'OT-A' + String(index+1).padStart(2,'0'), kind:'air', route:route[0], a:route[1], b:route[2], speed:440+(index*17)%95, level:31000+(index%5)*1500, offset:(index*.173+.16)%1, bend:2.8, duration:145+index*5 }));
  const ships = [
    ['Pacific coastal passage', [-129,44], [-125,31]],
    ['Pacific northbound passage', [-128,30], [-131,46]],
    ['Gulf cargo passage', [-94,25], [-86,25]],
    ['Western Atlantic passage', [-65,39], [-72,27]],
    ['Atlantic northbound passage', [-69,28], [-61,42]],
    ['Caribbean passage', [-78,16], [-68,15]]
  ]
    .map((route,index) => ({ id:'OT-S' + String(index+1).padStart(2,'0'), kind:'sea', route:route[0], a:route[1], b:route[2], speed:14+index*2, level:120+index*35, offset:(index*.23+.21)%1, bend:.35, duration:240+index*16 }));
  const objects = [...routes,...ships];
  let selected = objects[0], width=0, height=0, zoom=1, elapsed=0;
  let frame=null, previous=0, detailTime=0, paused=false, visible=true, reduced=media.matches;
  const layers = { air:true, sea:true };
  const projected = new Map();
  const colors = { sea:'#121d22', land:'#293c36', coast:'#658073', grid:'rgba(184,205,190,.09)', air:'#c6f04c', ship:'#79cdda' };
  // Equirectangular illustration, with constant longitude scaling at 40° N.
  function project([lon,lat]) {
    const scale = Math.min(width/72, height/48) * zoom;
    return [width/2 + (lon+98)*.77*scale, height/2 - (lat-39)*scale];
  }
  function position(object, time=elapsed) {
    const t = (object.offset + time/object.duration)%1;
    return [object.a[0]+(object.b[0]-object.a[0])*t, object.a[1]+(object.b[1]-object.a[1])*t + Math.sin(t*Math.PI)*object.bend];
  }
  function path(points) {
    ctx.beginPath();
    points.forEach((p,i) => { const xy=project(p); if(i)ctx.lineTo(...xy);else ctx.moveTo(...xy); });
  }
  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0,0,width,height); ctx.fillStyle=colors.sea; ctx.fillRect(0,0,width,height);
    ctx.lineWidth=.6; ctx.strokeStyle=colors.grid;
    for(let lon=-170;lon<=-40;lon+=10) {path([[lon,0],[lon,85]]);ctx.stroke();}
    for(let lat=0;lat<=80;lat+=10) {path([[-180,lat],[-40,lat]]);ctx.stroke();}
    ctx.fillStyle=colors.land; ctx.strokeStyle=colors.coast;ctx.lineWidth=.65;
    window.portfolioLand.forEach(ring => {path(ring);ctx.closePath();ctx.fill();ctx.stroke();});
    ctx.font='8px Arial';ctx.fillStyle='#a8b9ac';ctx.textAlign='left';
    [['VANCOUVER',-123.1,49.3],['LOS ANGELES',-118.4,34],['NEW YORK',-74,40.7],['MEXICO CITY',-99.1,19.4],['MIAMI',-80.2,25.8]].forEach(([label,lon,lat])=> {
      const p=project([lon,lat]);ctx.fillText(label,p[0]+5,p[1]+14);
    });
    ctx.fillStyle='#839a92';ctx.font='italic 11px Georgia';
    ctx.fillText('Pacific Ocean',...project([-135,27]));ctx.fillText('Atlantic Ocean',...project([-67,31]));
    if (selected && layers[selected.kind]) {
      ctx.setLineDash([3,6]);ctx.strokeStyle=selected.kind==='air'?colors.air:colors.ship;ctx.globalAlpha=.38;
      path(Array.from({length:41},(_,index)=>{const t=index/40;return [selected.a[0]+(selected.b[0]-selected.a[0])*t,selected.a[1]+(selected.b[1]-selected.a[1])*t+Math.sin(t*Math.PI)*selected.bend];}));ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    }
    projected.clear();
    objects.filter(object=>layers[object.kind]).forEach(object=> {
      const location=position(object),p=project(location),next=project(position(object,elapsed+.1));
      projected.set(object.id,p);
      const color=object.kind==='air'?colors.air:colors.ship;
      // Short sample history, without wrapping a completed route back to its start.
      const phase=(object.offset+elapsed/object.duration)%1;
      const tail=Math.min(phase*object.duration,object.kind==='air'?6:10);
      ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=.28;
      path(Array.from({length:9},(_,i)=>position(object,elapsed-tail+tail*i/8)));ctx.stroke();ctx.globalAlpha=1;
      if(object===selected) {ctx.beginPath();ctx.arc(...p,13,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();}
      ctx.save();ctx.translate(...p);ctx.rotate(Math.atan2(next[1]-p[1],next[0]-p[0])+Math.PI/2);
      ctx.fillStyle=color;ctx.beginPath();
      if(object.kind==='air') {
        ctx.moveTo(0,-7);ctx.lineTo(1.6,-1);ctx.lineTo(7,2);ctx.lineTo(7,3.5);ctx.lineTo(1.4,2);ctx.lineTo(1,5);ctx.lineTo(3,6.5);ctx.lineTo(3,7.5);ctx.lineTo(0,6.5);ctx.lineTo(-3,7.5);ctx.lineTo(-3,6.5);ctx.lineTo(-1,5);ctx.lineTo(-1.4,2);ctx.lineTo(-7,3.5);ctx.lineTo(-7,2);ctx.lineTo(-1.6,-1);
      } else {ctx.moveTo(0,-6);ctx.lineTo(3.5,-2);ctx.lineTo(3.5,5);ctx.lineTo(-3.5,5);ctx.lineTo(-3.5,-2);}
      ctx.closePath();ctx.fill();ctx.restore();
    });
  }
  function describe(announce=false) {
    if (!selected) {
      $('#track-name').textContent='No visible objects'; $('#track-route').textContent='Enable an aircraft or ship layer to explore.';
      $('#track-type').textContent='Both layers hidden';
      ['speed','level','latitude','longitude'].forEach(key=>$('#track-'+key).textContent='—');
      return;
    }
    const p=position(selected);
    $('#track-name').textContent=selected.id;
    $('#track-type').textContent=selected.kind==='air'?'Sample aircraft / simulated':'Sample vessel / simulated';
    $('#track-route').textContent=selected.route;
    $('#track-speed').textContent=selected.speed+' kn';
    $('#track-level-label').textContent=selected.kind==='air'?'Altitude':'Length';
    $('#track-level').textContent=selected.level.toLocaleString()+(selected.kind==='air'?' ft':' m');
    $('#track-latitude').textContent=p[1].toFixed(2)+'° N';
    $('#track-longitude').textContent=Math.abs(p[0]).toFixed(2)+'° W';
    if(announce) $('#track-announcement').textContent=selected.id+', '+selected.route+'. Illustrative data.';
  }
  function refreshOptions() {
    const shown=objects.filter(object=>layers[object.kind]);
    if(!shown.includes(selected))selected=shown[0]||null;
    select.replaceChildren(...shown.map(object=>{const option=document.createElement('option');option.value=object.id;option.textContent=object.id+' · '+object.route;return option;}));
    select.disabled=!shown.length;
    if(selected)select.value=selected.id;
    $('#track-count').textContent=shown.length+' sample objects';
    describe();draw();
  }
  select.addEventListener('change',()=>{selected=objects.find(object=>object.id===select.value);describe(true);draw();});
  canvas.addEventListener('click',event=>{
    const bounds=canvas.getBoundingClientRect(), x=event.clientX-bounds.left,y=event.clientY-bounds.top;
    const hit=[...projected].map(([id,p])=>({id,distance:Math.hypot(x-p[0],y-p[1])})).sort((a,b)=>a.distance-b.distance)[0];
    if(hit&&hit.distance<24){selected=objects.find(object=>object.id===hit.id);select.value=selected.id;describe(true);draw();}
  });
  root.querySelectorAll('[data-traffic-type]').forEach(button=>button.addEventListener('click',()=>{
    const kind=button.dataset.trafficType;layers[kind]=!layers[kind];button.setAttribute('aria-pressed',String(layers[kind]));refreshOptions();schedule();
  }));
  function setZoom(value){zoom=Math.min(2,Math.max(.72,value));$('#map-zoom-in').disabled=zoom>=2;$('#map-zoom-out').disabled=zoom<=.72;draw();}
  $('#map-zoom-in').addEventListener('click',()=>setZoom(zoom+.2));
  $('#map-zoom-out').addEventListener('click',()=>setZoom(zoom-.2));
  $('#map-reset').addEventListener('click',()=>setZoom(1));
  const canAnimate=()=>!paused&&!reduced&&visible&&!document.hidden&&(layers.air||layers.sea);
  function tick(time){
    frame=null;if(!canAnimate()){previous=0;return;}
    if(!previous||time-previous>=40){const dt=previous?Math.min(time-previous,100):0;previous=time;elapsed+=dt/1000;draw();if(time-detailTime>400){describe();detailTime=time;}}
    frame=requestAnimationFrame(tick);
  }
  function schedule(){
    if(!canAnimate()){if(frame!==null)cancelAnimationFrame(frame);frame=null;previous=0;}
    else if(frame===null)frame=requestAnimationFrame(tick);
  }
  const pause=$('#tracking-pause');
  function updatePause(){pause.disabled=reduced;pause.textContent=reduced?'Motion reduced':paused?'Resume ↻':'Pause Ⅱ';pause.setAttribute('aria-pressed',String(paused||reduced));pause.setAttribute('aria-label',reduced?'Automatic movement disabled by reduced motion':paused?'Resume sample traffic':'Pause sample traffic');}
  pause.addEventListener('click',()=>{paused=!paused;updatePause();schedule();});
  media.addEventListener('change',event=>{reduced=event.matches;updatePause();schedule();});
  document.addEventListener('visibilitychange',schedule);
  function resize(){const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();}
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.05}).observe(canvas);
  window.addEventListener('pagehide',()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;previous=0;});
  window.addEventListener('pageshow',schedule);
  refreshOptions();resize();updatePause();schedule();
})();
