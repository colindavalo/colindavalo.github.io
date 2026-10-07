# Publication illustrations

`pictures/hitchin-proj-labels.png` is the author's supplied image
`hitchin_proj_labels.png`, copied without modification. It illustrates
*Projective Structures with (Quasi-)Hitchin Holonomy* on both publication pages.

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
