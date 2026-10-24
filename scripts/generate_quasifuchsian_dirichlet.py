#!/usr/bin/env python3
"""Generate the genus-two quasi-Fuchsian Dirichlet illustration.

The construction starts from the standard Bolza surface group, follows a
deterministic complex tangent inside the PSL(2,C) surface-representation
variety, computes Dirichlet half-spaces in the Klein ball, and approximates
the limit curve from attracting fixed points of words of length at most five.

Usage:
    python3 scripts/generate_quasifuchsian_dirichlet.py [output.svg]

Requires NumPy and SciPy.
"""

import sys
from pathlib import Path
import numpy as np
from scipy.linalg import expm, null_space

def inv(m): return np.linalg.inv(m)

sqrt2=np.sqrt(2.0)
aa=1+sqrt2
bb=(2+sqrt2)*np.sqrt(sqrt2-1)
base=[]
for k in range(4):
    z=np.exp(1j*k*np.pi/4)
    base.append(np.array([[aa,bb*z],[bb/z,aa]],complex))

def sl2(v):
    a=v[0]+1j*v[1]; b=v[2]+1j*v[3]; c=v[4]+1j*v[5]
    return np.array([[a,b],[c,-a]],complex)

def matrices(x): return [expm(sl2(x[6*i:6*i+6]))@base[i] for i in range(4)]

def relation(gs):
    g0,g1,g2,g3=gs
    return g0@inv(g1)@g2@inv(g3)@inv(g0)@g1@inv(g2)@g3

def residual(x):
    r=relation(matrices(x))
    z=np.array([r[0,0]-r[1,1],r[0,1],r[1,0]])
    return np.r_[z.real,z.imag]

def jacobian(x,h=2e-6):
    f0=residual(x); J=np.zeros((6,24))
    for j in range(24):
        xx=x.copy(); xx[j]+=h
        J[:,j]=(residual(xx)-f0)/h
    return J

xzero=np.zeros(24)
print('base relation',np.linalg.norm(relation(base)-np.eye(2)))
J0=jacobian(xzero)
N=null_space(J0)
rng=np.random.default_rng(12)
target=np.zeros(24); target[1::2]=rng.normal(size=12)
v=N@(N.T@target); v/=np.linalg.norm(v)
BENDING_SIZE=.65
MAX_WORD_LENGTH=6
x=BENDING_SIZE*v
for it in range(12):
    f=residual(x); J=jacobian(x)
    A=np.vstack([J,v])
    rhs=-np.r_[f,np.dot(x,v)-BENDING_SIZE]
    dx=A.T@np.linalg.solve(A@A.T,rhs)
    x+=dx
    if np.linalg.norm(f)<1e-11: break
gens=matrices(x)
print('deformed relation',np.linalg.norm(relation(gens)-np.eye(2)),'step',np.linalg.norm(x))
print('trace squares', [complex(np.trace(g)**2) for g in gens])

G=gens+[inv(g) for g in gens]

def herm_point(g):
    H=g@g.conj().T
    H=(H+H.conj().T)/2
    t=((H[0,0]+H[1,1])/2).real
    z=((H[0,0]-H[1,1])/2).real
    xx=H[0,1].real
    y=-H[0,1].imag
    q=np.array([t,xx,y,z])
    q=q/np.sqrt(max(1e-30,q[0]**2-np.dot(q[1:],q[1:])))
    return q

els=[]
front=[(np.eye(2,dtype=complex),-1,())]
for depth in range(1,MAX_WORD_LENGTH+1):
    new=[]
    for m,last,word in front:
        for j,g in enumerate(G):
            if last>=0 and j==(last+4)%8: continue
            mm=m@g
            mm=mm/np.sqrt(np.linalg.det(mm))
            new.append((mm,j,word+(j,)))
            els.append((mm,word+(j,)))
    front=new
print('elements',len(els))

planes=[]
for m,word in els:
    q=herm_point(m)
    n=q[1:]; c=q[0]-1; nn=np.linalg.norm(n)
    if nn<1e-9: continue
    planes.append((c/nn,n,c,word,q[0]))
planes.sort(key=lambda q:q[0])
print('nearest',[(round(p[0],4),p[3]) for p in planes[:12]])

