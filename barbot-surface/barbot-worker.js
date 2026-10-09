/* Run the compact-surface numerical code in the visitor's browser. */
'use strict';

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
const MODULES = [
  '__init__.py', 'bundle.py', 'family.py', 'family_coordinates.py',
  'family_operators.py', 'family_solver.py', 'family_transport.py',
  'graded_mesh.py', 'holonomy.py', 'limit_sampling.py', 'marked_loops.py',
  'mesh.py', 'metric.py', 'real_connection.py', 'surface.py'
];

let pyodide;
let ready;
let currentJobId;

async function initialize(id) {
  if (ready) return ready;
  ready = (async () => {
    postMessage({type: 'progress', id, message: 'Downloading Python runtime…'});
    importScripts(`${PYODIDE_CDN}pyodide.js`);
    pyodide = await loadPyodide({indexURL: PYODIDE_CDN});
    postMessage({type: 'progress', id, message: 'Loading NumPy and SciPy…'});
    await pyodide.loadPackage(['numpy', 'scipy']);
    pyodide.FS.mkdirTree('/home/pyodide/compact_barbot');
    for (const name of MODULES) {
      const response = await fetch(`compact_barbot/${name}`);
      if (!response.ok) throw Error(`Missing Python module: ${name}`);
      pyodide.FS.writeFile(`/home/pyodide/compact_barbot/${name}`, await response.text());
    }
    const reference = await fetch('reference-holonomy.json');
    if (!reference.ok) throw Error('Missing saved reference holonomy');
    pyodide.globals.set('reference_holonomy', pyodide.toPy(await reference.json()));
    pyodide.registerJsModule('browser_progress', {
      progress: message => postMessage({type: 'progress', id: currentJobId, message})
    });
    await pyodide.runPythonAsync(`
import sys
from time import perf_counter
sys.path.insert(0, '/home/pyodide')
from compact_barbot.family import SPINS, normalize
from compact_barbot.family_transport import compute
from compact_barbot.limit_sampling import sample
import browser_progress

active_id = 'saved-reference'
active_settings = normalize({'level': 7})
active_holonomy = reference_holonomy

def browser_info():
    return dict(id=active_id, settings=active_settings, spins=SPINS,
        relation_error=active_holonomy['surface_relation_error'],
        metrics=active_holonomy.get('metrics'), surface='y² = ∏(x − aᵢ)',
        spin=next(s['label'] for s in SPINS if s['id'] == active_settings['spin']))

def browser_sample(payload):
    if payload.get('representation_id', active_id) != active_id:
        raise ValueError('Representation changed. Reload its information and sample again.')
    started = perf_counter()
    args = {key: payload[key] for key in ('mode', 'count', 'length', 'seed') if key in payload}
    result = sample(active_holonomy, **args)
    result['diagnostics']['seconds'] = perf_counter() - started
    result['representation_id'] = active_id
    result['settings'] = active_settings
    return result

def browser_compute(payload):
    settings = normalize(payload)
    holonomy = compute(settings, lambda: None, browser_progress.progress)
    return dict(settings=settings, holonomy=holonomy)

def browser_activate(identifier, payload):
    global active_id, active_settings, active_holonomy
    active_id = identifier
    active_settings = payload['settings']
    active_holonomy = payload['holonomy']

def browser_holonomy():
    return dict(id=active_id, settings=active_settings, holonomy=active_holonomy)
`);
  })();
  try { return await ready; }
  catch (error) { ready = undefined; throw error; }
}

async function callPython(expression, payload) {
  let input;
  if (payload !== undefined) {
    input = pyodide.toPy(payload);
    pyodide.globals.set('browser_payload', input);
  }
  try {
    const proxy = await pyodide.runPythonAsync(expression);
    const result = proxy && typeof proxy.toJs === 'function'
      ? proxy.toJs({dict_converter: Object.fromEntries}) : proxy;
    if (proxy && typeof proxy.destroy === 'function') proxy.destroy();
    return result;
  } finally {
    if (input) { pyodide.globals.delete('browser_payload'); input.destroy(); }
  }
}

async function handleMessage({data}) {
  const {id, type, payload} = data;
  try {
    await initialize(id);
    if (type === 'activate') {
      pyodide.globals.set('browser_identifier', id);
      await callPython('browser_activate(browser_identifier, browser_payload)', payload);
      return;
    }
    currentJobId = id;
    const expression = {
      info: 'browser_info()',
      sample: 'browser_sample(browser_payload)',
      recompute: 'browser_compute(browser_payload)',
      holonomy: 'browser_holonomy()'
    }[type];
    if (!expression) throw Error(`Unknown request: ${type}`);
    postMessage({type: 'ready', id});
    postMessage({type: 'result', id, result: await callPython(expression, payload)});
  } catch (error) {
    postMessage({type: 'error', id, message: String(error.message || error)});
  }
}
// Serialize Python calls, including activation, while the UI remains responsive.
let queue = Promise.resolve();
self.onmessage = event => { queue = queue.then(() => handleMessage(event)); };
