"""Attach algebraic sheet coordinates to the lifted mesh by continuation."""
from collections import defaultdict, deque
import numpy as np
from .mesh import edge
from .surface import polynomial


def stereographic(p):
    p=np.asarray(p)
    xy=p[...,0]+1j*p[...,1]
    with np.errstate(divide='ignore',invalid='ignore'):
        denominator=np.where(p[...,2]>0,np.abs(xy)**2/(1+p[...,2]),1-p[...,2])
        x=xy/denominator
    return np.where(denominator==0,complex(np.inf),x)


def mesh_coordinates(mesh,family):
    polynomial=family.polynomial
    """Return global meromorphic x,y, verifying every nonbranch edge cycle.

    Fixing the sign at one vertex fixes the identification with y²=x⁵-x.
    Sheet continuation is distinct from the spin-frame transition s/w.
    """
    xb=stereographic(mesh.sphere); adjacency=defaultdict(set)
    for f in mesh.faces:
        for a,b in zip(f,np.roll(f,-1)):
            if mesh.base_vertex[a]>=6 and mesh.base_vertex[b]>=6:
                adjacency[int(a)].add(int(b)); adjacency[int(b)].add(int(a))
    signs={}; edge_signs={}
    def crossing(a,b):
        ba,bb=mesh.base_vertex[a],mesh.base_vertex[b]
        key=edge(ba,bb)
        if key not in edge_signs:
            p,q=mesh.sphere[list(key)]
            angle=np.arccos(np.clip(p@q,-1,1)); t=np.linspace(0,1,65)
            points=(np.sin((1-t)*angle)[:,None]*p+np.sin(t*angle)[:,None]*q)/np.sin(angle)
            phase=np.angle(polynomial(stereographic(points)))
            # Slerp roundoff at real-axis endpoints can change +pi to -pi.
            # Anchor both endpoint arguments to the same stored coordinates
            # used for the global principal square roots.
            phase[0]=np.angle(polynomial(xb[key[0]]))
            phase[-1]=np.angle(polynomial(xb[key[1]]))
            winding=np.unwrap(phase)[-1]-phase[-1]
            edge_signs[key]=1 if np.cos(winding/2)>0 else -1
        return edge_signs[key]
    start=min(adjacency); signs[start]=1; queue=deque([start])
    while queue:
        a=queue.popleft()
        for b in adjacency[a]:
            expected=signs[a]*crossing(a,b)
            if b in signs:
                if signs[b]!=expected:
                    raise ArithmeticError('Algebraic continuation disagrees with the cover gluing')
            else:
                signs[b]=expected; queue.append(b)
    regular=np.flatnonzero(mesh.base_vertex>=6)
    if len(signs)!=len(regular):
        raise ArithmeticError('Regular chart graph is disconnected')
    x=xb[mesh.base_vertex]; y=np.zeros(len(x),dtype=complex)
    y[mesh.base_vertex==1]=complex(np.inf)
    for i in regular:
        y[i]=signs[int(i)]*np.sqrt(complex(polynomial(x[i])))
    return x,y
