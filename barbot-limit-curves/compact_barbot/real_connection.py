"""Step 7: real connection in any of the explicit holomorphic spin frames."""
import numpy as np

R=np.array([[1,0,1j],[0,np.sqrt(2),0],[1,0,-1j]],dtype=complex)/np.sqrt(2)


def matrix(tau,beta,omega):
    return np.array([[tau.real,np.sqrt(2)*beta.real,-tau.imag-omega],
                     [np.sqrt(2)*beta.real,0,np.sqrt(2)*beta.imag],
                     [-tau.imag+omega,np.sqrt(2)*beta.imag,-tau.real]])


def connection(chart,u,ux,uy,v,A=0,B=0):
    """u and its derivatives are in the coordinate of chart; v=dz/ds."""
    if chart.spin_section==1:
        x=chart.x; denominator=1+abs(x)**2
        ell=-u-.5*np.log(denominator)
        lx=-ux-(np.conj(x)*chart.dx).real/denominator
        ly=-uy-(np.conj(x)*1j*chart.dx).real/denominator
    else:
        w=chart.spin_section; denominator=1+abs(w)**4
        ell=-u-.5*np.log(denominator)
        lx=-ux-2*abs(w)**2*w.real/denominator
        ly=-uy-2*abs(w)**2*w.imag/denominator
    tau=chart.kappa*v*np.exp(-ell)
    beta=chart.kappa*chart.differential(A,B)*v*np.exp(ell/2)
    omega=(lx*v.imag-ly*v.real)/2
    return matrix(tau,beta,omega)


def real_transition(gamma):
    """F_target=F_source Q. Inverse transport updates as T_target=T_source Q."""
    if abs(gamma)==0:
        raise ValueError('A transition must be invertible')
    phase=gamma/abs(gamma)
    Q=R.conj().T@np.diag([phase,1,phase.conjugate()])@R
    if np.max(abs(Q.imag))>1e-12:
        raise ArithmeticError('Spin transition did not preserve the real form')
    return Q.real
