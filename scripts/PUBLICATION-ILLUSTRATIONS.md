# Publication illustrations

`pictures/hitchin-proj-labels.png` is the author's supplied image
`hitchin_proj_labels.png`, copied without modification (kept, no longer linked).
`pictures/hitchin-proj-labels-uniform.png` illustrates *Projective Structures
with (Quasi-)Hitchin Holonomy* on both publication pages: the same image with
the blue-violet gradient of the surface S replaced by a single blue (hue 212°),
shading kept; every pixel outside the surface is unchanged. Rebuild it from the
site root with NumPy, Pillow and matplotlib:

```sh
python3 scripts/recolor_hitchin_surface.py pictures/hitchin-proj-labels.png pictures/hitchin-proj-labels-uniform.png 212 0.78
```

The publication pages now use `pictures/hitchin-proj-labels-uniform-2.png`:
the same image without the isolated pink segment (and its small circle) next
to ξ, which matched no circle on the surface. Only pixels in that area change;
the brown curve ξ and its point are protected. Rebuild it after the step above:

```sh
python3 scripts/remove_hitchin_extra_line.py pictures/hitchin-proj-labels-uniform.png pictures/hitchin-proj-labels-uniform-2.png
```

`pictures/barbot-limit-sphere.jpg` is a capture of Visualize Higgs's compact
Barbot explorer on y² = x⁵ − x, spin O(p∞), A = 0.2, B = 0, saved level-7
holonomies. It shows both antipodal lifts of 100,000 numerically sampled
projective points (adaptive orbit, conjugator length 12, seed 7), viewed with
yaw 35°, pitch 20°. The relation residual is 8.0664e-4; the finite numerical
cloud is not a certified limit curve.

`pictures/barbot-figure-and-limit-sphere.jpg` places the original Figure 1
(`barbot-figure-1-complete.png`) alongside that screenshot. The complete
diagram is extracted from page 20 of the original article PDF, with margin
around γ; the old `barbot-figure-1.webp` is preserved. Both panels use pure
white backgrounds, and the sphere caption is “Limit curve in ℝP²”. Clicking either new publication illustration opens its full image.

Rebuild the composition with Node, Playwright and Edge available:

```powershell
node scripts/compose_barbot_sphere.cjs
```

The visualization project's `figures/` folder retains the browser-capture
script, compressed sample data and full numerical provenance. No publication
abstracts were changed.

To reproduce the complete Figure 1 with Poppler, download the article PDF
from https://arxiv.org/pdf/2502.09107 into `scripts/build/barbot-paper.pdf`,
then run from the site root:

```powershell
pdftoppm -f 20 -singlefile -scale-to 5400 -x 1380 -y 780 -W 1440 -H 570 -png scripts/build/barbot-paper.pdf pictures/barbot-figure-1-complete
```

`pictures/g2-slodowy-parker-evans-labeled.png` adds English labels to the
unchanged `pictures/g2-slodowy-parker-evans.png`, in the style of the Einstein
structures figure: the fiber Ein^{2,1}, the bundle M_ρ → S with projection π,
the G′₂ root system and the Frenet frame. Both publication pages use
the labeled version. Rebuild it from the site root with Pillow and matplotlib:

```sh
python3 scripts/label_g2_slodowy.py
```

`pictures/pencils-jordan-curve.png` is the figure "A Jordan curve in CP^1" from
the appendix of *Geometric structures for maximal representations and pencils*,
compiled standalone from its TikZ code (`scripts/jordan-curve-cp1.tex`, copied
from the archived project's `Final/GeometricStructuresCambridge.tex`):

```
cd scripts && pdflatex -output-directory build jordan-curve-cp1.tex
pdftoppm -r 300 -png -singlefile build/jordan-curve-cp1.pdf ../pictures/pencils-jordan-curve
```

It replaces `pictures/pencils-figure-1.webp` on the publication pages; the old
file is preserved.