def clip(poly,a,b,c,eps=2e-9):
    if not poly: return []
    out=[]; prev=poly[-1]; fp=a*prev[0]+b*prev[1]-c; inp=fp<=eps
    for cur in poly:
        fc=a*cur[0]+b*cur[1]-c; inc=fc<=eps
        if inc != inp:
            t=fp/(fp-fc); out.append(prev+t*(cur-prev))
        if inc: out.append(cur)
        prev,fp,inp=cur,fc,inc
    return out

active=[]
constraints=planes[:5000]
for p in planes[:900]:
    _,n,c,word,_=p; nn=np.linalg.norm(n); h=(c/(nn*nn))*n
    rad=np.sqrt(max(0,1-np.dot(h,h)))
    seed=np.array([1.,0,0]) if abs(n[0]/nn)<.85 else np.array([0.,1,0])
    u=np.cross(n,seed); u/=np.linalg.norm(u); vv=np.cross(n,u); vv/=np.linalg.norm(vv)
    poly=[rad*np.array([np.cos(t),np.sin(t)]) for t in np.linspace(0,2*np.pi,193)[:-1]]
    for pp in constraints:
        if pp is p: continue
        _,m,d,_,_=pp
        poly=clip(poly,np.dot(m,u),np.dot(m,vv),d-np.dot(m,h))
        if len(poly)<3: break
    if len(poly)>=3:
        ar=abs(sum(np.cross(poly[k],poly[(k+1)%len(poly)]) for k in range(len(poly)))/2)
        if ar>2e-6:
            xyz=np.array([h+u*q[0]+vv*q[1] for q in poly])
            active.append((word,xyz,ar,p[0]))
print('active Dirichlet faces',len(active))

# Attracting fixed points of group elements approximate the quasi-circle.
limit=[]
for m,word in els:
    if len(word)<3: continue
    ew,ev=np.linalg.eig(m)
    k=int(np.argmax(np.abs(ew)))
    if abs(ew[k]) < 1.0001: continue
    q=ev[:,k]; den=(abs(q[0])**2+abs(q[1])**2)
    p=np.array([2*(q[0]*q[1].conjugate()).real/den,
                -2*(q[0]*q[1].conjugate()).imag/den,
                (abs(q[0])**2-abs(q[1])**2)/den])
    limit.append(p)
limit=np.array(limit)
# Deterministic thinning after rounding removes the heavy word multiplicities.
_,keep=np.unique(np.round(limit,4),axis=0,return_index=True)
limit=limit[np.sort(keep)]
print('limit points',len(limit))

# The deformation is small enough that the quasi-circle remains a radial graph
# over its principal plane. Average points in angular bins, then normalize back
# to the sphere; this gives a stable cyclic order for interpolation.
center=limit.mean(axis=0)
ew,evec=np.linalg.eigh(np.cov(limit.T))
u=evec[:,-1]; vv=evec[:,-2]
angles=np.mod(np.arctan2((limit-center)@vv,(limit-center)@u),2*np.pi)
curve=[]
nbins=128
for k in range(nbins):
    lo=2*np.pi*k/nbins; hi=2*np.pi*(k+1)/nbins
    chunk=limit[(angles>=lo)&(angles<hi)]
    if len(chunk):
        p=chunk.mean(axis=0); curve.append(p/np.linalg.norm(p))
curve=np.array(curve)
print('interpolation nodes',len(curve))

def rot_x(a):
    c,s=np.cos(a),np.sin(a); return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def rot_z(a):
    c,s=np.cos(a),np.sin(a); return np.array([[c,-s,0],[s,c,0],[0,0,1]])
view=rot_x(-0.82)@rot_z(0.32)

def project(p):
    q=np.asarray(p)@view.T
    return np.c_[120+61*q[:,0],75-61*q[:,1],q[:,2]]

cp=project(curve)
rendered=[]
for item in active:
    pr=project(item[1])
    rendered.append((item,pr,float(pr[:,2].mean())))
rendered.sort(key=lambda z:z[2])

