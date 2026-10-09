'use strict';
const $ = id => document.getElementById(id);
const mathOptions = {throwOnError:true, macros:{'\\R':'\\mathbb{R}','\\Z':'\\mathbb{Z}','\\SL':'\\mathrm{SL}','\\SO':'\\mathrm{SO}','\\one':'1\\!\\!1'}};
function renderMath(element, tex, displayMode=false) {
  katex.render(tex, element, {...mathOptions, displayMode});
}
renderMathInElement(document.body, {...mathOptions, delimiters:[
  {left:'\\[',right:'\\]',display:true}, {left:'\\(',right:'\\)',display:false}
]});
const colors = {green:'#126b56', blue:'#3f6e85', line:'#d8dfdc'};
function drawing(id) {
  const canvas=$(id), width=Number(canvas.getAttribute('width')), height=Number(canvas.getAttribute('height'));
  const ctx=canvas.getContext('2d');
  return {canvas, width, height, prepare(){
    const ratio=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==width*ratio || canvas.height!==height*ratio){canvas.width=width*ratio;canvas.height=height*ratio;}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);return ctx;
  }};
}
const disk=drawing('hyperbolicCanvas'), conic=drawing('flagCanvas'), nest=drawing('nestCanvas');
const point={u:0.15,v:0.12};
const diskCenter={x:220,y:180,r:142};
// Symmetric positive 2x2 matrices of determinant one model the fixed H^2.
function conicData() {
  const {u,v}=point, r2=u*u+v*v, d=1-r2;
  const q11=(1+r2+2*u)/d, q12=2*v/d, q22=(1+r2-2*u)/d;
  // For det(Q)=1: Q^(-1/2)=(Q^(-1)+I)/sqrt(tr(Q)+2).
  const divisor=Math.sqrt(q11+q22+2);
  const inverseRoot=[(q22+1)/divisor,-q12/divisor,(q11+1)/divisor];
  return {q11,q12,q22,inverseRoot};
}
function drawDisk() {
  const ctx=disk.prepare(), {x,y,r}=diskCenter;
  ctx.fillStyle='#f1f7f4';ctx.strokeStyle=colors.green;ctx.lineWidth=1.6;
  ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fill();ctx.stroke();
  ctx.strokeStyle=colors.line;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);ctx.stroke();
  ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+point.u*r,y-point.v*r);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=colors.green;ctx.beginPath();ctx.arc(x+point.u*r,y-point.v*r,7,0,2*Math.PI);ctx.fill();
  renderMath($('diskCoordinates'),`z=${point.u.toFixed(2)}${point.v<0?'':'+'}${point.v.toFixed(2)}i`);
}
function drawConic() {
  const ctx=conic.prepare(), data=conicData(), m=data.inverseRoot;
  const r=Math.hypot(point.u,point.v), maxAxis=Math.sqrt((1+r)/(1-r))/Math.sqrt(Math.PI);
  // Fixed screen scale and fixed area normalization: no fit-to-frame scaling.
  const scale=170, cx=220, cy=180;
  const transform=theta=>[(m[0]*Math.cos(theta)+m[1]*Math.sin(theta))/Math.sqrt(Math.PI),(m[1]*Math.cos(theta)+m[2]*Math.sin(theta))/Math.sqrt(Math.PI)];
  const screen=w=>[cx+scale*w[0],cy-scale*w[1]];
  ctx.strokeStyle=colors.line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(25,cy);ctx.lineTo(415,cy);ctx.moveTo(cx,25);ctx.lineTo(cx,335);ctx.stroke();
  ctx.beginPath();for(let i=0;i<=240;i++){const p=screen(transform(i*2*Math.PI/240));if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p);}
  ctx.closePath();ctx.strokeStyle=colors.green;ctx.lineWidth=2;ctx.stroke();
  const angle=Number($('angle').value), theta=angle*Math.PI/180, w=transform(theta), p=screen(w);
  const nx=data.q11*w[0]+data.q12*w[1], ny=data.q12*w[0]+data.q22*w[1];
  const dx=-ny,dy=-nx,norm=Math.hypot(dx,dy);
  ctx.strokeStyle=colors.blue;ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(p[0]-dx/norm*500,p[1]-dy/norm*500);ctx.lineTo(p[0]+dx/norm*500,p[1]+dy/norm*500);ctx.stroke();
  ctx.fillStyle='white';ctx.beginPath();ctx.arc(...p,8,0,2*Math.PI);ctx.fill();ctx.fillStyle=colors.green;ctx.beginPath();ctx.arc(...p,5,0,2*Math.PI);ctx.fill();
  renderMath($('angleValue'),`\\theta=${angle.toFixed(0)}^\\circ`);
  renderMath($('ellipseMetrics'),`\\operatorname{Area}=1,\\quad\\operatorname{diam}= ${(2*maxAxis).toFixed(2)}`);
  renderMath($('conicMatrix'),`Q_z=\\begin{pmatrix}${data.q11.toFixed(3)}&${data.q12.toFixed(3)}\\\\${data.q12.toFixed(3)}&${data.q22.toFixed(3)}\\end{pmatrix}`,true);
}
function updatePoint(u,v) {
  const r=Math.hypot(u,v), factor=r>.999?.999/r:1;
  point.u=u*factor;point.v=v*factor;drawDisk();drawConic();
}
function moveFromPointer(event) {
  const rect=disk.canvas.getBoundingClientRect();
  const x=(event.clientX-rect.left)*disk.width/rect.width;
  const y=(event.clientY-rect.top)*disk.height/rect.height;
  updatePoint((x-diskCenter.x)/diskCenter.r,(diskCenter.y-y)/diskCenter.r);
}
let dragging=false;
// Pointer capture supports dragging outside the canvas and touch interaction.
 disk.canvas.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;
   dragging=true;disk.canvas.setPointerCapture(event.pointerId);disk.canvas.focus();moveFromPointer(event);
 });
 disk.canvas.addEventListener('pointermove',event=>{if(dragging)moveFromPointer(event);});
 disk.canvas.addEventListener('pointerup',()=>{dragging=false;});
 disk.canvas.addEventListener('pointercancel',()=>{dragging=false;});
 disk.canvas.addEventListener('lostpointercapture',()=>{dragging=false;});
 disk.canvas.addEventListener('keydown',event=>{
   const directions={ArrowLeft:[-.02,0],ArrowRight:[.02,0],ArrowUp:[0,.02],ArrowDown:[0,-.02]};
   if(directions[event.key]){event.preventDefault();const [du,dv]=directions[event.key];updatePoint(point.u+du,point.v+dv);}
 });
