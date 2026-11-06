"""Branch-adapted refinement: sphere distance O(h²) gives chart spacing O(h)."""
import numpy as np
from .mesh import build_mesh,Mesh,edge


def refine_once(mesh):
    points=list(mesh.sphere.copy());mids={}
    for f in mesh.base_faces:
        for a,b in zip(f,np.roll(f,-1)):
            key=edge(a,b)
            if key not in mids:
                p=points[a]+points[b];p/=np.linalg.norm(p)
                mids[key]=len(points);points.append(p)
    def triangles(f,lookup):
        a,b,c=f;ab=lookup[edge(a,b)];bc=lookup[edge(b,c)];ca=lookup[edge(c,a)]
        return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]
    base_faces=np.array([t for f in mesh.base_faces for t in triangles(f,mids)])
    lifted_mids={};base=list(mesh.base_vertex)
    for f in mesh.faces:
        for a,b in zip(f,np.roll(f,-1)):
            key=edge(a,b)
            if key not in lifted_mids:
                lifted_mids[key]=len(base);base.append(mids[edge(mesh.base_vertex[a],mesh.base_vertex[b])])
    faces=np.array([t for f in mesh.faces for t in triangles(f,lifted_mids)])
    cuts={e for a,b in mesh.cuts for e in [edge(a,mids[edge(a,b)]),edge(mids[edge(a,b)],b)]}
    return Mesh(np.array(points),base_faces,faces,np.array(base),cuts,mesh.level+1)


def build_graded_mesh(level=5,cap_radius=.6):
    if not isinstance(level,int) or not 2<=level<=7:
        raise ValueError('Graded mesh levels are integers from 2 to 7')
    mesh=build_mesh(min(level,6))
    if level==7:
        mesh=refine_once(mesh)
    points=mesh.sphere.copy()
    for i,p in enumerate(points):
        axis=int(np.argmax(abs(p)));pole=np.zeros(3);pole[axis]=np.sign(p[axis])
        theta=np.arccos(np.clip(p@pole,-1,1))
        if 1e-12<theta<cap_radius:
            t=theta/cap_radius;new_theta=cap_radius*(2*t*t-t*t*t)
            tangent=(p-np.cos(theta)*pole)/np.sin(theta)
            points[i]=np.cos(new_theta)*pole+np.sin(new_theta)*tangent
    return Mesh(points,mesh.base_faces,mesh.faces,mesh.base_vertex,mesh.cuts,mesh.level)
