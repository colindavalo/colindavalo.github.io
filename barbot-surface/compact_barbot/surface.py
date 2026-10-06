"""Explicit charts on y²=x⁵-x and the spin bundle O(p_infinity)."""
from dataclasses import dataclass
import numpy as np

BRANCH_POINTS = (0j, 1+0j, 1j, -1+0j, -1j)


def polynomial(x):
    return x**5-x


@dataclass(frozen=True)
class ChartValue:
    x: complex
    y: complex
    dx: complex
    # e is a nonvanishing spin frame; e²=kappa dz, s=spin_section*e.
    kappa: complex
    spin_section: complex

    def differential(self, A=1, B=0):
        """Coefficient of t in e³, regular also at infinity."""
        if self.spin_section != 1:
            w = self.spin_section
            return A*w**3+B*w
        return A+B*self.x

    def reference_density(self):
        """Coefficient g0 / |dz|², including branch points and infinity."""
        if self.spin_section != 1:
            w = self.spin_section
            return float((1+abs(w)**4)*abs(self.kappa)**2)
        return float((1+abs(self.x)**2)*abs(self.kappa)**2)

    def differential_norm_squared(self, A=1, B=0):
        return float(abs(self.differential(A,B))**2*abs(self.kappa)**3/self.reference_density()**1.5)


def ordinary(x, y=None):
    """Choose y once and continue it on overlaps; never reset its sheet sign."""
    x = complex(x)
    if y is None:
        y = np.sqrt(complex(polynomial(x)))
    if abs(y*y-polynomial(x)) > 1e-10*(1+abs(polynomial(x))):
        raise ValueError('Point does not lie on the surface')
    if abs(y) < 1e-14:
        raise ValueError('Use a branch chart here')
    return ChartValue(x, y, 1, 1/y, 1)


def branch(a, z):
    """x=a+z², y=z R_a(z); valid in |z|<0.45, including z=0."""
    a, z = complex(a), complex(z)
    if a not in BRANCH_POINTS or abs(z) >= .45:
        raise ValueError('Unknown branch point or outside branch chart')
    R = np.sqrt(complex(5*a**4-1))
    for b in BRANCH_POINTS:
        if b != a:
            R *= np.sqrt(1+z*z/(a-b))
    return ChartValue(a+z*z, z*R, 2*z, 2/R, 1)


def infinity(w):
    """x=w^-2, y=w^-5 sqrt(1-w^8), e_infinity=s/w."""
    w = complex(w)
    if abs(w) >= .7:
        raise ValueError('Outside infinity chart')
    R = np.sqrt(1-w**8)
    if w == 0:
        return ChartValue(complex(np.inf), complex(np.inf), complex(np.inf), -2, 0)
    return ChartValue(w**-2, R*w**-5, -2*w**-3, -2/R, w)


def branch_coordinate(a, x, y):
    """Inverse branch chart, with sign determined by the actual y coordinate."""
    z=np.sqrt(complex(x-a))
    candidates=[z,-z]
    value=min(candidates,key=lambda v:abs(branch(a,v).y-y))
    if abs(branch(a,value).y-y)>1e-9*(1+abs(y)):
        raise ValueError('Point is not in the branch chart')
    return value


def infinity_coordinate(x, y):
    """Inverse infinity chart; the two signs distinguish the two nearby sheets."""
    if not np.isfinite(x) and not np.isfinite(y):
        return 0j
    w=np.sqrt(complex(1/x))
    value=min([w,-w],key=lambda v:abs(infinity(v).y-y))
    if abs(infinity(value).y-y)>1e-9*(1+abs(y)):
        raise ValueError('Point is not in the infinity chart')
    return value


def spin_transition(source, target):
    """e_target=g e_source on an overlap at the SAME surface point."""
    if source.spin_section == 0 or target.spin_section == 0:
        raise ValueError('The overlap excludes the zero of s')
    if abs(source.x-target.x) > 1e-9*(1+abs(source.x)) or abs(source.y-target.y) > 1e-9*(1+abs(source.y)):
        raise ValueError('Charts must describe the same surface point')
    return source.spin_section/target.spin_section


def reference_curvature(x):
    """Smooth K0, with limiting value zero at all six branch points."""
    if not np.isfinite(x):
        return 0.
    return -2*abs(polynomial(x))/(1+abs(x)**2)**3