$('angle').addEventListener('input',drawConic);
function drawNest() {
  const ctx=nest.prepare(), s=Number($('travel').value);
  for(let k=0;k<=Math.floor(s);k++){
    const r=120*Math.exp(-k*.27), x=290+45*(1-Math.exp(-k*.27));
    ctx.fillStyle=`rgba(18,107,86,${.025+k*.015})`;ctx.strokeStyle=k===0?'#a6bbb2':colors.green;ctx.lineWidth=1.3;
    ctx.beginPath();ctx.arc(x,155,r,0,2*Math.PI);ctx.fill();ctx.stroke();
  }
  ctx.strokeStyle=colors.green;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(290+45*(1-Math.exp(-s*.27)),155,120*Math.exp(-s*.27),0,2*Math.PI);ctx.stroke();
  renderMath($('travelValue'),`s=${s.toFixed(2)}`);
}
$('travel').addEventListener('input',drawNest);
drawDisk();drawConic();drawNest();
// Optional page-scoped, read-only inspection of the visible exploration.
if(document.modelContext?.registerTool) {
  try{Promise.resolve(document.modelContext.registerTool({
    name:'read_exploration_state',title:'Read the geometric figures',
    description:'Read the selected hyperbolic point, tangent angle and nesting parameter.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true,untrustedContentHint:false},
    execute:()=>({diskPoint:{...point},conicMatrix:conicData(),angle:Number($('angle').value),geodesicFlowParameter:Number($('travel').value),projectionFoot:Number($('projectionFoot').value),projectionDistance:Number($('projectionDistance').value)})
  })).catch(()=>{});}catch{}
}
