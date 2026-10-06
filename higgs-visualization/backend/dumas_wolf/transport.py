"""Real affine frame E=(f,e^(-w/2)f_x,e^(-w/2)f_y), from DW equation (4).
E'=E B; E(0)=I. Divide the whole frame continuously by f_0 to control growth.
Only forward projective samples are used: collapsed frames are not inverted.
"""
from dataclasses import dataclass
from time import perf_counter
import numpy as np
from scipy.integrate import solve_ivp

@dataclass(frozen=True)
class TransportSettings:
    ray_count: int = 120
    cutoff: float = 4.5
    relative_tolerance: float = 2e-8
    sample_count: int = 65


def connection_matrices(q,w,wx,wy):
    q,w,wx,wy = np.broadcast_arrays(q,w,wx,wy)
    a,b,k = q.real*np.exp(-w), q.imag*np.exp(-w), np.exp(w/2)
    bx = np.zeros(w.shape+(3,3))
    by = np.zeros_like(bx)
    bx[...,0,1] = bx[...,1,0] = k
    bx[...,1,1], bx[...,2,2] = a,-a
    bx[...,1,2], bx[...,2,1] = wy/2-b,-wy/2-b
    by[...,0,2] = by[...,2,0] = k
    by[...,1,1], by[...,2,2] = -b,b
    by[...,1,2], by[...,2,1] = -wx/2-a,wx/2-a
    return bx,by


def integrate_rays(polynomial,metric,settings: TransportSettings,progress=None):
    started = perf_counter()
    radius = float(metric.axis[-1])
    if not 24 <= settings.ray_count <= 360:
        raise ValueError('Use 24-360 rays.')
    if not 0 < settings.cutoff <= radius-2*(metric.axis[1]-metric.axis[0]):
        raise ValueError('Ray cutoff must be strictly inside the metric domain.')
    if not 9 <= settings.sample_count <= 129:
        raise ValueError('Use 9-129 radial samples.')
    d = polynomial.degree
    uniform = np.arange(settings.ray_count)*2*np.pi/settings.ray_count
    # Sector-centre rays estimate vertices asymptotically; these are explicitly
    # finite-radius estimates, not a hull fit or certification of convergence.
    sectors = np.arange(d+3)*2*np.pi/(d+3)
    angles = np.concatenate([uniform,sectors])
    ca,sa = np.cos(angles),np.sin(angles)
    count = len(angles)
    checkpoints = np.linspace(0,settings.cutoff,settings.sample_count)
    evaluations = [0]

    def ode(r,state):
        stage = min(99,int(100*r/settings.cutoff))
        evaluations[0] += 1
        if evaluations[0] > 60000 or perf_counter()-started > 45:
            raise RuntimeError('Transport exceeded the work limit. Reduce cutoff or polynomial degree.')
        if progress:
            progress(f'Affine transport - {stage}%')
        w,wx,wy = metric.sample(r*ca,r*sa)
        q = polynomial.evaluate(r*(ca+1j*sa))
        bx,by = connection_matrices(q,w,wx,wy)
        b = ca[:,None,None]*bx+sa[:,None,None]*by
        e = state.reshape(count,3,3)
        derivative = e@b
        return (derivative-derivative[:,0,0,None,None]*e).ravel()

    initial = np.broadcast_to(np.eye(3),(count,3,3)).copy()
    solution = solve_ivp(ode,(0,settings.cutoff),initial.ravel(),method='DOP853',
        t_eval=checkpoints,rtol=settings.relative_tolerance,
        atol=settings.relative_tolerance*.03,max_step=.12)
    if not solution.success:
        raise RuntimeError('Affine transport failed: '+solution.message)
    frames = solution.y.T.reshape(-1,count,3,3)
    f = frames[..., :,0]
    if not np.all(np.isfinite(f)) or np.any(f[...,0] <= 0):
        raise RuntimeError('The projective chart failed; refine the metric and transport.')
    points = f[...,1:]/f[...,:1]
    vertices = points[-1,settings.ray_count:]
    previous_index = max(1,int(.8*(len(checkpoints)-1)))
    old_vertices = points[previous_index,settings.ray_count:]
    diameter = max(float(np.max(np.linalg.norm(vertices,axis=1))),1e-10)
    change = float(np.max(np.linalg.norm(vertices-old_vertices,axis=1))/diameter)
    warnings = []
    root_extent = max((abs(z) for z in polynomial.roots),default=0)
    if settings.cutoff < root_extent+1:
        warnings.append('Cutoff is close to the roots: increase it before interpreting sector vertices.')
    if change > .005:
        warnings.append('Vertex estimates are still moving with radius; increase the cutoff.')
    conditions = np.linalg.cond(frames[-1])
    if np.max(conditions) > 1e12:
        warnings.append('Full frames are ill-conditioned; only forward projective samples are used.')
    return {'angles':uniform.tolist(), 'radii':checkpoints.tolist(),
        'points':points[:,:settings.ray_count].tolist(), 'sector_angles':sectors.tolist(),
        'sector_points':points[:,settings.ray_count:].tolist(), 'vertices':vertices.tolist(),
        'diagnostics':{'seconds':perf_counter()-started, 'function_evaluations':solution.nfev,
            'vertex_relative_change':change, 'comparison_radius':float(checkpoints[previous_index]),
            'cutoff':settings.cutoff,
            'maximum_log10_frame_condition':float(np.log10(min(float(np.max(conditions)),1e300))),
            'warnings':warnings, 'chart':'E(0)=I; (f_1/f_0,f_2/f_0)',
            'vertex_method':'d+3 asymptotic sector-centre rays at finite cutoff'}}
