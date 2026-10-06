"""Regular branch charts, with spin-zero frame changes and sheet-aware fields."""
import numpy as np
from scipy.interpolate import CloughTocher2DInterpolator
from scipy.integrate import solve_ivp
from .real_connection import matrix,real_transition
from .marked_loops import BASEPOINT,marking
from .holonomy import product,commutator


class BridgeFields:
    def __init__(self,family,x,y,u):
        self.fields=[]
        for i,a in enumerate(family.roots):
            finite=np.isfinite(x);xx=x[finite];yy=y[finite];values=u[finite]
            # The chart can have distant cuts; only its local tube around the
            # branch-to-basepoint path is used for interpolation.
            delta=BASEPOINT-a;t=np.clip(((xx-a)*np.conj(delta)).real/abs(delta)**2,0,1.25)
            distance=abs(xx-a-t*delta)
            clearance=min(abs((b-a)-np.clip(((b-a)*np.conj(delta)).real/abs(delta)**2,0,1)*delta) for j,b in enumerate(family.roots) if j!=i)
            keep=(distance<max(.15,.35*clearance))|(abs(xx-a)<min(.15,clearance*.45))
            xx=xx[keep];yy=yy[keep];values=values[keep]
            z=np.sqrt((xx-a).astype(complex));predicted=z*family.R(i,z)
            flip=abs(predicted-yy)>abs(predicted+yy);z[flip]*=-1
            points=np.column_stack([z.real,z.imag]);points,unique=np.unique(points,axis=0,return_index=True)
            if len(points)<12:raise ValueError('Too few chart samples; increase resolution')
            self.fields.append(CloughTocher2DInterpolator(points,values[unique],tol=1e-10,maxiter=1000))

    def sample(self,i,z,epsilon=1e-5):
        q=np.array([z,z+epsilon,z-epsilon,z+1j*epsilon,z-1j*epsilon]);v=self.fields[i](q.real,q.imag)
        if not np.all(np.isfinite(v)):raise ValueError('A transport path left its interpolation chart; increase resolution')
        return float(v[0]),float((v[1]-v[2])/(2*epsilon)),float((v[3]-v[4])/(2*epsilon))


class Extrapolated:
    def __init__(self,fine,coarse):self.fine=fine;self.coarse=coarse
    def sample(self,i,z):return tuple((4*a-b)/3 for a,b in zip(self.fine.sample(i,z),self.coarse.sample(i,z)))


def connection(family,i,z,u,ux,uy,v):
    x,kappa,T,F,logder=family.branch_spin(i,z)
    ell=-u-.5*np.log1p(abs(x)**2)+np.log(abs(F));dx=2*z
    lx=-ux-(np.conj(x)*dx).real/(1+abs(x)**2)+logder.real
    ly=-uy-(np.conj(x)*1j*dx).real/(1+abs(x)**2)-logder.imag
    return matrix(kappa*v*np.exp(-ell),kappa*T*v*np.exp(ell/2),(lx*v.imag-ly*v.real)/2)


def holonomy(family,field,check=lambda:None,progress=lambda s:None,tolerance=2e-9):
    order=sorted(range(5),key=lambda i:np.angle(family.roots[i]-BASEPOINT))
    reference=min(order,key=lambda i:abs(family.roots[i]-BASEPOINT));cut=order.index(reference)+1;order=order[cut:]+order[:cut]
    plus=[];minus=[]
    for number,i in enumerate(order):
        check();progress(f'Holonomy: branch path {number+1}/5')
        a=family.roots[i];z0=np.sqrt(complex(BASEPOINT-a));expected=np.sqrt(complex(family.polynomial(BASEPOINT)))
        if abs(z0*family.R(i,z0)-expected)>abs(z0*family.R(i,z0)+expected):z0=-z0
        halves=[]
        for sign in [1,-1]:
            start=sign*z0
            def ode(r,state):
                check();z=start*r;u,ux,uy=field.sample(i,z)
                return (state.reshape(3,3)@connection(family,i,z,u,ux,uy,start)).ravel()
            sol=solve_ivp(ode,(1,0),np.eye(3).ravel(),method='DOP853',rtol=tolerance,atol=tolerance*.03,max_step=.025)
            if not sol.success:raise ArithmeticError(sol.message)
            # e_local=e/z at a selected spin zero. The starting gauge must be
            # included separately on each sheet: its sign records the spin.
            Q=real_transition(1/start) if i in family.indices else np.eye(3)
            halves.append(Q@sol.y[:,-1].reshape(3,3))
        plus.append(halves[0]@np.linalg.inv(halves[1]));minus.append(halves[1]@np.linalg.inv(halves[0]))
    generators=[plus[i]@minus[4] for i in range(4)]
    matrices={name:product(word,generators) for name,word in marking().items()}
    rel=commutator(matrices['a1'],matrices['b1'])@commutator(matrices['a2'],matrices['b2'])
    return dict(generators={name:m.tolist() for name,m in matrices.items()},
        surface_relation_error=float(np.linalg.norm(rel-np.eye(3))),surface_relation_matrix=rel.tolist(),
        determinant_errors={name:float(abs(np.linalg.det(m)-1)) for name,m in matrices.items()},
        basepoint=[BASEPOINT.real,BASEPOINT.imag],marking=marking(),branch_order=order,
        settings=family.settings,spin=family.spin['label'],
        convention='Inverse transport in a common real H-unitary base frame; no relation projection')


def compute(settings,check=lambda:None,progress=lambda s:None):
    from .family import Family
    from .family_solver import solve
    family=Family(settings);fields=[];metrics=[]
    for level in [family.settings['level']-1,family.settings['level']]:
        check();progress(f'Level {level}: building the surface mesh')
        mesh=family.mesh(level);check();progress(f'Level {level}: solving the harmonic metric')
        u,x,y,diagnostics=solve(mesh,family,check);metrics.append(diagnostics)
        check();progress(f'Level {level}: reconstructing regular charts')
        fields.append(BridgeFields(family,x,y,u))
    result=holonomy(family,Extrapolated(fields[1],fields[0]),check,progress)
    result['metrics']=metrics;result['extrapolation']='(4 fine - coarse)/3 before transport'
    return result
