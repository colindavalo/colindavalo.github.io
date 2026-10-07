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
(`barbot-figure-1.webp`) alongside that screenshot. Both original assets are
preserved. Clicking either new publication illustration opens its full image.

Rebuild the composition with Node, Playwright and Edge available:

```powershell
node scripts/compose_barbot_sphere.cjs
```

The visualization project's `figures/` folder retains the browser-capture
script, compressed sample data and full numerical provenance. No publication
abstracts were changed.
