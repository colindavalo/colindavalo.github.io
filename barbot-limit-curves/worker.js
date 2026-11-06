/* Runs the compact_barbot Python modules in the visitor's browser (Pyodide).
   Stateless: each request carries the holonomy it needs. Sampling loads NumPy
   only; recomputation also loads SciPy. Cancelling terminates this worker. */
'use strict';

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
const MODULES = [
  '__init__.py', 'bundle.py', 'family.py', 'family_coordinates.py',
  'family_operators.py', 'family_solver.py', 'family_transport.py',
  'graded_mesh.py', 'holonomy.py', 'limit_sampling.py', 'marked_loops.py',
  'mesh.py', 'metric.py', 'real_connection.py', 'surface.py'
];

let pyodide, base, withScipy;
let current = null;
const say = message => postMessage({type: 'progress', id: current, message});

function loadBase() {
  base ??= (async () => {
    say('Downloading the Python runtime (first use only)…');
    importScripts(`${PYODIDE}pyodide.js`);
    pyodide = await loadPyodide({indexURL: PYODIDE});
    say('Loading NumPy…');
    await pyodide.loadPackage('numpy');
    pyodide.FS.mkdirTree('/home/pyodide/compact_barbot');
    await Promise.all(MODULES.map(async name => {
      const response = await fetch(`compact_barbot/${name}`);
      if (!response.ok) throw Error(`Missing Python module ${name}`);
      pyodide.FS.writeFile(`/home/pyodide/compact_barbot/${name}`, await response.text());
    }));
    pyodide.registerJsModule('browser_progress', {progress: say});
    await pyodide.runPythonAsync(`
import sys, json
from time import perf_counter
sys.path.insert(0, '/home/pyodide')
from compact_barbot.limit_sampling import sample

def browser_sample(text):
    request = json.loads(text)
    started = perf_counter()
    result = sample(request['holonomy'], **request['parameters'])
    result['diagnostics']['seconds'] = perf_counter() - started
    return json.dumps(result)
`);
  })();
  return base.catch(error => { base = undefined; throw error; });
}

function loadScipy() {
  withScipy ??= (async () => {
    await loadBase();
    say('Loading SciPy (first recomputation only)…');
    await pyodide.loadPackage('scipy');
    await pyodide.runPythonAsync(`
from compact_barbot.family import normalize
from compact_barbot.family_transport import compute
import browser_progress

def browser_compute(text):
    settings = normalize(json.loads(text))
    started = perf_counter()
    holonomy = compute(settings, lambda: None, browser_progress.progress)
    return json.dumps(dict(settings=settings, holonomy=holonomy, seconds=perf_counter() - started))
`);
  })();
  return withScipy.catch(error => { withScipy = undefined; throw error; });
}

function callPython(name, payload) {
  const f = pyodide.globals.get(name);
  try { return f(JSON.stringify(payload)); } finally { f.destroy(); }
}

async function handle({id, type, payload}) {
  current = id;
  try {
    let text;
    if (type === 'sample') {
      await loadBase();
      say('Sampling attracting eigenlines…');
      text = callPython('browser_sample', payload);
    } else if (type === 'compute') {
      await loadScipy();
      text = callPython('browser_compute', payload);
    } else throw Error(`Unknown request ${type}`);
    postMessage({type: 'result', id, result: JSON.parse(text)});
  } catch (error) {
    const message = String(error.message || error).trim().split('\n').pop();
    postMessage({type: 'error', id, message});
  }
}

let queue = Promise.resolve();
self.onmessage = ({data}) => { queue = queue.then(() => handle(data)); };
