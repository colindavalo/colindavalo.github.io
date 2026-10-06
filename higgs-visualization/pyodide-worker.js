/* Python lives in this Worker, keeping canvas interaction responsive. */
let pyodide;
let ready;
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
const MODULES = [
  'polynomial.py', 'dumas_wolf/__init__.py', 'dumas_wolf/metric.py',
  'dumas_wolf/transport.py', 'dumas_wolf/pipeline.py', 'barbot/__init__.py',
  'barbot/pipeline.py'
];

async function initialise(id) {
  if (ready) return ready;
  ready = (async () => {
    postMessage({type: 'progress', id, message: 'Downloading Python runtime…'});
    importScripts(`${PYODIDE_CDN}pyodide.js`);
    pyodide = await loadPyodide({indexURL: PYODIDE_CDN});
    postMessage({type: 'progress', id, message: 'Loading NumPy and SciPy…'});
    await pyodide.loadPackage(['numpy', 'scipy']);
    pyodide.FS.mkdirTree('/home/pyodide/backend/dumas_wolf');
    pyodide.FS.mkdirTree('/home/pyodide/backend/barbot');
    pyodide.FS.writeFile('/home/pyodide/backend/__init__.py', '');
    for (const name of MODULES) {
      const response = await fetch(`backend/${name}`);
      if (!response.ok) throw Error(`Missing Python module: backend/${name}`);
      pyodide.FS.writeFile(`/home/pyodide/backend/${name}`, await response.text());
    }
    await pyodide.runPythonAsync(`
import sys
sys.path.insert(0, '/home/pyodide')
from backend.polynomial import Polynomial
from backend.dumas_wolf.metric import MetricSettings
from backend.dumas_wolf.transport import TransportSettings
from backend.dumas_wolf.pipeline import solve as solve_dumas_wolf
from backend.barbot.pipeline import solve as solve_barbot
def browser_solve(payload, progress):
    model = payload.get('model', 'dumas-wolf')
    polynomial = Polynomial.from_json(payload)
    raw = payload.get('settings', {})
    radius, grid, rays, cutoff = float(raw.get('radius', 6)), int(raw.get('grid_size', 129)), int(raw.get('ray_count', 120)), float(raw.get('cutoff', 4.5))
    extent = max((abs(z) for z in polynomial.roots), default=0)
    if polynomial.degree > 8: raise ValueError('Use degrees 0-8 in this version.')
    if not max(2, extent + 1) <= radius <= 20: raise ValueError('Domain radius must be 2-20 and at least one beyond every root.')
    if not 33 <= grid <= 321 or grid % 2 != 1 or not 24 <= rays <= 360: raise ValueError('Use an odd grid size 33-321 and 24-360 rays.')
    if not .25 <= cutoff <= radius - 4 * radius / (grid - 1): raise ValueError('Cutoff must be at least 0.25 and two grid cells inside the domain.')
    solver = solve_barbot if model == 'barbot' else solve_dumas_wolf
    result, _ = solver(polynomial, MetricSettings(radius, grid), TransportSettings(rays, cutoff), progress)
    return result
`);
  })();
  return ready;
}

self.onmessage = async ({data}) => {
  if (data.type !== 'solve') return;
  const {id, payload} = data;
  try {
    await initialise(id);
    postMessage({type: 'ready', id});
    const progress = message => postMessage({type: 'progress', id, message});
    pyodide.registerJsModule('browser_progress', {progress});
    pyodide.globals.set('browser_payload', pyodide.toPy(payload));
    const result = await pyodide.runPythonAsync('import browser_progress\nbrowser_solve(browser_payload, browser_progress.progress)');
    postMessage({type: 'complete', id, result: result.toJs({dict_converter: Object.fromEntries})});
    result.destroy();
  } catch (error) {
    postMessage({type: 'error', id, message: String(error.message || error)});
  }
};
