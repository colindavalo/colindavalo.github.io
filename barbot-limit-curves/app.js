/* Interface of the limit-curve page. All curves are precomputed
   (calculs/precompute_curves.py): data/curves.js lists them and each
   data/curve-<A>.js holds the quantized points of one value of A (B = 0). */
'use strict';
const $ = id => document.getElementById(id);
const SUB = n => '₀₁₂'[n];
const LIST = window.BARBOT_CURVE_LIST;

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('plot'), ctx = canvas.getContext('2d');
const viewState = {mode: 'sphere', yaw: .6, pitch: .35, zoom: 2, pan: [0, 0], pausedUntil: 0};
const decoded = new Map();     // key -> Float32Array
const curvatures = new Map();  // key -> curvature texture
window.BARBOT_CURVATURE = window.BARBOT_CURVATURE || {};
const loading = new Map();     // key -> Promise
let active = null, wanted = null, dirty = true;

const tex = (element, source) => katex.render(source, element, {throwOnError: false});
const formatA = A => String(Math.round(A * 100) / 100);

/* ---------- data ---------- */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src; script.onload = resolve; script.onerror = reject;
    document.head.append(script);
  });
}
async function loadCurvature(key) {
  if (curvatures.has(key)) return curvatures.get(key);
  if (!window.BARBOT_CURVATURE?.[key]) await loadScript(`data/curvature-${key}.js`);
  const values = Curvature.decode(window.BARBOT_CURVATURE[key]);
  delete window.BARBOT_CURVATURE[key];
  curvatures.set(key, values);
  return values;
}

function load(entry) {
  if (decoded.has(entry.key)) return Promise.resolve(decoded.get(entry.key));
  if (!loading.has(entry.key)) loading.set(entry.key, new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `data/curve-${entry.key}.js`;
    script.onload = () => {
      const raw = atob(window.BARBOT_CURVES[entry.key]);
      delete window.BARBOT_CURVES[entry.key];
      const ints = new Int16Array(raw.length / 2);
      for (let i = 0; i < ints.length; i++) ints[i] = raw.charCodeAt(2 * i) | (raw.charCodeAt(2 * i + 1) << 8);
      const points = Float32Array.from(ints, v => v / 32767);
      decoded.set(entry.key, points);
      resolve(points);
    };
    script.onerror = () => { loading.delete(entry.key); reject(Error(`Could not load the curve for A = ${formatA(entry.A)}.`)); };
    document.head.append(script);
  }));
  return loading.get(entry.key);
}

async function show(index) {
  const entry = LIST[index];
  wanted = entry.key;
  tex($('aValue'), `A = ${formatA(entry.A)}`);
  $('aSlider').setAttribute('aria-valuetext', `A = ${formatA(entry.A)}`);
  [...$('ticks').children].forEach((tick, i) => tick.classList.toggle('current', i === index));
  if (!decoded.has(entry.key)) { $('busy').hidden = false; $('busyText').textContent = `Loading the curve for A = ${formatA(entry.A)}…`; }
  try {
    const points = await load(entry);
    if (wanted !== entry.key) return;
    active = {...entry, points};
    describe();
    loadCurvature(entry.key).then(K => { if (wanted === entry.key) { curvState.K = K; requestCurvature(); } })
      .catch(() => { if (wanted === entry.key) { curvState.K = null; requestCurvature(); } });
    if (viewState.mode !== 'sphere') fitChart();
    dirty = true;
  } catch (error) {
    if (wanted === entry.key) $('repNote').textContent = error.message;
  } finally {
    if (wanted === entry.key) $('busy').hidden = true;
  }
}

function describe() {
  $('repPoints').textContent = (active.points.length / 3).toLocaleString('en');
  const change = active.generator_change;
  $('repNote').className = `panel-note${change > .02 ? ' warn' : ''}`;
  $('repNote').textContent = active.A === 0
    ? 'The Barbot representation: its limit curve is a projective line, a great circle on the sphere.'
    : change > .02 ? 'The holonomy is not yet stable under mesh refinement for this value; read the picture as qualitative.' : '';
}

/* ---------- slider ----------
   The track is to scale in A; a position snaps to the nearest computed value,
   and the arrow keys step through the values. */
