"""Remplace le dégradé bleu-violet de la surface S de hitchin-proj-labels.png par une teinte unie,
en conservant l'ombrage (valeur HSV) ; cercles, pointillés et points de couleur sont préservés.
Usage (depuis la racine du site) :
  python3 scripts/recolor_hitchin_surface.py pictures/hitchin-proj-labels.png pictures/hitchin-proj-labels-uniform.png 212 0.78"""
import sys, numpy as np
from PIL import Image
from matplotlib.colors import rgb_to_hsv, hsv_to_rgb
src, dst, H0 = sys.argv[1], sys.argv[2], float(sys.argv[3]) / 360
SMAX = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
im = np.asarray(Image.open(src).convert('RGB')).astype(float) / 255
hsv = rgb_to_hsv(im)
Hh, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
x0, x1, y0, y1 = 80, 1215, 815, 1295                       # zone de la surface (pixels de l'original 3400×1680)
zone = np.zeros(S.shape, bool); zone[y0:y1, x0:x1] = True
cand = zone & (S > 0.2) & (V > 0.08)
# teinte locale de la surface : médiane circulaire par bande de colonnes
ang = Hh * 2 * np.pi
loc = np.zeros(S.shape[1])
for x in range(x0, x1):
    m = cand[y0:y1, max(x - 15, 0):x + 15]
    a = ang[y0:y1, max(x - 15, 0):x + 15][m]
    loc[x] = np.arctan2(np.sin(a).mean(), np.cos(a).mean()) if a.size else 0
dev = np.abs(np.angle(np.exp(1j * (ang - loc[None, :]))))
overlay = (S > 0.3) & (dev > np.deg2rad(28))
# tous les pixels non blancs de la zone appartiennent à la surface, sauf les tracés de couleur
surf = zone & ~overlay & ((S > 0.08) | (V < 0.9))
# compensation douce : la teinte sarcelle de gauche était plus sombre que le bleu central
xs = np.arange(S.shape[1])
gain = np.interp(xs, [x0, 650, x1], [1.12, 1.0, 1.04])[None, :]
out = hsv.copy()
out[..., 0] = np.where(surf, H0, Hh)
sgain = np.interp(xs, [x0, 650, 950, x1], [1.0, 1.0, 1.2, 1.3])[None, :]
out[..., 1] = np.where(surf, np.minimum(S * sgain, SMAX), S)
out[..., 2] = np.where(surf, np.clip(V * gain, 0, 1), V)
Image.fromarray((hsv_to_rgb(out) * 255 + 0.5).astype(np.uint8)).save(dst, optimize=True)
