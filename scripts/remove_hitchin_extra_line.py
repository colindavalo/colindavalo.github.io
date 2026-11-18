"""Efface de hitchin-proj-labels-uniform.png le segment rose isolé (avec son petit cercle) près de ξ,
qui ne correspond à aucun cercle de la surface ; la courbe brune ξ et son point sont protégés.
Usage (depuis la racine du site) :
  python3 scripts/remove_hitchin_extra_line.py pictures/hitchin-proj-labels-uniform.png SORTIE.png"""
import sys, numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation
src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(int)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
box = np.zeros(R.shape, bool); box[715:885, 2650:2860] = True
pink = box & (R > 180) & (R - G > 75) & (B > 80) & (B < 200)            # trait et anneau roses
brown = box & (R > 90) & (R < 210) & (G < 120) & (B < 90) & (R - B > 60)  # courbe ξ et son point
disk = lambda r: (lambda y, x: x * x + y * y <= r * r)(*np.ogrid[-r:r + 1, -r:r + 1])
erase = binary_dilation(pink, disk(9)) & ~binary_dilation(brown, disk(8)) & box
bg = np.array([255, 203, 219])                                          # fond rose du plan
yy, xx = np.ogrid[:R.shape[0], :R.shape[1]]
erase |= ((xx - 2750) ** 2 + (yy - 805) ** 2 <= 28 ** 2) & ~binary_dilation(brown, disk(8))   # centre blanc du cercle
# restes anticrénelés du trait rose contre le liseré de la courbe brune
erase |= binary_dilation(pink, disk(12)) & ~binary_dilation(brown, disk(2)) & (R - G > 60) & (G < 195) & box
out = im.copy(); out[erase] = bg
Image.fromarray(out.astype(np.uint8)).save(dst, optimize=True)
print('pixels effacés :', int(erase.sum()), ' roses détectés :', int(pink.sum()))