const slider = $('aSlider');
const largest = LIST[LIST.length - 1].A;
let index = 0;
slider.max = largest;
for (const entry of LIST) {
  const tick = document.createElement('span');
  // Labels only from 0.1 on; the values below are marked but too close to label.
  if (entry.A === 0 || entry.A >= .1 - 1e-9) tick.textContent = formatA(entry.A);
  tick.style.left = `${100 * entry.A / largest}%`;
  $('ticks').append(tick);
}
function select(i) {
  index = Math.max(0, Math.min(LIST.length - 1, i));
  slider.value = LIST[index].A;
  show(index);
}
function nearest(A) {
  return LIST.reduce((best, entry, i) => Math.abs(entry.A - A) < Math.abs(LIST[best].A - A) ? i : best, 0);
}
slider.addEventListener('input', () => {
  const i = nearest(+slider.value);
  slider.value = LIST[i].A;
  if (i !== index) select(i);
});
slider.addEventListener('keydown', e => {
  const step = {ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3}[e.key];
  const jump = {Home: 0, End: LIST.length - 1}[e.key];
  if (step == null && jump == null) return;
  e.preventDefault();
  select(jump ?? index + step);
});

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
  tex($('plotLegend'), viewState.mode === 'sphere' ? '\\text{Limit curve in } \\mathbb{RP}^2'
    : `\\text{Limit curve in } \\mathbb{RP}^2,\\ X_${viewState.mode} \\neq 0`);
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

/* ---------- curvature sphere ---------- */
const curv = $('curv'), cctx = curv.getContext('2d');
const curvState = {K: null, yaw: .5, pitch: .3, drag: null, pending: false};
$('curvBar').style.background = Curvature.gradient();
function drawCurvature() {
  curvState.pending = false;
  const box = curv.getBoundingClientRect();
  if (!box.width) return;
  // Full resolution at rest, one pixel per CSS pixel while dragging.
  const ratio = curvState.drag ? 1 : Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(box.width * ratio), h = Math.round(box.height * ratio);
  if (curv.width !== w || curv.height !== h) { curv.width = w; curv.height = h; }
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.clearRect(0, 0, w, h);
  if (curvState.K) Curvature.draw(cctx, curvState.K, {width: box.width, height: box.height, yaw: curvState.yaw, pitch: curvState.pitch, ratio});
  else { cctx.fillStyle = '#60706a'; cctx.font = `${12 * ratio}px Inter, system-ui, sans-serif`; cctx.fillText('Not computed for this value.', 8 * ratio, 20 * ratio); }
}
function requestCurvature() {
  if (curvState.pending) return;
  curvState.pending = true;
  requestAnimationFrame(drawCurvature);
}
curv.addEventListener('pointerdown', e => {
  curvState.drag = {x: e.clientX, y: e.clientY, yaw: curvState.yaw, pitch: curvState.pitch};
  curv.setPointerCapture(e.pointerId);
});
curv.addEventListener('pointermove', e => {
  const d = curvState.drag;
  if (!d) return;
  curvState.yaw = d.yaw + (e.clientX - d.x) * .01;
  curvState.pitch = Math.max(-1.55, Math.min(1.55, d.pitch + (e.clientY - d.y) * .01));
  requestCurvature();
});
const curvRelease = () => { curvState.drag = null; requestCurvature(); };
curv.addEventListener('pointerup', curvRelease);
curv.addEventListener('pointercancel', curvRelease);
curv.addEventListener('keydown', e => {
  const k = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
  if (!k) return;
  e.preventDefault();
  curvState.yaw += k[0] * .1; curvState.pitch = Math.max(-1.55, Math.min(1.55, curvState.pitch + k[1] * .1));
  requestCurvature();
});
new ResizeObserver(requestCurvature).observe(curv);

function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('png').onclick = () => canvas.toBlob(blob => download(blob, `barbot-deformation-A-${active ? active.key : ''}.png`));

/* ---------- start ---------- */
(function start() {
  renderMathInElement(document.body, {
    delimiters: [{left: '\\[', right: '\\]', display: true}, {left: '\\(', right: '\\)', display: false}],
    throwOnError: false
  });
  const first = nearest(.4);
  index = first; slider.value = LIST[first].A;
  show(first).then(() => LIST.reduce((chain, entry) => chain.then(() => load(entry)).catch(() => {}), Promise.resolve()));
  updateCaption();
  requestAnimationFrame(frame);
})();
