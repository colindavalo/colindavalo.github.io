/* Interface of the limit-curve page. The saved representation and its first
   sample come from data/reference.js; new curves are computed in worker.js.
   Only the cubic term t = (A + Bx) s³ is editable: the surface y² = x⁵ − x,
   the odd spin structure p∞, the mesh level and the sampler are fixed. */
'use strict';
const $ = id => document.getElementById(id);
const LEVEL = 6;
const FIXED = {roots: [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]], spin: 'odd_inf', level: LEVEL};
const SAMPLER = {mode: 'orbit', length: 12, seed: 7};
const BUDGETS = [20000, 50000, 100000];
const SUB = n => '₀₁₂'[n];

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('plot'), ctx = canvas.getContext('2d');
const viewState = {mode: 'sphere', yaw: .6, pitch: .35, zoom: 2, pan: [0, 0], pausedUntil: 0};
const cache = new Map();   // "A|B" -> computed representation, for this visit
let active = null, busy = false, dirty = true;

/* ---------- mathematics in text ---------- */
const tex = (element, source) => katex.render(source, element, {throwOnError: false});
const num = x => {
  const r = Math.round(x * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
};
function complexTex([re, im]) {
  if (!im) return num(re);
  const imaginary = `${Math.abs(im) === 1 ? '' : num(Math.abs(im))}i`;
  if (!re) return im < 0 ? `-${imaginary}` : imaginary;
  return `(${num(re)} ${im < 0 ? '-' : '+'} ${imaginary})`;
}
const key = (A, B) => [...A, ...B].map(num).join('|');

/* ---------- view switch ---------- */
const viewButtons = [...$('view').querySelectorAll('button')];
function setView(value) {
  viewButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === value)));
  viewState.mode = value;
  if (value !== 'sphere') fitChart();
  updateCaption(); dirty = true;
}
viewButtons.forEach(b => b.addEventListener('click', () => setView(b.dataset.value)));
$('view').addEventListener('keydown', e => {
  const step = {ArrowRight: 1, ArrowLeft: -1}[e.key];
  if (!step) return;
  e.preventDefault();
  const i = viewButtons.findIndex(b => b.dataset.value === viewState.mode);
  const next = viewButtons[(i + step + viewButtons.length) % viewButtons.length];
  next.focus(); setView(next.dataset.value);
});

/* ---------- worker client ---------- */
let worker = null, sequence = 0;
const pending = new Map();
function ensureWorker() {
  if (worker) return worker;
  worker = new Worker('worker.js');
  worker.onmessage = ({data}) => {
    const call = pending.get(data.id);
    if (!call) return;
    if (data.type === 'progress') { call.progress?.(data.message); return; }
    pending.delete(data.id);
    if (data.type === 'result') call.resolve(data.result); else call.reject(Error(data.message));
  };
  worker.onerror = event => {
    event.preventDefault();
    for (const call of pending.values()) call.reject(Error(`The browser solver stopped: ${event.message || 'unknown error'}`));
    pending.clear(); worker = null;
  };
  return worker;
}
function request(type, payload, progress) {
  if (location.protocol === 'file:') {
    return Promise.reject(Error('New curves need the page to be served over HTTP; the saved curve works offline.'));
  }
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject, progress});
    ensureWorker().postMessage({id, type, payload});
  });
}
$('cancel').onclick = () => {
  worker?.terminate(); worker = null;
  for (const call of pending.values()) call.reject(Object.assign(Error('Cancelled'), {cancelled: true}));
  pending.clear();
};
function setBusy(message) {
  busy = Boolean(message);
  $('busy').hidden = !busy;
  if (busy) $('busyText').textContent = message;
  for (const id of ['compute', 'more']) $(id).disabled = busy;
  if (!busy) $('more').disabled = !active || active.count >= BUDGETS.at(-1);
}
const progress = message => { $('busyText').textContent = message; };
function setStatus(id, text, kind = '') { $(id).className = `status${kind ? ` ${kind}` : ''}`; $(id).textContent = text; }

