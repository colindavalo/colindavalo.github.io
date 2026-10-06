'use strict';
// Orthographic rendering of the actual S² double cover: p and -p are both
// drawn. No sign-folding to a hemisphere is used in this view.
const SphereView={
  lifts(points){return points.flatMap(p=>[p,p.map(x=>-x)]);},
  draw(ctx,points,rotate,width,height,size){
    const r=Math.min(width,height)*.42,cx=width/2,cy=height/2;
    const gradient=ctx.createRadialGradient(cx-r*.3,cy-r*.35,r*.08,cx,cy,r);
    gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.75,'#f0f5f3');gradient.addColorStop(1,'#dce9e5');
    ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.fill();
    function grid(back){ctx.strokeStyle=back?'#dde6e1':'#bccfc7';ctx.lineWidth=.6;ctx.setLineDash(back?[2,4]:[]);
      const lines=[];
      for(let lat=-60;lat<=60;lat+=30){const a=lat*Math.PI/180;lines.push(Array.from({length:121},(_,i)=>{const t=i*2*Math.PI/120;return [Math.cos(a)*Math.cos(t),Math.cos(a)*Math.sin(t),Math.sin(a)];}));}
      for(let lon=0;lon<180;lon+=30){const a=lon*Math.PI/180;lines.push(Array.from({length:121},(_,i)=>{const t=i*2*Math.PI/120;return [Math.cos(t)*Math.cos(a),Math.cos(t)*Math.sin(a),Math.sin(t)];}));}
      for(const line of lines){ctx.beginPath();let pen=false;for(const p of line){const q=rotate(p);if((q[0]<0)!==back){pen=false;continue;}const x=cx+r*q[1],y=cy-r*q[2];if(pen)ctx.lineTo(x,y);else ctx.moveTo(x,y);pen=true;}ctx.stroke();}ctx.setLineDash([]);
    }
    grid(true);grid(false);
    for(const back of [true,false]){ctx.fillStyle=back?'rgba(111,88,170,0.28)':'rgba(12,103,103,0.85)';const s=back?size*.85:size;
      for(const p of points){const q=rotate(p);for(const sign of [1,-1]){if((sign*q[0]<0)!==back)continue;ctx.fillRect(cx+r*sign*q[1]-s/2,cy-r*sign*q[2]-s/2,s,s);}}
    }
    ctx.strokeStyle='#9fbcb0';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.stroke();
    ctx.font='12px system-ui';ctx.fillStyle='#21736d';ctx.fillText('Front hemisphere',cx-r,cy+r+25);ctx.fillStyle='#81709e';ctx.fillText('Rear hemisphere · translucent',cx+5,cy+r+25);
    return points.length*2;
  }
};
if(typeof module!=='undefined')module.exports=SphereView;
