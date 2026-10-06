"""Full two-sheet metric solve; even spin data generally break deck symmetry."""
import numpy as np
from scipy.sparse import diags
from scipy.sparse.linalg import spsolve
from .family_operators import assemble_conformal
from .family_coordinates import mesh_coordinates


def solve(mesh,family,check=lambda:None):
    op=assemble_conformal(mesh,family,check);x,y=mesh_coordinates(mesh,family)
    # Put branch values exactly at their known algebraic positions.
    for base,i in [(0,0),(2,1),(3,2),(4,3),(5,4)]:
        x[mesh.base_vertex==base]=family.roots[i]
    n=family.norm(x,y);L,m,b=op.stiffness,op.mass,op.curvature_load
    u=np.full(len(m),.5*np.log(np.pi/m.sum()));history=[]
    for scale in np.linspace(0,1,5):
        norm=scale**2*n
        def energy(v):
            with np.errstate(over='ignore'):return .5*v@(L@v)+b@v+2*m@np.exp(2*v)+4*(m*norm)@np.exp(-v)
        for iteration in range(60):
            check();positive=4*m*np.exp(2*u);negative=4*m*norm*np.exp(-u)
            residual=L@u+b+positive-negative;error=float(np.max(abs(residual)/(m+abs(b)+positive+negative)))
            if error<1e-9:break
            step=spsolve(L+diags(2*positive+negative),-residual);alpha=1.;before=energy(u);slope=residual@step
            while energy(u+alpha*step)>before+1e-4*alpha*slope:
                candidate=u+alpha*step
                candidate_residual=L@candidate+b+4*m*np.exp(2*candidate)-4*m*norm*np.exp(-candidate)
                # Near convergence the energy change is below floating-point
                # resolution; a strict residual decrease is an independent
                # acceptance criterion for the Newton step.
                if np.linalg.norm(candidate_residual)<(1-.1*alpha)*np.linalg.norm(residual):break
                alpha*=.5
                if alpha<2**-25:raise ArithmeticError('Metric line search failed')
            u+=alpha*step
        else:raise ArithmeticError(f'Metric did not converge (relative residual {error:.3g})')
        history.append(dict(scale=float(scale),residual=error,iterations=iteration))
    curvature=-4+4*n*np.exp(-3*u)
    return u,x,y,dict(residual=error,area=float(m@np.exp(2*u)),vertices=len(u),
        curvature_range=[float(curvature.min()),float(curvature.max())],continuation=history)
