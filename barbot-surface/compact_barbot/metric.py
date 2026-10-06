"""Mass-lumped conformal FEM for the compact t=0 equation.

g=exp(2u)g0, K(g)=-4, hence -Delta_0 u+K0+4 exp(2u)=0.
Reference curvature loads use exact spherical face areas; they are not
polyhedral angle defects. Curvature residuals are weak discrete residuals.
"""
from dataclasses import dataclass
import numpy as np
from scipy.sparse import coo_matrix, diags
from scipy.sparse.linalg import spsolve
from .mesh import edge, reference_edge_lengths, spherical_areas


@dataclass
class Operators:
    stiffness: object
    mass: np.ndarray
    curvature_load: np.ndarray
    face_area: np.ndarray
    min_angle: float


def assemble(mesh, quadrature=32):
    lengths=reference_edge_lengths(mesh,quadrature)
    f=mesh.faces; base=mesh.base_vertex[f]
    # Opposite edge lengths, in vertex order.
    sides=np.array([[lengths[edge(t[1],t[2])],lengths[edge(t[2],t[0])],lengths[edge(t[0],t[1])]] for t in base])
    s=sides.sum(axis=1)/2
    area2=s*np.prod(s[:,None]-sides,axis=1)
    if np.any(area2<=0):
        raise ArithmeticError('Reference edge lengths violate a triangle inequality; refine mesh')
    area=np.sqrt(area2)
    cosines=(np.roll(sides,1,axis=1)**2+np.roll(sides,-1,axis=1)**2-sides**2)/(2*np.roll(sides,1,axis=1)*np.roll(sides,-1,axis=1))
    angles=np.arccos(np.clip(cosines,-1,1))
    cot=(np.roll(sides,1,axis=1)**2+np.roll(sides,-1,axis=1)**2-sides**2)/(4*area[:,None])
    n=len(mesh.base_vertex); rows=[]; cols=[]; values=[]
    for k in range(3):
        a=f[:,(k+1)%3]; b=f[:,(k+2)%3]; weight=cot[:,k]/2
        for i,j,v in [(a,a,weight),(b,b,weight),(a,b,-weight),(b,a,-weight)]:
            rows.extend(i); cols.extend(j); values.extend(v)
    L=coo_matrix((values,(rows,cols)),shape=(n,n)).tocsr()
    mass=np.bincount(f.ravel(),weights=np.repeat(area/3,3),minlength=n)
    # K0 dA0 = -1/2 dA_round on each sheet. Total is -4*pi.
    sphere_area=np.tile(spherical_areas(mesh),2)
    curvature=np.bincount(f.ravel(),weights=np.repeat(-sphere_area/6,3),minlength=n)
    return Operators(L,mass,curvature,area,float(np.min(angles)))


def solve_reference(mesh, tolerance=1e-10, quadrature=32):
    op=assemble(mesh,quadrature)
    L,m,b=op.stiffness,op.mass,op.curvature_load
    u=np.full(len(m),.5*np.log(np.pi/m.sum()))
    def energy(v):
        return .5*v@(L@v)+b@v+2*np.dot(m,np.exp(2*v))
    for iteration in range(50):
        exponential=np.exp(2*u)
        residual=L@u+b+4*m*exponential
        relative=float(np.max(np.abs(residual)/(m+np.abs(b)+4*m*exponential)))
        if relative<tolerance:
            break
        step=spsolve(L+diags(8*m*exponential),-residual)
        alpha=1.; initial=energy(u); slope=residual@step
        while energy(u+alpha*step)>initial+1e-4*alpha*slope:
            alpha*=.5
            if alpha<2**-24:
                raise ArithmeticError('Newton line search failed')
        u+=alpha*step
    else:
        raise ArithmeticError('Reference metric did not converge')
    area=float(np.dot(m,np.exp(2*u)))
    weak_curvature=(b+L@u)/(m*np.exp(2*u))
    diagnostics=dict(mesh=mesh.topology(),newton_iterations=iteration,
        relative_equation_residual=relative,reference_area=float(m.sum()),
        metric_area=area,expected_metric_area=float(np.pi),
        gauss_bonnet_integral=float(b.sum()),
        weak_curvature_max_error=float(np.max(np.abs(weak_curvature+4))),
        u_min=float(u.min()),u_max=float(u.max()),
        minimum_triangle_angle_degrees=float(np.degrees(op.min_angle)),
        discretization='Mass-lumped FEM; reference edge-length triangles; exact integrated reference curvature',
        warning='Weak curvature and area checks are consequences of the discrete equation, not independent error estimates.')
    return u,op,diagnostics
