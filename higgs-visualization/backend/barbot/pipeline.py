"""Barbot flat connection in the H-orthonormal real frame.

w=-2 log h, g=exp(w)|dz|^2. T=P^-1 pulls endpoint vectors to the base.
The cone centre is its positive psi_0 eigendirection, not an affine-sphere point.
"""
from time import perf_counter
import numpy as np
from scipy.integrate import solve_ivp
from backend.dumas_wolf.metric import solve_metric
from backend.dumas_wolf.pipeline import describe


def connection(t,w,wx,wy,vx,vy):
    t,w,wx,wy,vx,vy=np.broadcast_arrays(t,w,wx,wy,vx,vy)
    v=vx+1j*vy
    tau=np.exp(w/2)*v
    beta=t*np.exp(-w/4)*v
    omega=-(wx*vy-wy*vx)/4
    gamma=np.zeros(w.shape+(3,3))
    gamma[...,0,0],gamma[...,2,2]=tau.real,-tau.real
    gamma[...,0,1]=gamma[...,1,0]=np.sqrt(2)*beta.real
    gamma[...,1,2]=gamma[...,2,1]=np.sqrt(2)*beta.imag
    gamma[...,0,2],gamma[...,2,0]=-tau.imag-omega,-tau.imag+omega
    return gamma


def integrate(polynomial,metric,settings,progress=None):
    began=perf_counter()
    n=settings.ray_count
    angles=np.arange(n)*2*np.pi/n
    # Two families, both parametrized by Euclidean path length. Geodesic
    # curvature is grad(w).normal/2. g-arclength is integrated separately.
    theta=np.tile(angles,2)
    geodesic=np.repeat([False,True],n)
    count=2*n
    initial=np.zeros((count,13))
    initial[:,:9]=np.broadcast_to(np.eye(3)/np.sqrt(3),(count,3,3)).reshape(count,9)
    initial[:,11]=theta
    evaluations=[0]
    def ode(length,flat):
        evaluations[0]+=1
        if evaluations[0]>60000 or perf_counter()-began>45:
            raise RuntimeError('Barbot transport exceeded the work limit; reduce the cutoff.')
        if progress:progress(f'Cone centres - {min(99,int(100*length/settings.cutoff))}%')
        state=flat.reshape(count,13)
        x,y,angle=state[:,9],state[:,10],state[:,11]
        vx,vy=np.cos(angle),np.sin(angle)
        w,wx,wy=metric.sample(x,y)
        gamma=connection(polynomial.evaluate(x+1j*y),w,wx,wy,vx,vy)
        frame=state[:,:9].reshape(count,3,3)
        product=frame@gamma
        # Frobenius normalization is chart independent; never divide by X0.
        rate=np.sum(frame*product,axis=(1,2))/np.sum(frame*frame,axis=(1,2))
        derivative=np.zeros_like(state)
        derivative[:,:9]=(product-rate[:,None,None]*frame).reshape(count,9)
        derivative[:,9],derivative[:,10]=vx,vy
        derivative[:,11]=geodesic*(wy*vx-wx*vy)/2
        derivative[:,12]=np.exp(w/2)
        return derivative.ravel()
    lengths=np.linspace(0,settings.cutoff,settings.sample_count)
    sol=solve_ivp(ode,(0,settings.cutoff),initial.ravel(),method='DOP853',t_eval=lengths,
        rtol=settings.relative_tolerance,atol=settings.relative_tolerance*.03,max_step=.06)
    if not sol.success:raise RuntimeError(sol.message)
    state=sol.y.T.reshape(-1,count,13)
    frame=state[...,:9].reshape(-1,count,3,3)
    local=np.zeros(state.shape[:2]+(3,))
    local[...,0]=np.cos(state[...,11]/2)
    local[...,2]=-np.sin(state[...,11]/2)
    raw=np.einsum('snij,snj->sni',frame,local)
    norms=np.linalg.norm(raw,axis=-1)
    valid=np.isfinite(norms)&(norms>1e-11)
    centres=np.divide(raw,norms[...,None],out=np.zeros_like(raw),where=valid[...,None])
    comparison=int(.8*(len(lengths)-1))
    dots=np.abs(np.sum(centres[-1]*centres[comparison],axis=-1))
    drift=float(np.max(np.arccos(np.clip(dots,0,1))))
    warnings=[]
    if np.any(~valid):warnings.append('Some cone centres are unresolved after numerical cancellation and are omitted.')
    conditions=np.linalg.cond(frame[-1])
    if np.max(conditions)>1e12:
        warnings.append('Transport is ill-conditioned; check points under grid and cutoff refinement.')
    families={}
    for name,sl in [('straight',slice(0,n)),('geodesic',slice(n,2*n))]:
        families[name]={'homogeneous':centres[:,sl].tolist(),'valid':valid[:,sl].tolist(),
            'paths':state[:,sl,9:11].tolist(),'metric_lengths':state[:,sl,12].tolist()}
    return {'angles':angles.tolist(),'radii':lengths.tolist(),'families':families,
        'diagnostics':{'seconds':perf_counter()-began,'function_evaluations':sol.nfev,
            'projective_drift_radians':drift,'comparison_radius':float(lengths[comparison]),
            'cutoff':settings.cutoff,'warnings':warnings,
            'parameter':'Euclidean path length for both families; metric arclength also exported',
            'centre':'P(z)^(-1) times the H-unit positive psi_0(v) eigenvector',
            'normalization':'R=((1,0,1)/sqrt(2),(0,1,0),(i,0,-i)/sqrt(2)) in the unitary frame'}}


def solve(polynomial,ms,ts,progress=None,initial=None):
    began=perf_counter()
    metric=solve_metric(polynomial,ms,progress,initial,model='barbot')
    transport=integrate(polynomial,metric,ts,progress)
    info=describe(polynomial)
    info.update(model='barbot',expected_vertices=None,
        equation='Delta w = 8 exp(w) - 8 |t|^2 exp(-w/2)',metric='exp(w)|dz|^2; h=exp(-w/2)')
    return {'polynomial':info,'metric':metric.to_json(),'transport':transport,
        'elapsed_seconds':perf_counter()-began,
        'settings':{'radius':ms.radius,'grid_size':ms.grid_size,'cutoff':ts.cutoff,'ray_count':ts.ray_count,
            'metric_relative_tolerance':ms.residual_tolerance,'transport_relative_tolerance':ts.relative_tolerance},
        'source':'https://arxiv.org/abs/2502.09107v2',
        'research_status':'Nestedness supplied by the user; polygonality is work in progress.'},metric
