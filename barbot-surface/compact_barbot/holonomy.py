"""Step 8: numerical inverse transport and marked SL(3,R) holonomies."""
import numpy as np
from scipy.integrate import solve_ivp
from .surface import ordinary,polynomial
from .real_connection import connection
from .marked_loops import BASEPOINT,meridians,segment,marking


def transport_branch_bridge(field,loop,A,B,tolerance=2e-8):
    """Meridian represented by a smooth path through its branch point.

    Two half-paths share the actual branch fibre. Reusing each half-path's
    inverse is exact path reversal, not a correction to the surface relation.
    """
    from .surface import BRANCH_POINTS,ChartValue
    a=loop['branch'];z0=np.sqrt(complex(loop['basepoint']-a))
    def Rvalue(z):
        value=np.sqrt(complex(5*a**4-1))
        for b in BRANCH_POINTS:
            if b!=a:
                value*=np.sqrt(1+z*z/(a-b))
        return value
    expected=np.sqrt(complex(polynomial(loop['basepoint'])))
    if abs(z0*Rvalue(z0)-expected)>abs(z0*Rvalue(z0)+expected):
        z0=-z0
    halves=[]
    for sign in [1,-1]:
        def ode(r,state):
            z=sign*z0*r;Rz=Rvalue(z)
            chart=ChartValue(a+z*z,z*Rz,2*z,2/Rz,1)
            u,ux,uy=field.sample_branch(a,z)
            gamma=connection(chart,u,ux,uy,sign*z0,A,B)
            return (state.reshape(3,3)@gamma).ravel()
        sol=solve_ivp(ode,(1,0),np.eye(3).ravel(),method='DOP853',rtol=tolerance,atol=tolerance*.03,max_step=.025)
        if not sol.success:
            raise ArithmeticError(sol.message)
        halves.append(sol.y[:,-1].reshape(3,3))
    forward=halves[0]@np.linalg.inv(halves[1])
    backward=halves[1]@np.linalg.inv(halves[0])
    return forward,backward


def transport_meridian(field,loop,A,B,sheet=1,tolerance=2e-8,max_step=.04):
    y=sheet*np.sqrt(complex(polynomial(loop['basepoint'])))
    state=np.r_[np.eye(3).ravel(),y.real,y.imag]
    evaluations=0
    for part in range(3):
        def ode(s,state):
            x,v=segment(loop,part,s); yy=complex(state[9],state[10])
            u,ux,uy=field.sample(x)
            # Small y integration error is monitored separately, not hidden by ordinary().
            from .surface import ChartValue
            chart=ChartValue(x,yy,1,1/yy,1)
            gamma=connection(chart,u,ux,uy,v,A,B)
            dy=(5*x**4-1)*v/(2*yy)
            return np.r_[(state[:9].reshape(3,3)@gamma).ravel(),dy.real,dy.imag]
        solution=solve_ivp(ode,(0,1),state,method='DOP853',rtol=tolerance,atol=tolerance*.03,max_step=max_step)
        if not solution.success:
            raise ArithmeticError(solution.message)
        state=solution.y[:,-1]; evaluations+=solution.nfev
    T=state[:9].reshape(3,3)
    return T,dict(sheet_closure_error=float(abs(complex(state[9],state[10])+y)/abs(y)),
                  determinant=float(np.linalg.det(T)),condition_number=float(np.linalg.cond(T)),evaluations=evaluations)


def product(word,generators):
    M=np.eye(3)
    for letter in word:
        G=generators[abs(letter)-1]
        M=M@(G if letter>0 else np.linalg.inv(G))
    return M


def commutator(A,B):
    return A@B@np.linalg.inv(A)@np.linalg.inv(B)


def compute_holonomy(field,A=.2,B=0,tolerance=2e-8,max_step=.04):
    loops=meridians(); plus=[]; minus=[]; diagnostics=[]
    for loop in loops:
        P,M=transport_branch_bridge(field,loop,A,B,tolerance)
        circle,dp=transport_meridian(field,loop,A,B,1,tolerance,max_step)
        reverse,dm=transport_meridian(field,loop,A,B,-1,tolerance,max_step)
        plus.append(P); minus.append(M)
        diagnostics.append(dict(branch=[loop['branch'].real,loop['branch'].imag],plus=dp,minus=dm,
            contractible_double_meridian_error=float(np.linalg.norm(circle@reverse-np.eye(3),'fro')),
            circle_vs_bridge_error=float(np.linalg.norm(circle-P,'fro'))))
    # All four closed paths start and finish in the plus base fibre.
    c=[plus[i]@minus[4] for i in range(4)]
    matrices={name:product(word,c) for name,word in marking().items()}
    relation=commutator(matrices['a1'],matrices['b1'])@commutator(matrices['a2'],matrices['b2'])
    return dict(basepoint=[BASEPOINT.real,BASEPOINT.imag],base_sheet='principal sqrt(P(basepoint))',
        convention='Inverse parallel transport T prime = T Gamma; path words multiply in traversal order',
        marking=marking(),marking_letters='c_i = lift(r_i r_5), i=1..4; meridians in angular order',
        meridians=diagnostics,generators={k:v.tolist() for k,v in matrices.items()},
        auxiliary_generators=[g.tolist() for g in c],
        surface_relation_matrix=relation.tolist(),
        surface_relation_error=float(np.linalg.norm(relation-np.eye(3),'fro')),
        determinant_errors={k:float(abs(np.linalg.det(v)-1)) for k,v in matrices.items()},
        eigenvalues={k:[[float(z.real),float(z.imag)] for z in np.linalg.eigvals(v)] for k,v in matrices.items()},
        caveat='Raw numerical matrices, not projected or adjusted to satisfy the relation; mesh/interpolation errors remain.')


def small_loop(field,x,A,B,radius=.025,tolerance=2e-9):
    loop=dict(branch=x,basepoint=x+radius,start=x+radius,radius=radius,theta=0.)
    T,diagnostic=transport_meridian(field,loop,A,B,tolerance=tolerance)
    # Unlike a branch meridian, this circle is contractible and returns to its own sheet.
    return dict(radius=radius,error=float(np.linalg.norm(T-np.eye(3),'fro')),
                matrix=T.tolist())
