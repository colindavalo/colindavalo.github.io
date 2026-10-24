"""Wang equation: five-point differences, asymptotic Dirichlet data, damped Newton.
Array order is [y,x]. Pick convention C=q dz^3; g=exp(w)|dz|^2.
"""
from dataclasses import dataclass
from time import perf_counter
import numpy as np
from scipy.interpolate import RectBivariateSpline
from scipy.sparse import diags, eye, kron
from scipy.sparse.linalg import spsolve
from backend.polynomial import Polynomial

@dataclass(frozen=True)
class MetricSettings:
    radius: float = 6.0
    grid_size: int = 129
    residual_tolerance: float = 1e-8

@dataclass
class MetricSolution:
    axis: np.ndarray
    w: np.ndarray
    q: np.ndarray
    diagnostics: dict
    spline: RectBivariateSpline
    model: str = "dumas-wolf"

    def sample(self, x, y):
        return (self.spline.ev(y,x), self.spline.ev(y,x,dy=1), self.spline.ev(y,x,dx=1))

    def curvature(self):
        if self.model == "barbot":
            return -4+4*np.abs(self.q)**2*np.exp(-1.5*self.w)
        return -1+2*np.abs(self.q)**2*np.exp(-3*self.w)

    def to_json(self):
        curvature = self.curvature()
        return {'axis':self.axis.tolist(), 'w':self.w.tolist(),
                'curvature':curvature.tolist(), 'diagnostics':self.diagnostics}


def solve_metric(polynomial: Polynomial, settings: MetricSettings, progress=None, initial=None, model="dumas-wolf"):
    # Both equations have the form Delta w = A exp(w) - B |p|^2 exp(-c w).
    if model not in ("dumas-wolf", "barbot"):
        raise ValueError("Unknown metric model")
    aa, bb, cc = (8.,8.,.5) if model == "barbot" else (2.,4.,2.)
    started = perf_counter()
    n, radius = settings.grid_size, settings.radius
    if not 33 <= n <= 321 or n % 2 != 1:
        raise ValueError('Grid size must be an odd integer from 33 to 321.')
    extent = max((abs(z) for z in polynomial.roots), default=0)
    if not np.isfinite(radius) or radius < max(2,extent+1) or radius > 20:
        raise ValueError('Domain radius must be 2-20 and at least one beyond every root.')
    axis = np.linspace(-radius,radius,n)
    xx, yy = np.meshgrid(axis,axis)
    q = polynomial.evaluate(xx+1j*yy)
    q2 = np.abs(q)**2
    boundary = np.log(np.maximum(bb/aa*q2,np.finfo(float).tiny))/(1+cc)
    w = np.log(bb/aa*q2+1)/(1+cc)
    if initial is not None:
        w = initial.spline(axis,axis)
    w[0,:], w[-1,:] = boundary[0,:], boundary[-1,:]
    w[:,0], w[:,-1] = boundary[:,0], boundary[:,-1]
    spacing = axis[1]-axis[0]
    m = n-2
    t = diags([-np.ones(m-1),2*np.ones(m),-np.ones(m-1)],[-1,0,1],format='csr')
    lap = (kron(eye(m),t)+kron(t,eye(m))).tocsc()/spacing**2
    rhs = np.zeros((m,m))
    rhs[0,:] += w[0,1:-1]/spacing**2
    rhs[-1,:] += w[-1,1:-1]/spacing**2
    rhs[:,0] += w[1:-1,0]/spacing**2
    rhs[:,-1] += w[1:-1,-1]/spacing**2
    qq, b = q2[1:-1,1:-1].ravel(), rhs.ravel()
    u = w[1:-1,1:-1].ravel().copy()

    def residual(v):
        return lap@v+aa*np.exp(v)-bb*qq*np.exp(-cc*v)-b

    history = []
    if polynomial.degree == 0:
        w[:] = np.log(bb/aa)/(1+cc)
        u[:] = np.log(bb/aa)/(1+cc)
    for iteration in range(35):
        if progress:
            progress(f'Metric - Newton iteration {iteration+1}')
        r = residual(u)
        # Scale by local PDE magnitudes, not a global boundary maximum.
        scale = 1+np.abs(lap@u)+aa*np.exp(u)+bb*qq*np.exp(-cc*u)+np.abs(b)
        norm = float(np.max(np.abs(r)/scale))
        history.append(norm)
        if norm < settings.residual_tolerance:
            break
        jac = lap+diags(aa*np.exp(u)+cc*bb*qq*np.exp(-cc*u),format='csc')
        delta = spsolve(jac,-r)
        old_norm, damping = np.linalg.norm(r), 1.0
        for _ in range(20):
            candidate = u+damping*delta
            with np.errstate(over='ignore',invalid='ignore'):
                candidate_norm = np.linalg.norm(residual(candidate))
            if np.isfinite(candidate_norm) and candidate_norm < old_norm:
                u = candidate
                break
            damping *= .5
        else:
            raise RuntimeError('Newton line search stalled. Try a finer grid or smaller domain.')
    else:
        raise RuntimeError('Metric did not converge within 35 Newton iterations.')
    w[1:-1,1:-1] = u.reshape((m,m))
    if not np.all(np.isfinite(w)):
        raise RuntimeError('Non-finite metric values.')
    curvature = -aa/2+bb/2*q2*np.exp(-(1+cc)*w)
    diagnostics = {'iterations':len(history)-1, 'relative_residual':history[-1],
        'absolute_residual':float(np.max(np.abs(residual(u)))),
        'grid_spacing':float(spacing), 'grid_size':n, 'domain_radius':radius,
        'curvature_min':float(curvature.min()), 'curvature_max':float(curvature.max()),
        'seconds':perf_counter()-started, 'history':history,
        'boundary_condition':('w=4 log|t|/3' if model=='barbot' else 'w=log(2|q|^2)/3')+' on the square boundary',
        'exact_constant':polynomial.degree == 0}
    return MetricSolution(axis,w,q,diagnostics,RectBivariateSpline(axis,axis,w),model)
