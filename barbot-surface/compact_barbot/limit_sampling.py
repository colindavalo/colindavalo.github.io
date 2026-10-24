"""Bounded attracting-eigenline sampling; no surface ODE integration."""
import itertools
from collections import deque
import numpy as np

NAMES=('a1','b1','a2','b2')


def attracting(matrix,gap=1.00001):
    values,vectors=np.linalg.eig(matrix)
    order=np.argsort(abs(values))[::-1];first,second=order[:2]
    if abs(values[first])<=gap*abs(values[second]) or abs(values[first].imag)>1e-8*max(1,abs(values[first])):
        return None
    v=vectors[:,first]
    if np.max(abs(v.imag))>1e-7:
        return None
    v=v.real;v/=np.linalg.norm(v)
    residual=np.linalg.norm(matrix@v-values[first].real*v)/max(np.linalg.norm(matrix),1e-30)
    if not np.isfinite(residual) or residual>1e-8:
        return None
    return v


def alphabet(data):
    matrices=[np.asarray(data['generators'][name],dtype=float) for name in NAMES]
    if any(m.shape!=(3,3) or not np.all(np.isfinite(m)) for m in matrices):
        raise ValueError('Expected four finite 3 by 3 generator matrices')
    return matrices+[np.linalg.inv(m) for m in matrices]


def inverse_letter(i):
    return (i+4)%8


def sample(data,count=20000,length=12,seed=7,mode='conjugates'):
    if type(count)!=int or not 100<=count<=100000:
        raise ValueError('Point budget must be 100–100000')
    if type(length)!=int or not 1<=length<=24:
        raise ValueError('Word length must be 1–24')
    if mode not in ('orbit','conjugates','words'):
        raise ValueError('Unknown sampling mode')
    rng=np.random.default_rng(seed);generators=alphabet(data)
    # Scalar normalization preserves eigenlines and avoids exponential overflow.
    generators=[m/np.linalg.norm(m) for m in generators]
    seeds=[];points=[];rejected=0
    # All cyclically reduced words through length three, bounded independently
    # of the random budget. This also provides less clustered orbit seeds.
    for depth in range(1,min(length,3)+1):
        for word in itertools.product(range(8),repeat=depth):
            if any(b==inverse_letter(a) for a,b in zip(word,word[1:])):
                continue
            if depth>1 and word[-1]==inverse_letter(word[0]):
                continue
            M=np.eye(3)
            for letter in word:
                M=M@generators[letter];M/=np.linalg.norm(M)
            v=attracting(M)
            if v is not None:
                seeds.append(v)
            else:
                rejected+=1
    if not seeds:
        raise ValueError('No simple real attracting eigenlines were found')
    initial=len(seeds)
    if mode=='orbit':
        # Explore the orbit with projective-cell pruning, rather than spending
        # most of a random walk's samples in already dense attracting clusters.
        cells=set();queue=deque();cell_size=6/count
        def accept(v,depth):
            v=v.copy();v*=np.sign(v[np.argmax(abs(v))])
            key=tuple(np.rint(v/cell_size).astype(np.int64))
            if key in cells:return
            cells.add(key);points.append(v)
            if depth<length:queue.append((v,depth))
        for i in rng.permutation(initial):
            accept(seeds[i],0)
            if len(points)>=count:break
        attempts=0
        while queue and len(points)<count and attempts<count*8:
            v,depth=queue.popleft()
            for letter in rng.permutation(8):
                candidate=generators[letter]@v;norm=np.linalg.norm(candidate);attempts+=1
                if np.isfinite(norm) and norm>1e-15:accept(candidate/norm,depth+1)
                else:rejected+=1
                if len(points)>=count:break
        return dict(points=np.array(points).tolist(),diagnostics=dict(requested=count,unique=len(points),
            seed_eigenlines=initial,rejected=rejected,random_attempts=attempts,mode=mode,length=length,seed=seed,
            maximum_represented_word_length=2*length+3,projective_cell_size=cell_size,
            surface_relation_error=data.get('surface_relation_error'),
            caveat='Bounded orbit exploration with projective-cell pruning; approximate holonomies and finite resolution.'))
    points.extend(seeds[:count])
    attempts=0
    while len(points)<count and attempts<count*2:
        attempts+=1;n=int(rng.integers(1,length+1));last=-1
        if mode=='conjugates':
            v=seeds[int(rng.integers(initial))].copy()
            # g v is exactly the attracting line of g M g^-1 in exact
            # arithmetic. Never form that ill-conditioned conjugate matrix.
            for _ in range(n):
                letter=int(rng.integers(8))
                while last>=0 and letter==inverse_letter(last):
                    letter=int(rng.integers(8))
                v=generators[letter]@v
                norm=np.linalg.norm(v)
                if not np.isfinite(norm) or norm<1e-15:
                    v=None;break
                v/=norm;last=letter
        else:
            M=np.eye(3)
            for _ in range(n):
                letter=int(rng.integers(8))
                while last>=0 and letter==inverse_letter(last):
                    letter=int(rng.integers(8))
                M=M@generators[letter];M/=np.linalg.norm(M);last=letter
            v=attracting(M)
        if v is None:
            rejected+=1
        else:
            points.append(v)
    points=np.array(points)
    # Stable projective sign and numerical deduplication (not angular filtering).
    dominant=np.argmax(abs(points),axis=1)
    points*=np.sign(points[np.arange(len(points)),dominant])[:,None]
    _,indices=np.unique(np.round(points,10),axis=0,return_index=True)
    points=points[np.sort(indices)]
    return dict(points=points.tolist(),diagnostics=dict(requested=count,unique=len(points),
        seed_eigenlines=initial,rejected=rejected,random_attempts=attempts,mode=mode,length=length,seed=seed,
        maximum_represented_word_length=2*length+3 if mode=='conjugates' else length,
        surface_relation_error=data.get('surface_relation_error'),
        caveat='Uses approximate holonomy matrices. Sampling is bounded and nonuniform; finite clouds do not certify a limit curve.'))
