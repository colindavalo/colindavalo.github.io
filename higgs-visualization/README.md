# Browser version of Visualize Higgs bundles

This directory is a static copy of the polynomial laboratory in
`Visualisations/En cours/Visualize higgs/`. It includes the original frontend,
the Python modules needed by the Dumas–Wolf and Barbot pipelines, and the
project's Pyodide worker bridge. The numerical Python code runs inside a Web
Worker in the visitor's browser; the site has no Python server or remote API.

To preview locally, serve the parent site directory over HTTP and open
`/picturesSecret.html`. For example, from `Meta/Site personnel`:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Opening the files directly with `file://` cannot start the Web Worker or fetch
the Python modules. The first HTTP visit downloads Pyodide 0.29.3, NumPy and
SciPy from jsDelivr; later visits can use the browser cache. The static app
does not send the user's polynomial or computed results to a server.

The original finite-domain and finite-cutoff numerical limitations still
apply. The Barbot projective segments are a visualization heuristic, not a
certified limiting curve. The copied modules should be updated together with
the source project when its numerical code changes.
