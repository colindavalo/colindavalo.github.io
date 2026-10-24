"""An oriented double cover of a subdivided octahedron, branched at its vertices.

Sheet labels are local cut-domain labels, not signs of a principal sqrt(P(x)).
Across a marked cut, labels flip. Branch vertices have one preimage.
"""
from dataclasses import dataclass
from collections import defaultdict
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components


def edge(a, b):
    return tuple(sorted((int(a), int(b))))


@dataclass
class Mesh:
    sphere: np.ndarray
    base_faces: np.ndarray
    faces: np.ndarray
    base_vertex: np.ndarray
    cuts: set
    level: int

    def topology(self):
        incidences = defaultdict(list)
        for f in self.faces:
            for a, b in zip(f, np.roll(f, -1)):
                incidences[edge(a,b)].append(1 if a < b else -1)
        n = len(self.base_vertex)
        edges = np.array(list(incidences))
        adjacency = coo_matrix((np.ones(len(edges)), (edges[:,0],edges[:,1])), shape=(n,n))
        components = connected_components(adjacency, directed=False, return_labels=False)
        # A vertex link must be one circle, not just an edge-paired pseudomanifold.
        links = defaultdict(list)
        for a,b,c in self.faces:
            links[a].append((b,c)); links[b].append((c,a)); links[c].append((a,b))
        manifold = True
        for pairs in links.values():
            graph = defaultdict(set)
            for a,b in pairs:
                graph[a].add(b); graph[b].add(a)
            seen=set(); stack=[next(iter(graph))]
            while stack:
                v=stack.pop()
                if v not in seen:
                    seen.add(v); stack.extend(graph[v]-seen)
            manifold &= len(seen)==len(graph) and all(len(v)==2 for v in graph.values())
        chi = n-len(edges)+len(self.faces)
        return dict(vertices=n, edges=len(edges), faces=len(self.faces),
                    euler_characteristic=chi, genus=(2-chi)//2,
                    components=int(components), closed=all(len(v)==2 for v in incidences.values()),
                    oriented=all(sum(v)==0 for v in incidences.values()), vertex_links_circles=bool(manifold))


def build_mesh(level=3):
    if not isinstance(level, int) or not 1 <= level <= 6:
        raise ValueError('Refinement level must be an integer from 1 to 6')
    # Stereographic x=(X+iY)/(1-Z): 0, infinity, 1, i, -1, -i.
    points = [np.array(p,dtype=float) for p in [(0,0,-1),(0,0,1),(1,0,0),(0,1,0),(-1,0,0),(0,-1,0)]]
    faces=[]
    for pole in [0,1]:
        for k in range(4):
            f=[pole,2+k,2+(k+1)%4]
            if np.linalg.det(np.array([points[v] for v in f]))<0:
                f[1],f[2]=f[2],f[1]
            faces.append(f)
    cuts={edge(0,2),edge(1,3),edge(4,5)}
    for _ in range(level):
        mids={}
        for f in faces:
            for a,b in zip(f,np.roll(f,-1)):
                e=edge(a,b)
                if e not in mids:
                    p=points[a]+points[b]; p/=np.linalg.norm(p)
                    mids[e]=len(points); points.append(p)
        next_faces=[]
        for a,b,c in faces:
            ab,bc,ca=mids[edge(a,b)],mids[edge(b,c)],mids[edge(c,a)]
            next_faces.extend([[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])
        cuts={part for a,b in cuts for part in (edge(a,mids[edge(a,b)]),edge(mids[edge(a,b)],b))}
        faces=next_faces
    base_faces=np.array(faces,dtype=int)
    # Union face corners across edges. This correctly ramifies endpoint stars.
    nf=len(faces); parent=np.arange(6*nf)
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]]; i=parent[i]
        return int(i)
    def union(a,b):
        parent[find(a)]=find(b)
    adjacent=defaultdict(list)
    for fi,f in enumerate(faces):
        for a,b in zip(f,np.roll(f,-1)):
            adjacent[edge(a,b)].append(fi)
    for e,(f,g) in adjacent.items():
        flip=int(e in cuts)
        for sheet in [0,1]:
            for v in e:
                union((sheet*nf+f)*3+faces[f].index(v),((sheet^flip)*nf+g)*3+faces[g].index(v))
    indices={}; lifted=[]; base=[]
    for sheet in [0,1]:
        for fi,f in enumerate(faces):
            triangle=[]
            for k,v in enumerate(f):
                r=find((sheet*nf+fi)*3+k)
                if r not in indices:
                    indices[r]=len(indices); base.append(v)
                triangle.append(indices[r])
            lifted.append(triangle)
    return Mesh(np.array(points),base_faces,np.array(lifted),np.array(base),cuts,level)


def spherical_areas(mesh):
    a,b,c=mesh.sphere[mesh.base_faces].transpose(1,0,2)
    return 2*np.arctan2(np.abs(np.einsum('ij,ij->i',a,np.cross(b,c))),
                       1+np.sum(a*b+b*c+c*a,axis=1))


def reference_edge_lengths(mesh, order=32):
    """Integrate g0 lengths on spherical great-circle edges.

    Cosine substitution removes the endpoint inverse-square-root singularity
    at branch values. Quadrature points never hit infinity or a branch value.
    """
    edges=sorted({edge(a,b) for f in mesh.base_faces for a,b in zip(f,np.roll(f,-1))})
    pairs=np.array(edges); p=mesh.sphere[pairs[:,0]]; q=mesh.sphere[pairs[:,1]]
    angle=np.arccos(np.clip(np.sum(p*q,axis=1),-1,1))
    nodes,weights=np.polynomial.legendre.leggauss(order)
    u=(nodes+1)/2; weights=weights/2
    t=(1-np.cos(np.pi*u))/2; dt=np.pi/2*np.sin(np.pi*u)
    v=(np.sin((1-t)*angle[:,None])[...,None]*p[:,None,:]+
       np.sin(t*angle[:,None])[...,None]*q[:,None,:])/np.sin(angle)[:,None,None]
    # Stable stereographic evaluation near the north pole.
    xy=v[...,0]+1j*v[...,1]
    denominator=np.where(v[...,2]>0, np.abs(xy)**2/(1+v[...,2]), 1-v[...,2])
    x=xy/denominator; r=np.abs(x)
    log_rho=1.5*np.log1p(r*r)-np.log(2)-.5*np.log(np.abs(x**5-x))
    lengths=angle*np.sum(np.exp(log_rho)*dt*weights,axis=1)
    if not np.all(np.isfinite(lengths)):
        raise ArithmeticError('Non-finite reference edge length')
    return dict(zip(edges,lengths))
