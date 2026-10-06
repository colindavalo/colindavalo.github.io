"""A local genus-two moduli chart and all sixteen explicit spin structures."""
from itertools import combinations
import numpy as np
from .graded_mesh import build_graded_mesh
from .mesh import Mesh

REFERENCE=np.array([0,1,1j,-1,-1j],dtype=complex)
SPINS=[dict(id='odd_inf',label='Odd · p∞',indices=[])]+[
    dict(id=f'odd_{i}',label=f'Odd · p{i}',indices=[i]) for i in range(5)]+[
    dict(id='even_'+''.join(map(str,I)),label='Even · '+' + '.join(f'p{i}' for i in I)+' − 2p∞',indices=list(I)) for I in combinations(range(5),3)]


def normalize(payload):
    if not isinstance(payload,dict):raise ValueError('Expected settings object')
    raw=payload.get('roots',[[z.real,z.imag] for z in REFERENCE])
    if not isinstance(raw,list) or len(raw)!=5:raise ValueError('Five finite branch values are required')
    try:
        roots=np.array([complex(*v) for v in raw]);A=complex(*payload.get('A',[.2,0]));B=complex(*payload.get('B',[0,0]))
    except (TypeError,ValueError):raise ValueError('Complex values must be [real, imaginary] pairs')
    if not np.all(np.isfinite(roots)) or not np.isfinite(A) or not np.isfinite(B):raise ValueError('All parameters must be finite')
    if roots[0]!=0 or roots[1]!=1:raise ValueError('The moduli chart fixes 0, 1, and infinity')
    delta=roots[2:]-REFERENCE[2:]
    if np.max(abs(delta.real))>.180001 or np.max(abs(delta.imag))>.180001:
        raise ValueError('This local moduli chart allows ±0.18 in each editable branch coordinate')
    if max(abs(A),abs(B))>1:raise ValueError('Use |A| and |B| at most 1 for interactive computations')
    spin=payload.get('spin','odd_inf');level=payload.get('level',6)
    if spin not in {s['id'] for s in SPINS}:raise ValueError('Unknown spin structure')
    if type(level)!=int or level not in (4,5,6,7):raise ValueError('Resolution must be 4, 5, 6, or 7')
    return dict(roots=[[z.real,z.imag] for z in roots],A=[A.real,A.imag],B=[B.real,B.imag],spin=spin,level=level)


class Family:
    def __init__(self,settings):
        self.settings=normalize(settings);self.roots=np.array([complex(*v) for v in self.settings['roots']])
        self.A=complex(*self.settings['A']);self.B=complex(*self.settings['B'])
        self.spin=next(s for s in SPINS if s['id']==self.settings['spin']);self.indices=self.spin['indices']

    def polynomial(self,x):
        value=np.ones_like(x,dtype=complex)
        for a in self.roots:value=value*(x-a)
        return value

    def f(self,x,exclude=None):
        value=np.ones_like(x,dtype=complex)
        for i in self.indices:
            if i!=exclude:value=value*(x-self.roots[i])
        return value

    def R(self,i,z):
        a=self.roots[i];derivative=np.prod([a-b for j,b in enumerate(self.roots) if i!=j])
        value=np.sqrt(complex(derivative))*np.ones_like(z,dtype=complex)
        for j,b in enumerate(self.roots):
            if i!=j:value=value*np.sqrt(1+z*z/(a-b))
        return value

    def norm(self,x,y):
        x=np.asarray(x);y=np.asarray(y);out=np.zeros(x.shape);finite=np.isfinite(x);xx=x[finite];yy=y[finite]
        den=(1+abs(xx)**2)**1.5;m=len(self.indices)
        if m==0:out[finite]=abs(self.A+self.B*xx)**2/den
        elif m==1:
            f=self.f(xx);out[finite]=abs(self.A*f+self.B)**2*abs(f)/den;out[~finite]=abs(self.A)**2
        else:
            f=self.f(xx);regular=abs(f)>1e-14;values=np.zeros(len(xx))
            values[regular]=abs(self.A*f[regular]+self.B*yy[regular])**2/(abs(f[regular])*den[regular])
            Q=np.ones_like(xx,dtype=complex)
            for j,b in enumerate(self.roots):
                if j not in self.indices:Q*=xx-b
            values[~regular]=abs(self.B)**2*abs(Q[~regular])/den[~regular]
            out[finite]=values;out[~finite]=abs(self.A)**2
        return out

    def branch_spin(self,i,z):
        """kappa=e_local²/dz, T=t/e_local³, log-frame derivative, start gauge."""
        x=self.roots[i]+z*z;R=self.R(i,z);y=z*R;selected=i in self.indices
        F=self.f(x,exclude=i if selected else None);kappa=2*F/R
        if not self.indices:T=self.A+self.B*x
        elif len(self.indices)==1:
            T=self.A*z**3+self.B*z if selected else self.A+self.B/F
        elif selected:T=self.A*z/F+self.B*R/F**2
        else:T=self.A/F+self.B*y/F**2
        logder=sum(2*z/(x-self.roots[j]) for j in self.indices if not(selected and j==i))
        return x,kappa,T,F,logder

    def infinity_spin(self,w):
        R=np.sqrt(np.prod([1-a*w*w for a in self.roots]))
        F=np.prod([1-self.roots[j]*w*w for j in self.indices])
        if not self.indices:return -2/R,self.A*w**3+self.B*w
        if len(self.indices)==1:return -2*F/R,self.A+self.B*w*w/F
        return -2*F/R,self.A/F+self.B*w*R/F**2

    def mesh(self,level):
        mesh=build_graded_mesh(level);p=mesh.sphere.copy();original=p.copy()
        def sphere(z):return np.array([2*z.real,2*z.imag,abs(z)**2-1])/(1+abs(z)**2)
        for i in [2,3,4]:
            old=sphere(REFERENCE[i]);new=sphere(self.roots[i]);angle=np.arccos(np.clip(original@old,-1,1));t=angle/.7
            weight=np.zeros(len(p));inside=t<1
            weight[inside]=np.exp(-t[inside]**2/(1-t[inside]**2))
            p+=weight[:,None]*(new-old)
        p/=np.linalg.norm(p,axis=1)[:,None]
        # Explicitly set the six branch vertices, avoiding cancellation at roots.
        p[[0,2,3,4,5]]=np.array([sphere(z) for z in self.roots])
        triangles=p[mesh.base_faces]
        if np.any(np.einsum('ij,ij->i',triangles[:,0],np.cross(triangles[:,1],triangles[:,2]))<=0):
            raise ValueError('The deformed mesh folds; choose smaller branch displacements')
        return Mesh(p,mesh.base_faces,mesh.faces,mesh.base_vertex,mesh.cuts,level)