/* ---------- displayed curve ---------- */
function showRepresentation() {
  const {A, B} = active.settings, error = active.holonomy.surface_relation_error;
  tex($('repT'), `A = ${complexTex(A)},\\ B = ${complexTex(B)}`);
  $('repPoints').textContent = (active.points.length / 3).toLocaleString('en');
  const [mantissa, exponent] = error.toExponential(1).split('e');
  tex($('repError'), `${mantissa} \\times 10^{${+exponent}}`);
  const coarse = error > .05;
  $('repNote').className = `panel-note${coarse ? ' warn' : ''}`;
  $('repNote').textContent = coarse
    ? 'The relation error is large for this cubic term: the computed holonomy is too coarse to trust fine detail.'
    : `Mesh level ${active.settings.level}.`;
  $('more').disabled = active.count >= BUDGETS.at(-1);
}
function toPoints(list) { return Float32Array.from(list.flat()); }
function activate(representation, sample, count) {
  active = {...representation, points: toPoints(sample.points), count};
  showRepresentation();
  if (viewState.mode !== 'sphere') fitChart();
  dirty = true;
}

/* ---------- drawing ---------- */
function resize() {
  const box = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(box.width * ratio), h = Math.round(box.height * ratio);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return [box.width, box.height];
}
function draw() {
  const [width, height] = resize(), size = 1.2, points = active?.points;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  const n = points ? points.length / 3 : 0;
  if (viewState.mode === 'sphere') {
    Drawing.sphere(ctx, points, {width, height, yaw: viewState.yaw, pitch: viewState.pitch, size});
    $('counter').textContent = `${n.toLocaleString('en')} points · ${(2 * n).toLocaleString('en')} lifts`;
  } else {
    const visible = Drawing.chart(ctx, points, {width, height, axis: +viewState.mode, zoom: viewState.zoom, pan: viewState.pan, size});
    $('counter').textContent = `${visible.toLocaleString('en')} of ${n.toLocaleString('en')} points in view`;
  }
}
function frame(time) {
  if (viewState.mode === 'sphere' && !still && !drag && time > viewState.pausedUntil && !document.hidden) {
    if (frame.last) viewState.yaw += Math.min(time - frame.last, 50) * .00012;
    dirty = true;
  }
  frame.last = time;
  if (dirty) { dirty = false; draw(); }
  requestAnimationFrame(frame);
}
function updateCaption() {
  if (viewState.mode === 'sphere') {
    $('caption').innerHTML = 'Both lifts ±<i>p</i> of every sampled point: <span class="legend-dot front"></span>front hemisphere, <span class="legend-dot back"></span>rear hemisphere. Drag or use the arrow keys to rotate.';
  } else {
    const j = +viewState.mode, [k, l] = [0, 1, 2].filter(i => i !== j);
    $('caption').textContent = `Affine chart X${SUB(j)} ≠ 0 with coordinates (X${SUB(k)}/X${SUB(j)}, X${SUB(l)}/X${SUB(j)}). Scroll to zoom, drag to pan, double-click to refit.`;
  }
}
function fitChart() {
  const points = active?.points, axis = +viewState.mode;
  if (!points || !Number.isFinite(axis)) return;
  const others = [0, 1, 2].filter(i => i !== axis), xs = [], ys = [];
  for (let i = 0; i < points.length; i += 3) {
    const w = points[i + axis];
    if (Math.abs(w) > 1e-6) { xs.push(points[i + others[0]] / w); ys.push(points[i + others[1]] / w); }
  }
  if (!xs.length) { viewState.zoom = 2; viewState.pan = [0, 0]; return; }
  const quantile = (a, q) => a.sort((x, y) => x - y)[Math.floor(q * (a.length - 1))];
  const lo = [quantile(xs, .08), quantile(ys, .08)], hi = [quantile(xs, .92), quantile(ys, .92)];
  viewState.pan = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
  viewState.zoom = Math.max(.05, .62 * Math.max(hi[0] - lo[0], hi[1] - lo[1]));
}

