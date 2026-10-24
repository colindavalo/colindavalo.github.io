'use strict';
const $ = id => document.getElementById(id);
const ui = {model:"dumas-wolf", roots:[], result:null, metricImage:null, colorRange:[0,1], generation:0, job:null,
  timer:null, drag:null, selectedRoot:0, playing:false, animation:null, dirty:false};
const palette = [[20,47,59],[40,110,115],[117,169,163],[220,225,178],[232,184,97],[185,103,57]];
const fmt = (v,d=3) => Number(v).toFixed(d);
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));

const isBarbot=()=>ui.model==="barbot";
function message(text,error=false) { $('status').textContent=text; $('status').classList.toggle('error',error); }
function rootRows() {
  $('roots').replaceChildren();
  ui.roots.forEach((root,j) => {
    const row=document.createElement('div'); row.className='root-row';
    const label=document.createElement('span'); label.textContent=`r${j+1}`; row.append(label);
    root.forEach((value,k) => {
      const input=document.createElement('input'); input.type='number'; input.step='0.05'; input.value=Number(value.toFixed(4));
      input.setAttribute('aria-label',`Root ${j+1} ${k?'imaginary':'real'} part`);
      input.addEventListener('focus',()=>{ui.selectedRoot=j;});
      input.addEventListener('change',()=>{
        if(input.value==='' || !Number.isFinite(Number(input.value))) {message('Enter finite root coordinates.',true);return;}
        ui.roots[j][k]=Number(input.value); rootsChanged();
      }); row.append(input);
    }); $('roots').append(row);
  });
  $('degree').value=ui.roots.length;
  $('formula').textContent=ui.roots.length===0?'q(z) = 1':ui.roots.length===1?'q(z) = z − r₁':'q(z) = ∏ (z − rⱼ)';
  if(isBarbot())$('formula').textContent=$('formula').textContent.replace('q(z)','t(z)');
}
function markDirty(invalidate=false) {
  if(invalidate) {
    ++ui.generation;
    if(ui.job) fetch(`api/jobs/${ui.job}`,{method:'DELETE'}).catch(()=>{});
    ui.job=null; $('cancel').hidden=true;
  }
  ui.dirty=true; document.querySelector('.workspace').classList.add('pending');
  $('export-json').disabled=$('export-png').disabled=true;
}
function rootsChanged() {
  $('preset').value='custom';
  markDirty(true); drawAll();
  message('Roots changed. The previous solution is faded until the next solve.');
  clearTimeout(ui.timer);
  if($('auto').checked) ui.timer=setTimeout(startSolve,350);
}
function settings() {
  return {radius:Number($('domain').value),cutoff:Number($('cutoff').value),
          grid_size:Number($('grid').value),ray_count:Number($('ray-count').value)};
}
async function api(path,options) {
  const response=await fetch(path,options), data=await response.json();
  if(!response.ok) throw Error(data.error || 'Request failed'); return data;
}
async function startSolve() {
  clearTimeout(ui.timer);
  if(Number($('degree').value)!==ui.roots.length || $('degree').value==='')
    return message('Choose a valid degree from 0 to 8.',true);
  const inputs=[...$('roots').querySelectorAll('input')];
  if(inputs.some(i=>i.value===''||!Number.isFinite(Number(i.value)))) return message('Enter finite root coordinates.',true);
  const config=settings();
  if(Object.values(config).some(v=>!Number.isFinite(v))) return message('Enter valid numerical settings.',true);
  const generation=++ui.generation;
  if(ui.job) fetch(`api/jobs/${ui.job}`,{method:'DELETE'}).catch(()=>{});
  ui.job=null; markDirty(); $('cancel').hidden=false;
  message('Solving the metric…'); $('warnings').replaceChildren();
  try {
    const job=await api('api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:ui.model,roots:ui.roots,settings:config})});
    if(generation!==ui.generation) {fetch(`api/jobs/${job.id}`,{method:'DELETE'}).catch(()=>{}); return;}
    ui.job=job.id;
    while(generation===ui.generation) {
      const state=await api(`api/jobs/${job.id}`);
      if(generation!==ui.generation) return;
      message(state.message);
      if(state.status==='complete') {
        const completed=await api(`api/jobs/${job.id}/result`);
        if(generation!==ui.generation) return;
        acceptResult(completed.result); return;
      }
      if(state.status==='failed'||state.status==='cancelled') throw Error(state.message);
      await wait(200);
    }
  } catch(error) { if(generation===ui.generation) message(error.message,true); }
  finally { if(generation===ui.generation) {ui.job=null; $('cancel').hidden=true;} }
}
function acceptResult(result) {
  ui.result=result; ui.dirty=false; document.querySelector('.workspace').classList.remove('pending');
  const t=result.transport, md=result.metric.diagnostics, td=t.diagnostics;
  $('radius-slider').max=t.radii.length-1; $('radius-slider').value=t.radii.length-1;
  $('angle').max=t.angles.length-1; $('angle').value=Math.min(Number($('angle').value),t.angles.length-1);
  $('vertex-count').textContent=isBarbot()?'Limit map · geodesics':`${result.polynomial.expected_vertices} vertices expected`;
  $('residual').textContent=md.relative_residual.toExponential(1);
  if(isBarbot()){
    const f=t.families.geodesic,last=f.homogeneous.length-1,previous=Math.floor(.8*last);
    const angles=f.homogeneous[last].map((p,j)=>{
      if(!f.valid[last][j]||!f.valid[previous][j])return 0;
      const dot=p.reduce((sum,v,i)=>sum+v*f.homogeneous[previous][j][i],0);
      return Math.acos(Math.min(1,Math.abs(dot)));
    });
    $('drift').textContent=fmt(Math.max(...angles)*180/Math.PI,3)+'°';
  } else $('drift').textContent=(100*td.vertex_relative_change).toFixed(3)+'%';
  $('drift-label').textContent=`${isBarbot()?"L":"r"} = ${fmt(td.comparison_radius,2)} → ${fmt(td.cutoff,2)}`;
  $('elapsed').textContent=fmt(result.elapsed_seconds,2)+' s';
  $('mesh-info').textContent=`${md.grid_size}² grid · spacing ${fmt(md.grid_spacing,3)}`;
  $('warnings').replaceChildren();
  const warnings=[...td.warnings];
  if(md.curvature_max>.002) warnings.push('Small positive numerical curvature: refine the metric grid.');
  for(const text of warnings) {const p=document.createElement('p');p.textContent=text;$('warnings').append(p);}
  message(`Complete · degree ${result.polynomial.degree}, ${t.angles.length} rays. Drag a root to explore.`);
  $('export-json').disabled=$('export-png').disabled=false;
  createHeatmap(); drawAll();
}
function createHeatmap() {
  if(!ui.result)return;
  const layer=$('layer').value, matrix=ui.result.metric[layer], n=matrix.length;
  const values=matrix.flat();
  const lo=values.reduce((a,b)=>Math.min(a,b),Infinity), hi=values.reduce((a,b)=>Math.max(a,b),-Infinity);
  ui.colorRange=[lo,hi];
  const image=document.createElement('canvas');image.width=image.height=n;
  const context=image.getContext('2d'), rgba=context.createImageData(n,n);
  const span=hi-lo;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
    const ratio=span<1e-10?.5:Math.max(0,Math.min(1,(matrix[n-1-y][x]-lo)/span));
    const p=ratio*(palette.length-1), k=Math.min(palette.length-2,Math.floor(p)), f=p-k;
    const offset=(y*n+x)*4;
    for(let c=0;c<3;c++)rgba.data[offset+c]=palette[k][c]*(1-f)+palette[k+1][c]*f;
    rgba.data[offset+3]=255;
  }
  context.putImageData(rgba,0,0);ui.metricImage=image;
  $('color-min').textContent=fmt(lo);$('color-max').textContent=fmt(hi);$('color-name').textContent=layer==='w'?(isBarbot()?'w = −2 log h':'w = log metric'):'Gaussian curvature K';
}
function canvasSetup(id) {
  const canvas=$(id), width=canvas.clientWidth, height=canvas.clientHeight;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  }
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  return {canvas,ctx,width,height};
}
function plotTransform(width,height,range) {
  const padding=39, size=Math.min(width-2*padding,height-2*padding), scale=size/(2*range);
  return {size,scale,cx:width/2,cy:height/2,
    pixel:(x,y)=>[width/2+x*scale,height/2-y*scale],
    world:(x,y)=>[(x-width/2)/scale,(height/2-y)/scale]};
}
function line(ctx,points,color,width=1,closed=false,dash=[]) {
  if(!points.length)return;
  ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);
  points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(closed)ctx.closePath();ctx.stroke();ctx.setLineDash([]);
}
function circle(ctx,x,y,r,fill,stroke) {
  ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.6;ctx.stroke();}
}
function axes(ctx,tr,range,dark=false) {
  const step=range>8?4:range>3?2:range>1.6?1:.5;
  ctx.font='10px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#71827c';
  for(let v=-Math.floor(range/step)*step;v<=range;v+=step) {
    line(ctx,[tr.pixel(v,-range),tr.pixel(v,range)],dark?'rgba(255,255,255,.11)':'#edf0e9');
    line(ctx,[tr.pixel(-range,v),tr.pixel(range,v)],dark?'rgba(255,255,255,.11)':'#edf0e9');
    if(Math.abs(v)>1e-7) {
      const p=tr.pixel(v,-range);ctx.fillText(String(Number(v.toFixed(1))),p[0],p[1]+17);
      const q=tr.pixel(-range,v);ctx.fillText(String(Number(v.toFixed(1))),q[0]-17,q[1]+3);
    }
  }
  line(ctx,[tr.pixel(-range,0),tr.pixel(range,0)],dark?'rgba(255,255,255,.38)':'#ccd6cc');
  line(ctx,[tr.pixel(0,-range),tr.pixel(0,range)],dark?'rgba(255,255,255,.38)':'#ccd6cc');
}
function metricTransform() {
  const c=$('metric'); const range=ui.result?ui.result.settings.radius:Number($('domain').value)||6;
  return plotTransform(c.clientWidth,c.clientHeight,range);
}
function drawMetric() {
  const {ctx,width,height}=canvasSetup('metric');
  const range=ui.result?ui.result.settings.radius:Number($('domain').value)||6;
  const tr=plotTransform(width,height,range);
  if(ui.metricImage) {ctx.imageSmoothingEnabled=true;ctx.drawImage(ui.metricImage,tr.cx-tr.size/2,tr.cy-tr.size/2,tr.size,tr.size);}
  else {ctx.fillStyle='#edf2e9';ctx.fillRect(tr.cx-tr.size/2,tr.cy-tr.size/2,tr.size,tr.size);}
  axes(ctx,tr,range,Boolean(ui.metricImage));
  if(ui.result && isBarbot()) drawBarbotDomain(ctx,tr);
  else if(ui.result) {
    const t=ui.result.transport, index=Number($('radius-slider').value), r=t.radii[index], selected=Number($('angle').value);
    const stride=Math.max(1,Math.floor(t.angles.length/60));
    for(let j=0;j<t.angles.length;j+=stride) {
      const a=t.angles[j];line(ctx,[tr.pixel(0,0),tr.pixel(r*Math.cos(a),r*Math.sin(a))],'rgba(255,255,255,.18)',.65);
    }
    const a=t.angles[selected];line(ctx,[tr.pixel(0,0),tr.pixel(r*Math.cos(a),r*Math.sin(a))],'#e2c9ff',2.2);
    const point=tr.pixel(r*Math.cos(a),r*Math.sin(a));circle(ctx,...point,3.5,'#ede2ff','#756396');
    ctx.beginPath();ctx.arc(tr.cx,tr.cy,r*tr.scale,0,2*Math.PI);ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=1;ctx.stroke();
  }
  circle(ctx,tr.cx,tr.cy,2,'#fff');
  ui.roots.forEach((root,j)=>{
    const p=tr.pixel(...root);circle(ctx,...p,9,'#fff','#b96c38');
    ctx.fillStyle='#9a572d';ctx.font='bold 10px Segoe UI';ctx.textAlign='center';ctx.fillText(j+1,p[0],p[1]+3.4);
  });
  ctx.fillStyle='#71827c';ctx.font='11px Georgia';ctx.fillText('Re z',width-21,tr.cy-8);ctx.fillText('Im z',tr.cx+18,19);
}
function drawPolygon() {
  const {ctx,width,height}=canvasSetup('polygon');
  if(!ui.result) {ctx.fillStyle='#8a998f';ctx.font='13px Segoe UI';ctx.textAlign='center';ctx.fillText('Solving the reference geometry…',width/2,height/2);return;}
  if(isBarbot()){drawBarbot(ctx,width,height);return;}
  const t=ui.result.transport,index=Number($('radius-slider').value),selected=Number($('angle').value);
  const extent=Math.max(.5,...t.vertices.flat().map(Math.abs),...t.points[t.points.length-1].flat().map(Math.abs));
  const range=extent*1.18,tr=plotTransform(width,height,range);
  axes(ctx,tr,range);
  const polygon=t.vertices.map(p=>tr.pixel(...p));
  ctx.beginPath();polygon.forEach((p,j)=>j?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle='rgba(195,117,55,.055)';ctx.fill();
  line(ctx,polygon,'#c37537',1.5,true,[5,4]);
  const pts=t.points[index].map(p=>tr.pixel(...p));
  line(ctx,pts,'#176b63',1.8,true);
  for(const p of pts)circle(ctx,...p,1.55,'#176b63');
  polygon.forEach((p,j)=>{circle(ctx,...p,3.8,'#fff','#c37537');const dx=p[0]-tr.cx,dy=p[1]-tr.cy,len=Math.hypot(dx,dy)||1;ctx.fillStyle='#a36d3b';ctx.font='11px Segoe UI';ctx.textAlign='center';ctx.fillText(j+1,p[0]+13*dx/len,p[1]+13*dy/len+3);});
  const path=t.points.slice(0,index+1).map(ring=>tr.pixel(...ring[selected]));
  line(ctx,path,'#756396',2);circle(ctx,...pts[selected],4,'#756396','#fff');
  circle(ctx,tr.cx,tr.cy,2.3,'#41564c');
  $('radius-value').textContent=fmt(t.radii[index]);$('angle-value').textContent=fmt(t.angles[selected]*180/Math.PI,1)+'°';
}
function drawAll(){drawMetric();drawPolygon();}


function families(){const chosen=$('path-family').value;return chosen==='compare'?['straight','geodesic']:[chosen];}
function drawBarbotDomain(ctx,tr){
  const t=ui.result.transport,k=Number($('radius-slider').value),selected=Number($('angle').value);
  for(const name of families()){
    const f=t.families[name],color=name==='straight'?'#176b63':'#c37537';
    for(let j=0;j<t.angles.length;j+=Math.max(1,Math.floor(t.angles.length/40))){
      const path=f.paths.slice(0,k+1).map(ring=>tr.pixel(...ring[j]));
      line(ctx,path,name==='straight'?'rgba(255,255,255,.27)':'rgba(240,185,110,.5)',.7);
    }
    const path=f.paths.slice(0,k+1).map(ring=>tr.pixel(...ring[selected]));
    line(ctx,path,color,2);circle(ctx,...path[path.length-1],3.5,color,'white');
  }
}
function chartPoint(p){
  const axis=Number($('chart').value),range=Math.max(.25,Number($('chart-range').value)||3);
  if(Math.abs(p[axis])<1e-8)return null;
  const result=p.filter((_,i)=>i!==axis).map(v=>v/p[axis]);
  return result.every(v=>Number.isFinite(v)&&Math.abs(v)<=range)?result:null;
}
function drawBarbot(ctx,width,height){
  const t=ui.result.transport,k=Number($('radius-slider').value),selected=Number($('angle').value);
  const range=Math.max(.25,Math.min(100,Number($('chart-range').value)||3)),tr=plotTransform(width,height,range);
  axes(ctx,tr,range);
  const f=t.families.geodesic,points=f.homogeneous[k],valid=f.valid[k],axis=Number($('chart').value);
  let shown=0,crossings=0;
  // Only the geodesic family belongs in the right-hand limit-map display.
  if($('segments').checked){
    for(let j=0;j<points.length;j++){
      const arc=ProjectiveSegments.chooseArc(points,valid,j);if(!arc)continue;
      if(arc.p[axis]*arc.q[axis]<0)crossings++;
      for(const piece of ProjectiveSegments.clipSegment(arc.p,arc.q,axis,range))
        line(ctx,piece.map(p=>tr.pixel(...p)),'#c37537',1.35);
    }
  }
  points.forEach((p,j)=>{
    const point=valid[j]?chartPoint(p):null;
    if(point){shown++;circle(ctx,...tr.pixel(...point),2.3,'#c37537');}
  });
  for(let s=0;s<=k;s++){
    const point=f.valid[s][selected]?chartPoint(f.homogeneous[s][selected]):null;
    if(point)circle(ctx,...tr.pixel(...point),s===k?4:1.3,s===k?'#756396':'rgba(117,99,150,.25)',s===k?'white':null);
  }
  const other=[0,1,2].filter(i=>i!==axis);
  $('chart-caption').textContent=`Chart: (X${other[0]}/X${axis}, X${other[1]}/X${axis}) · geodesic limit map`;
  $('chart-status').textContent=`${shown}/${points.length} samples in view · ${crossings} ${crossings===1?'segment crosses':'segments cross'} infinity`;
  $('radius-value').textContent=fmt(t.radii[k]);$('angle-value').textContent=fmt(t.angles[selected]*180/Math.PI,1)+'°';
}
function switchModel(model){
  if(ui.model===model)return;
  clearTimeout(ui.timer);markDirty(true);ui.model=model;ui.result=null;ui.metricImage=null;
  $('barbot-controls').hidden=$('barbot-notes').hidden=!isBarbot();$('hitchin-notes').hidden=isBarbot();
  $('mode-hitchin').classList.toggle('active',!isBarbot());$('mode-barbot').classList.toggle('active',isBarbot());
  document.title=(isBarbot()?'Barbot':'Dumas–Wolf')+' · Polynomial laboratory';
  document.querySelector('.controls .hint').textContent='Drag roots in the metric plot. Repeated roots are allowed; degree zero is '+(isBarbot()?'t':'q')+' = 1. All polynomials are monic.';
  document.querySelector('h1').innerHTML=isBarbot()?'A projective curve<br>from transported cones.':'From a polynomial<br>to a projective polygon.';
  document.querySelector('.header-note span:last-child').textContent=isBarbot()?'Hitchin equation + flat cone transport':'Wang equation + affine-sphere transport';
  $('cutoff-label').textContent=isBarbot()?'Path length cutoff':'Ray cutoff';
  $('polygon').setAttribute('aria-label',isBarbot()?'Geodesic limit map with projective segments clipped at infinity':'Projective affine-sphere samples and estimated limiting polygon');
  $('radius-slider').setAttribute('aria-label',isBarbot()?'Euclidean path length':'Viewing radius');
  for(const id of ['residual','drift','elapsed'])$(id).textContent='—';
  $('image-title').textContent=isBarbot()?'Limit map in ℝℙ²':'Polygon in ℝℙ²';
  $('vertex-count').textContent=isBarbot()?'Limit map · geodesics':`${ui.roots.length+3} vertices expected`;
  $('parameter-label').textContent=isBarbot()?'Path length L':'Viewing radius';
  $('drift-title').textContent=isBarbot()?'GEODESIC DRIFT':'VERTEX DRIFT';
  document.querySelector('.subtitle').textContent=isBarbot()?'Polynomial Barbot bundles · metric and limit-map samples':'The Dumas–Wolf correspondence · cubic differentials on ℂ';
  $('legend').innerHTML=isBarbot()?'<span><i class="orange"></i>Limit map · geodesics</span><span><i class="violet"></i>Selected geodesic</span>':'<span><i class="teal"></i>Finite-radius curve</span><span><i class="orange"></i>Vertex estimates</span><span><i class="violet"></i>Selected ray</span>';
  $('chart-caption').textContent=isBarbot()?'Geodesic limit map; switch charts above':'Chart: (f₁/f₀, f₂/f₀) · frame fixed at the origin';
  for(const option of $('preset').options){
    if(!option.dataset.hitchin)option.dataset.hitchin=option.textContent;
    option.textContent=isBarbot()?({constant:'t = 1',linear:'t = z',quadratic:'t = z²',split:'t = z² − 1',asymmetric:'Three asymmetric roots',custom:'Custom polynomial'}[option.value]):option.dataset.hitchin;
  }
  rootRows();drawAll();startSolve();
}
$('mode-hitchin').addEventListener('click',()=>switchModel('dumas-wolf'));
$('mode-barbot').addEventListener('click',()=>switchModel('barbot'));
for(const id of ['path-family','chart','chart-range','segments'])$(id).addEventListener('change',drawAll);

$('degree').addEventListener('change',()=>{
  const n=Number($('degree').value);
  if(!Number.isInteger(n)||n<0||n>8)return message('Choose a degree from 0 to 8.',true);
  ui.roots=Array.from({length:n},(_,i)=>ui.roots[i]||[0,0]);rootRows();rootsChanged();
});
$('preset').addEventListener('change',()=>{
  const presets={constant:[],linear:[[0,0]],quadratic:[[0,0],[0,0]],split:[[-1,0],[1,0]],asymmetric:[[-.8,-.25],[.9,-.4],[.15,.95]]};
  ui.roots=presets[$('preset').value].map(r=>[...r]);rootRows();markDirty();drawAll();startSolve();
});
$('solve').addEventListener('click',startSolve);
$('cancel').addEventListener('click',()=>{
  ++ui.generation;if(ui.job)fetch(`api/jobs/${ui.job}`,{method:'DELETE'}).catch(()=>{});
  ui.job=null;$('cancel').hidden=true;message('Cancelled. Change settings or solve again.');
});
for(const id of ['domain','cutoff','grid','ray-count'])$(id).addEventListener('change',()=>{clearTimeout(ui.timer);markDirty(true);message('Settings changed. Press Solve & draw to recompute.');drawAll();});
$('auto').addEventListener('change',()=>{if(!$('auto').checked)clearTimeout(ui.timer);});
$('layer').addEventListener('change',()=>{createHeatmap();drawMetric();});
$('radius-slider').addEventListener('input',drawAll);$('angle').addEventListener('input',drawAll);
$('play').addEventListener('click',()=>{
  if(!ui.result)return;
  ui.playing=!ui.playing;$('play').textContent=ui.playing?'Ⅱ Pause':'▶ Play';
  if(!ui.playing){clearInterval(ui.animation);return;}
  if(Number($('radius-slider').value)===Number($('radius-slider').max))$('radius-slider').value=0;
  ui.animation=setInterval(()=>{
    const next=Number($('radius-slider').value)+1;
    if(next>Number($('radius-slider').max)){clearInterval(ui.animation);ui.playing=false;$('play').textContent='▶ Play';return;}
    $('radius-slider').value=next;drawAll();
  },65);
});
$('metric').addEventListener('pointerdown',event=>{
  const rect=$('metric').getBoundingClientRect(),p=[event.clientX-rect.left,event.clientY-rect.top],tr=metricTransform();
  const hits=ui.roots.map((r,j)=>({j,d:Math.hypot(...tr.pixel(...r).map((v,k)=>v-p[k]))})).filter(h=>h.d<16);
  if(hits.length){
    // If repeated roots overlap, focus a coordinate field to choose which one
    // to drag; otherwise pick the first root within the marker.
    const hit=hits.find(h=>h.j===ui.selectedRoot)||hits.sort((a,b)=>a.d-b.d)[0];
    ui.drag=hit.j;ui.selectedRoot=hit.j;$('metric').setPointerCapture(event.pointerId);
  } else if(ui.result){const [x,y]=tr.world(...p);let a=Math.atan2(y,x);if(a<0)a+=2*Math.PI;$('angle').value=Math.round(a/(2*Math.PI)*ui.result.transport.angles.length)%ui.result.transport.angles.length;drawAll();}
});
$('metric').addEventListener('pointermove',event=>{
  if(ui.drag===null)return;
  const rect=$('metric').getBoundingClientRect(),tr=metricTransform();
  const point=tr.world(event.clientX-rect.left,event.clientY-rect.top);
  const bound=Math.min(18,Number($('domain').value)-1.15),norm=Math.hypot(...point);
  ui.roots[ui.drag]=point.map(v=>Number((norm>bound?v*bound/norm:v).toFixed(4)));
  clearTimeout(ui.timer);markDirty(true);rootRows();drawAll();message('Release the root to recompute.');
});
function releaseRoot(){if(ui.drag!==null){ui.drag=null;rootsChanged();}}
$('metric').addEventListener('pointerup',releaseRoot);$('metric').addEventListener('pointercancel',releaseRoot);
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
$('export-json').addEventListener('click',()=>{if(ui.result&&!ui.dirty)download(new Blob([JSON.stringify(ui.result,null,2)],{type:'application/json'}),`${ui.model}-degree-${ui.result.polynomial.degree}.json`);});
$('export-png').addEventListener('click',()=>{
  if(!ui.result||ui.dirty)return;
  const source=$('polygon'),out=document.createElement('canvas');out.width=source.width;out.height=source.height+90;
  const c=out.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,out.width,out.height);c.fillStyle='#203a39';c.font='22px Georgia';c.fillText(`${isBarbot()?"Barbot":"Dumas–Wolf"} · degree ${ui.result.polynomial.degree}`,24,32);c.font='13px Segoe UI';c.fillText(`L = ${$('radius-value').textContent} · ${isBarbot()?"limit-map samples; "+$("chart").selectedOptions[0].textContent:"dashed: vertex estimates at maximum cutoff"}`,24,57);c.drawImage(source,0,75);out.toBlob(blob=>download(blob,`${ui.model}-projective.png`));
});
new ResizeObserver(drawAll).observe(document.querySelector('.workspace'));
rootRows();drawAll();startSolve();

// Typeset the explanation locally; KaTeX and its fonts are vendored.
for(const element of document.querySelectorAll('.math-notes'))
  renderMathInElement(element,{delimiters:[{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false,trust:false});
