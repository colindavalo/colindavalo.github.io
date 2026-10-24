"""Conformal FEM on the round sphere with branch-regularized quadrature.

The unknown u is deck-invariant for this slice. Its weak Dirichlet energy
can be assembled on the sphere without approximating g0 by edge lengths.
Only the reference area weight is singular at branch values; Duffy
quadrature cancels that integrable 1/r singularity at each branch vertex.
"""
import numpy as np
from scipy.sparse import coo_matrix
from .metric import Operators
from .mesh import spherical_areas


def assemble_conformal(mesh,family,check=lambda:None,order=10):
    faces=mesh.base_faces.copy()
    # Put any branch vertex at the Duffy origin (at most one after refinement).
    for i,f in enumerate(faces):
        branch=np.flatnonzero(f<6)
        if len(branch):
            faces[i]=np.roll(f,-int(branch[0]))
    p=mesh.sphere[faces]; a,b,c=p[:,0],p[:,1],p[:,2]
    nodes,weights=np.polynomial.legendre.leggauss(order)
    nodes=(nodes+1)/2;weights=weights/2
    Llocal=np.zeros((len(faces),3,3)); masses=np.zeros((len(faces),3)); sphere_mass=np.zeros_like(masses)
    for r,wr in zip(nodes,weights):
        check()
        for s,ws in zip(nodes,weights):
            phi=np.array([1-r,r*(1-s),r*s])
            v=(1-r)*a+r*((1-s)*b+s*c); norm=np.linalg.norm(v,axis=1)
            n=v/norm[:,None]
            vr=-a+(1-s)*b+s*c;vs=r*(c-b)
            pr=(vr-n*np.sum(n*vr,axis=1)[:,None])/norm[:,None]
            ps=(vs-n*np.sum(n*vs,axis=1)[:,None])/norm[:,None]
            E=np.sum(pr*pr,axis=1);F=np.sum(pr*ps,axis=1);G=np.sum(ps*ps,axis=1)
            determinant=E*G-F*F; area=np.sqrt(determinant)*wr*ws
            gradient=np.array([[-1,0],[1-s,-r],[s,r]])
            inverse=np.stack([G,-F,-F,E],axis=1).reshape(-1,2,2)/determinant[:,None,None]
            Llocal+=np.einsum('ia,nab,jb,n->nij',gradient,inverse,gradient,area)
            xy=n[:,0]+1j*n[:,1]
            denominator=np.where(n[:,2]>0,np.abs(xy)**2/(1+n[:,2]),1-n[:,2])
            x=xy/denominator
            rho2=(1+abs(x)**2)**3/(4*abs(family.polynomial(x)))
            masses+=area[:,None]*rho2[:,None]*phi
            sphere_mass+=area[:,None]*phi
    # Exact integrated curvature, preserving the quadrature's load distribution.
    exact=spherical_areas(mesh)
    sphere_mass*= (exact/sphere_mass.sum(axis=1))[:,None]
    # Restore each local matrix's ordering to the existing lifted face order.
    permutations=np.array([[list(f).index(v) for v in original] for f,original in zip(faces,mesh.base_faces)])
    idx=np.arange(len(faces))[:,None]
    masses=masses[idx,permutations];sphere_mass=sphere_mass[idx,permutations]
    Llocal=Llocal[np.arange(len(faces))[:,None,None],permutations[:,:,None],permutations[:,None,:]]
    lifted=mesh.faces;n=len(mesh.base_vertex)
    rows=np.repeat(lifted,3,axis=1).ravel();cols=np.tile(lifted,(1,3)).ravel()
    L=coo_matrix((np.tile(Llocal,(2,1,1)).ravel(),(rows,cols)),shape=(n,n)).tocsr()
    m=np.bincount(lifted.ravel(),weights=np.tile(masses,(2,1)).ravel(),minlength=n)
    curvature=np.bincount(lifted.ravel(),weights=-.5*np.tile(sphere_mass,(2,1)).ravel(),minlength=n)
    return Operators(L,m,curvature,np.tile(masses.sum(axis=1),2),float('nan'))
