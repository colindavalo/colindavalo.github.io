"""An explicit genus-two marking from five hyperelliptic branch meridians."""
import numpy as np
from .surface import BRANCH_POINTS

BASEPOINT=.3+.3j


def meridians(radius=.18,basepoint=BASEPOINT):
    """Disjoint straight stems, small counterclockwise circles, and return stems."""
    points=sorted(BRANCH_POINTS,key=lambda a:np.angle(a-basepoint))
    # A cyclic rotation preserves the peripheral order; use the nearest
    # branch meridian as r5 to shorten the closed generators.
    reference=min(points,key=lambda a:abs(a-basepoint))
    cut=points.index(reference)+1
    points=points[cut:]+points[:cut]
    result=[]
    for a in points:
        theta=np.angle(basepoint-a); start=a+radius*np.exp(1j*theta)
        result.append(dict(branch=a,basepoint=basepoint,start=start,radius=radius,theta=theta))
    return result


def segment(loop,part,s):
    if part==0:
        delta=loop['start']-loop['basepoint']
        return loop['basepoint']+s*delta,delta
    if part==1:
        radial=loop['radius']*np.exp(1j*(loop['theta']+2*np.pi*s))
        return loop['branch']+radial,2j*np.pi*radial
    delta=loop['basepoint']-loop['start']
    return loop['start']+s*delta,delta


def inverse(word):
    return [-i for i in word[::-1]]


def reduce_word(word):
    out=[]
    for letter in word:
        if out and out[-1]==-letter:
            out.pop()
        else:
            out.append(letter)
    return out


def marking():
    # r_i flips sheets; c_i=r_i r_5 is a closed lifted path (i=1..4).
    # R=c1 c2^-1 c3 c4^-1 c1^-1 c2 c3^-1 c4 is the surface relator.
    # Set A=c1, B=c2^-1, C=c3, D=c4^-1, so R=ABCD A^-1 B^-1 C^-1 D^-1.
    # a1=D^-1 C^-1 A, b1=BCD, a2=C^-1, b2=D^-1.
    # Use the fixed cyclic rotation starting at c3^-1. It gives shorter
    # generators in the chosen base fibre than the unrotated extraction.
    return {'a1':[2,-1,-3],'b1':[4,1,-2],'a2':[-1],'b2':[2]}
