'use strict';
// Rotating view of the sampled projective limit curve (both antipodal lifts on S^2).
(() => {
 const canvas=document.getElementById('limitSphere');
 if(!canvas||!window.LIMIT_POINTS_B64)return;
 const raw=atob(window.LIMIT_POINTS_B64), n=raw.length/6, pts=new Float32Array(3*n);
 for(let i=0;i<3*n;i++){let v=raw.charCodeAt(2*i)|(raw.charCodeAt(2*i+1)<<8);if(v>32767)v-=65536;pts[i]=v/32767;}
 const W=Number(canvas.getAttribute('width')), H=Number(canvas.getAttribute('height')), ctx=canvas.getContext('2d');
 const R=Math.min(W,H)*0.43, cx=W/2, cy=H/2;
 let yaw=0.6, pitch=0.35, dragging=false, last=null, pausedUntil=0, visible=true, prev=null;
 const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function draw(){
  const ratio=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==W*ratio){canvas.width=W*ratio;canvas.height=H*ratio;}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);
  const cyw=Math.cos(yaw), syw=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
  const front=[], back=[];
  for(let i=0;i<n;i++){
   const x=pts[3*i], y=pts[3*i+1], z=pts[3*i+2];
   const X=cyw*x+syw*y, Y0=-syw*x+cyw*y;      // rotation about the vertical axis z
   const Z=cp*z-sp*Y0, D=sp*z+cp*Y0;           // tilt; D>0 faces the reader
   (D>0?front:back).push(X,Z); (D>0?back:front).push(-X,-Z); // antipodal lift
  }
  ctx.fillStyle='rgba(107,92,165,.32)';
  for(let i=0;i<back.length;i+=2)ctx.fillRect(cx+R*back[i]-.6,cy-R*back[i+1]-.6,1.2,1.2);
  const g=ctx.createRadialGradient(cx-R*.35,cy-R*.4,R*.1,cx,cy,R);
  g.addColorStop(0,'rgba(234,243,239,.55)');g.addColorStop(1,'rgba(200,222,213,.55)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R,0,2*Math.PI);ctx.fill();
  ctx.strokeStyle='#b9d0c5';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='rgba(18,107,86,.85)';
  for(let i=0;i<front.length;i+=2)ctx.fillRect(cx+R*front[i]-.7,cy-R*front[i+1]-.7,1.4,1.4);
 }
 function frame(t){
  if(prev!==null&&!dragging&&!still&&visible&&t>pausedUntil)yaw+=(t-prev)*0.00018;
  prev=t;draw();requestAnimationFrame(frame);
 }
 canvas.addEventListener('pointerdown',e=>{dragging=true;last=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!dragging)return;yaw+=(e.clientX-last[0])*0.01;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-last[1])*0.01));last=[e.clientX,e.clientY];});
 const stop=()=>{dragging=false;pausedUntil=performance.now()+4000;};
 canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
 canvas.addEventListener('keydown',e=>{const k={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]}[e.key];if(k){e.preventDefault();yaw+=k[0];pitch+=k[1];pausedUntil=performance.now()+4000;}});
 if('IntersectionObserver' in window)new IntersectionObserver(es=>{visible=es[0].isIntersecting;}).observe(canvas);
 requestAnimationFrame(frame);
})();