def pts(a): return ' '.join(f'{x:.2f},{y:.2f}' for x,y in a[:,:2])
def closed_catmull_rom(a):
    xy=a[:,:2]; n=len(xy)
    out=[f'M {xy[0,0]:.2f} {xy[0,1]:.2f}']
    for i in range(n):
        p0,p1,p2,p3=xy[(i-1)%n],xy[i],xy[(i+1)%n],xy[(i+2)%n]
        c1=p1+(p2-p0)/6; c2=p2-(p3-p1)/6
        out.append(f'C {c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}')
    return ' '.join(out)+' Z'

def open_catmull_rom(a):
    xy=a[:,:2]; n=len(xy)
    if n<2: return ''
    out=[f'M {xy[0,0]:.2f} {xy[0,1]:.2f}']
    for i in range(n-1):
        p0,p1,p2,p3=xy[max(i-1,0)],xy[i],xy[i+1],xy[min(i+2,n-1)]
        c1=p1+(p2-p0)/6; c2=p2-(p3-p1)/6
        out.append(f'C {c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}')
    return ' '.join(out)

def cyclic_runs(points,mask):
    """Return contiguous cyclic runs of points selected by a Boolean mask."""
    if mask.all(): return [points]
    start=int(np.flatnonzero(~mask)[0])
    points=np.roll(points,-start,axis=0); mask=np.roll(mask,-start)
    runs=[]; current=[]
    for p,keep in zip(points,mask):
        if keep: current.append(p)
        elif current:
            runs.append(np.array(current)); current=[]
    if current: runs.append(np.array(current))
    return [run for run in runs if len(run)>1]
svg=[]
svg.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150">')
svg.append('<metadata>Computed Klein-model Dirichlet domain for a complex deformation of the genus-two Bolza surface group; surface-relation residual below 1e-12.</metadata>')
svg.append('<rect width="240" height="150" fill="#edf3f0"/>')
svg.append('<circle cx="120" cy="75" r="63" fill="#f7f9f8" stroke="#126b56" stroke-width="1.35"/>')
svg.append('<path d="M120 12 A63 63 0 1 1 76 120 C101 131 137 129 159 105 C181 81 178 42 151 23 C142 17 132 13 120 12Z" fill="#cbded7" opacity="0.58"/>')
svg.append('<ellipse cx="99" cy="49" rx="31" ry="21" fill="#ffffff" opacity="0.62" transform="rotate(-24 99 49)"/>')
palette=['#dcece6','#e9f0f3','#c8dfd7','#dbe7ec']
# Every detected side is filled. Short words give the eight large central
# faces; longer words close the narrow sectors at the sphere at infinity.
for j,(item,pr,d) in enumerate(rendered):
    word_length=len(item[0])
    opacity=.50+.16*(d+1)/2
    stroke_width=.70 if word_length==1 else .48
    svg.append(f'<polygon points="{pts(pr)}" fill="{palette[j%4]}" fill-opacity="{opacity:.2f}" stroke="#126b56" stroke-width="{stroke_width:.2f}" stroke-linejoin="round"/>')
# Smooth interpolation of the computed attracting fixed points.
curve_path=closed_catmull_rom(cp)
# The complete curve gives the rear half, visible faintly through the sphere.
svg.append(f'<path d="{curve_path}" fill="none" stroke="#a46d21" stroke-width="1.45" opacity="0.12" stroke-linejoin="round"/>')
# Redraw only the front-facing runs at full strength.
for segment in cyclic_runs(cp,cp[:,2]>=0):
    front_path=open_catmull_rom(segment)
    svg.append(f'<path d="{front_path}" fill="none" stroke="#ffffff" stroke-width="3.4" opacity="0.70" stroke-linejoin="round" stroke-linecap="round"/>')
    svg.append(f'<path d="{front_path}" fill="none" stroke="#a46d21" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>')
svg.append('<circle cx="120" cy="75" r="3.2" fill="#3f6e85" stroke="#f7f9f8" stroke-width="1.2"/>')
svg.append('<circle cx="120" cy="75" r="63" fill="none" stroke="#126b56" stroke-width="1.55"/>')
svg.append('</svg>')
output=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'pictures'/'quasifuchsian-dirichlet.svg'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text('\n'.join(svg),encoding='utf-8')
print('wrote',output)
