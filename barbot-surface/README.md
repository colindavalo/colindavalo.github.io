# Browser version of the compact Barbot explorer

This is a static port of `Visualisations/En cours/Visualize higgs/compact_barbot/`
for the private visual-project hub. The original explorer's interface, sphere
renderer, numerical Python modules, and saved reference holonomy are copied
here. `browser-bridge.js` replaces the local HTTP API with a Web Worker;
`barbot-worker.js` runs the original Python computations through Pyodide.

The saved genus-two representation loads first. Sampling the group, changing
the surface or spin, and recomputing the harmonic metric and holonomies run in
the visitor's browser. The browser needs an HTTP(S) origin, so a local preview
must use a temporary HTTP server rather than `file://`. On first use, Pyodide
0.29.3, NumPy and SciPy are downloaded from jsDelivr. Parameter choices and
computed results are not submitted to a remote solver.

Opening the page as `file://` displays the HTTP preview instructions instead
of silently failing to load its Web Worker. Cancellation marks a pending
recomputation as discarded; the worker may finish that calculation before it
starts the next one. Fine mesh levels can take substantial time and memory in
a browser. The supplied numerical relation error and finite sampling caveats
remain essential when interpreting the plotted cloud.

On 7 October 2026, the saved representation produced 20,000 projective points
in the in-app browser over local HTTP. A level-4 recomputation activated a
new representation and generated 20,000 points; its surface-relation error
was about 10.8, so that preview is visibly labelled a coarse holonomy
approximation. Higher levels and other spin structures were not checked in
that browser session.
