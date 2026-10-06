/* Projective segment selection and exact affine-window clipping.
   Input lifts are the continuous cone-centre lifts supplied by the backend.
   Their closing seam is antipodal because c(theta+2pi)=-c(theta).
   Neighbour tangents on the same projective line override the lift fallback.
*/
(function(root){
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const mul=(a,s)=>a.map(v=>v*s);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function unit(a){const n=Math.hypot(...a);return Number.isFinite(n)&&n>1e-14?mul(a,1/n):null;}
  function chooseArc(points,valid,i){
    const n=points.length,j=(i+1)%n;
    if(n<2||!valid[i]||!valid[j])return null;
    const p=unit(points[i]),q=unit(points[j]);if(!p||!q)return null;
    const cosine=dot(p,q),distance=Math.acos(Math.min(1,Math.abs(cosine)));
    // Coincident/clustered vertex samples use their short local segment.
    if(distance<.002)return {p,q:mul(q,cosine<0?-1:1),method:'near-vertex'};
    const normal=unit(cross(p,q));
    const start=unit(sub(q,mul(p,cosine))),end=unit(sub(mul(q,cosine),p));
    let score=0,votes=0;
    function neighbour(index,step,base,tangent,incoming){
      for(let k=1;k<=Math.min(n-2,Math.ceil(n/4));k++){
        const at=(index+step*k+n*2)%n;
        if(!valid[at])break; // Never infer across an unresolved sample.
        let r=unit(points[at]);if(!r)break;
        if(dot(base,r)<0)r=mul(r,-1);
        const angle=Math.acos(Math.min(1,dot(base,r)));
        if(angle<.002)continue;
        // A different supporting line indicates a corner, not continuation.
        if(angle>1.1||Math.abs(dot(normal,r))>.035)break;
        const local=unit(sub(r,mul(base,dot(base,r))));
        const alignment=dot(local,tangent)*(incoming?-1:1);
        if(Math.abs(alignment)>.75){score+=alignment;votes++;}
        break;
      }
    }
    neighbour(i,-1,p,start,true);neighbour(j,1,q,end,false);
    const confident=votes>0&&Math.abs(score)>.65;
    const sign=confident?(score>0?1:-1):(j===0?-1:1);
    return {p,q:mul(q,sign),method:confident?'neighbours':'continuous-lift'};
  }
  function clipSegment(p,q,axis,range){
    const delta=sub(q,p),other=[0,1,2].filter(i=>i!==axis),pieces=[];
    // In each denominator-sign half, all four window bounds are linear
    // inequalities in t for X(t)=(1-t)p+tq. This splits infinity exactly.
    for(const sign of [1,-1]){
      let lo=0,hi=1;
      const constraints=[[sign*p[axis]-1e-12,sign*delta[axis]]];
      for(const k of other)for(const side of [-1,1])constraints.push([
        sign*(range*p[axis]+side*p[k]),sign*(range*delta[axis]+side*delta[k])]);
      for(const [a,b] of constraints){
        if(Math.abs(b)<1e-14){if(a<0){lo=1;hi=0;break;}}
        else if(b>0)lo=Math.max(lo,-a/b);else hi=Math.min(hi,-a/b);
      }
      if(hi-lo<1e-12)continue;
      const project=t=>{const x=p.map((v,k)=>v+t*delta[k]);return other.map(k=>x[k]/x[axis]);};
      const a=project(lo),b=project(hi);
      if([...a,...b].every(Number.isFinite))pieces.push([a,b]);
    }
    return pieces;
  }
  const api={chooseArc,clipSegment};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProjectiveSegments=api;
})(typeof globalThis!=='undefined'?globalThis:this);