/* ---------- pointer and keyboard ---------- */
let drag = null;
const pause = () => { viewState.pausedUntil = performance.now() + 5000; };
canvas.addEventListener('pointerdown', e => {
  drag = {x: e.clientX, y: e.clientY, yaw: viewState.yaw, pitch: viewState.pitch, pan: [...viewState.pan]};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (viewState.mode === 'sphere') {
    viewState.yaw = drag.yaw + dx * .008;
    viewState.pitch = Math.max(-1.55, Math.min(1.55, drag.pitch + dy * .008));
  } else {
    const box = canvas.getBoundingClientRect(), scale = Math.min(box.width, box.height) / (2 * viewState.zoom);
    viewState.pan = [drag.pan[0] - dx / scale, drag.pan[1] + dy / scale];
  }
  dirty = true;
});
const release = () => { drag = null; pause(); };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('dblclick', () => { if (viewState.mode !== 'sphere') { fitChart(); dirty = true; } });
canvas.addEventListener('wheel', e => {
  if (viewState.mode === 'sphere') return;
  e.preventDefault();
  viewState.zoom = Math.max(1e-3, Math.min(1e4, viewState.zoom * Math.exp(e.deltaY * .0012)));
  dirty = true;
}, {passive: false});
canvas.addEventListener('keydown', e => {
  const k = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
  if (!k) return;
  e.preventDefault();
  if (viewState.mode === 'sphere') {
    viewState.yaw += k[0] * .08;
    viewState.pitch = Math.max(-1.55, Math.min(1.55, viewState.pitch + k[1] * .08));
  } else {
    viewState.pan[0] += k[0] * viewState.zoom * .1; viewState.pan[1] -= k[1] * viewState.zoom * .1;
  }
  pause(); dirty = true;
});
new ResizeObserver(() => { dirty = true; }).observe(canvas);

/* ---------- cubic term and points ---------- */
function readCubic() {
  const values = ['ar', 'ai', 'br', 'bi'].map(id => +$(id).value);
  if (!values.every(Number.isFinite)) throw Error('A and B need numeric real and imaginary parts.');
  const A = values.slice(0, 2), B = values.slice(2);
  if (Math.hypot(...A) > 1 || Math.hypot(...B) > 1) throw Error('Keep |A| ≤ 1 and |B| ≤ 1.');
  return {A, B};
}
for (const id of ['ar', 'ai', 'br', 'bi']) $(id).addEventListener('input', () => { if (!busy) setStatus('computeStatus', ''); });

$('compute').onclick = async () => {
  let cubic;
  try { cubic = readCubic(); } catch (e) { setStatus('computeStatus', e.message, 'error'); return; }
  const count = BUDGETS[0], known = cache.get(key(cubic.A, cubic.B));
  setBusy('Starting Python in this browser (first use downloads it)…');
  setStatus('computeStatus', '');
  try {
    const representation = known ?? await (async () => {
      const computed = await request('compute', {...FIXED, ...cubic}, progress);
      const value = {settings: computed.settings, holonomy: computed.holonomy, seconds: computed.seconds};
      cache.set(key(cubic.A, cubic.B), value);
      return value;
    })();
    progress('Sampling attracting eigenlines…');
    const sample = await request('sample', {holonomy: representation.holonomy, parameters: {...SAMPLER, count}}, progress);
    activate(representation, sample, count);
    setStatus('computeStatus', known ? '' : `Computed in ${Math.max(1, Math.round(representation.seconds / 60))} min.`);
  } catch (e) {
    setStatus('computeStatus', e.cancelled ? 'Cancelled; the displayed curve is unchanged.' : e.message, e.cancelled ? '' : 'error');
  } finally { setBusy(null); }
};

$('more').onclick = async () => {
  const count = BUDGETS.find(b => b > active.count);
  if (!count) return;
  setBusy('Starting Python in this browser (first use downloads it)…');
  try {
    const sample = await request('sample', {holonomy: active.holonomy, parameters: {...SAMPLER, count}}, progress);
    activate(active, sample, count);
    setStatus('sampleStatus', '');
  } catch (e) {
    setStatus('sampleStatus', e.cancelled ? 'Cancelled; the previous points are kept.' : e.message, e.cancelled ? '' : 'error');
  } finally { setBusy(null); }
};

function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('png').onclick = () => canvas.toBlob(blob => download(blob, 'barbot-deformation-limit-curve.png'));

/* ---------- start ---------- */
(function start() {
  renderMathInElement(document.body, {
    delimiters: [{left: '\\[', right: '\\]', display: true}, {left: '\\(', right: '\\)', display: false}],
    throwOnError: false
  });
  const ref = window.BARBOT_REFERENCE;
  const bytes = Uint8Array.from(atob(ref.points_f32), c => c.charCodeAt(0));
  const representation = {settings: ref.settings, holonomy: ref.holonomy};
  cache.set(key(ref.settings.A, ref.settings.B), representation);
  active = {...representation, points: new Float32Array(bytes.buffer), count: ref.parameters.count};
  showRepresentation();
  updateCaption();
  requestAnimationFrame(frame);
})();
