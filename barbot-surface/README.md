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

Cancellation marks a pending recomputation as discarded; the Web Worker may
finish that calculation before it starts the next one. Fine mesh levels can
take substantial time and memory in a browser. The supplied numerical
relation error and finite sampling caveats remain essential when interpreting
the plotted cloud. This port has not yet been exercised in a browser.
