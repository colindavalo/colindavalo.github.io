'use strict';
(() => {
 const view=drawing('projectionCanvas');let yaw=-25,pitch=35,drag=null,pending=false;
 function rotate(p){const a=yaw*Math.PI/180,b=pitch*Math.PI/180,x=p[0]*Math.cos(a)-p[1]*Math.sin(a),y=p[0]*Math.sin(a)+p[1]*Math.cos(a);return [x,y*Math.cos(b)-p[2]*Math.sin(b),y*Math.sin(b)+p[2]*Math.cos(b)];}
 function project(p){const q=rotate(p);return [320+170*q[0],205-170*q[1],q[2]];}
 function normalPoint(u,s){const c=Math.cosh(s),den=c*(1+u*u)+1-u*u;return [2*u*c/den,0,(1-u*u)*Math.sinh(s)/den];}
 function draw(){
  pending=false;const ctx=view.prepare(),u=Number($('projectionFoot').value),s=Number($('projectionDistance').value);
  ctx.strokeStyle='#cad8d1';ctx.lineWidth=1;ctx.beginPath();ctx.arc(320,205,170,0,2*Math.PI);ctx.stroke();
  ctx.fillStyle='rgba(18,107,86,.09)';ctx.beginPath();for(let i=0;i<=160;i++){const a=i*2*Math.PI/160,p=project([Math.cos(a),Math.sin(a),0]);if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);}ctx.closePath();ctx.fill();ctx.strokeStyle='#93b6a6';ctx.stroke();
  function path(points,color,width){for(let i=1;i<points.length;i++){const a=project(points[i-1]),b=project(points[i]),back=(a[2]+b[2])<0;ctx.globalAlpha=back?.45:1;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(back?[3,4]:[]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}ctx.globalAlpha=1;ctx.setLineDash([]);}
  path(Array.from({length:81},(_,i)=>[-1+2*i/80,0,0]),'#b7ccc1',1);
  path(Array.from({length:161},(_,i)=>normalPoint(u,-7+14*i/160)),'#3f6e85',2.4);
  const end=[2*u/(1+u*u),0,(1-u*u)/(1+u*u)];
  for(const sign of [-1,1]){const q=project([end[0],0,sign*end[2]]);ctx.fillStyle='#3f6e85';ctx.beginPath();ctx.arc(q[0],q[1],4,0,2*Math.PI);ctx.fill();}
  for(const [p,color,r] of [[[u,0,0],'#126b56',6],[normalPoint(u,s),'#ac6026',6]]){const q=project(p);ctx.fillStyle=color;ctx.strokeStyle='white';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q[0],q[1],r,0,2*Math.PI);ctx.fill();ctx.stroke();}
  renderMath($('projectionFootValue'),`q=(${u.toFixed(2)},0,0)`);renderMath($('projectionDistanceValue'),`s=${s.toFixed(2)}`);renderMath($('projectionRelation'),`\\pi_0(x)=q,\\qquad d_{\\mathbb H^3}(x,q)=${Math.abs(s).toFixed(2)}`);
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(draw);}}
 for(const id of ['projectionFoot','projectionDistance'])$(id).addEventListener('input',schedule);
 view.canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,yaw,pitch};view.canvas.focus();view.canvas.setPointerCapture(event.pointerId);});
 view.canvas.addEventListener('pointermove',event=>{if(!drag)return;yaw=((drag.yaw+(event.clientX-drag.x)*.45+540)%360)-180;pitch=Math.max(-80,Math.min(80,drag.pitch+(event.clientY-drag.y)*.4));schedule();});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])view.canvas.addEventListener(name,()=>{drag=null;});
 view.canvas.addEventListener('keydown',event=>{const arrows={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,-3],ArrowDown:[0,3]};if(!arrows[event.key])return;event.preventDefault();const [a,b]=arrows[event.key];yaw=((yaw+a+540)%360)-180;pitch=Math.max(-80,Math.min(80,pitch+b));schedule();});
 draw();
})();
