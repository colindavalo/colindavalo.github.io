/* Interface of the G2' limit-curve page. All curves are precomputed
   (calculs/sample_curves.py): data/curves.js lists them and each
   data/curve-<t>.js holds the quantized points of one value of t. */
'use strict';
const $ = id => document.getElementById(id);
const LIST = window.G2_CURVE_LIST;

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('plot'), ctx = canvas.getContext('2d');
const viewState = {mode: 's3', yaw: .6, pitch: .35, zoom: 1, turn: 0, lift: 0, pausedUntil: 0};
const decoded = new Map();     // key -> Float32Array
const loading = new Map();     // key -> Promise
let active = null, wanted = null, dirty = true;

const tex = (element, source) => katex.render(source, element, {throwOnError: false});
const formatT = t => String(Math.round(t * 100) / 100);
const scientific = x => {
  if (!(x > 0)) return '0';
  const e = Math.floor(Math.log10(x)), m = x / 10 ** e;
  return `${m.toFixed(1)} × 10${String(e).replace('-', '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`;
};

/* ---------- data ---------- */
function load(entry) {
  if (decoded.has(entry.key)) return Promise.resolve(decoded.get(entry.key));
  if (!loading.has(entry.key)) loading.set(entry.key, new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `data/curve-${entry.key}.js`;
    script.onload = () => {
      const raw = atob(window.G2_CURVES[entry.key]);
      delete window.G2_CURVES[entry.key];
      const ints = new Int16Array(raw.length / 2);
      for (let i = 0; i < ints.length; i++) ints[i] = raw.charCodeAt(2 * i) | (raw.charCodeAt(2 * i + 1) << 8);
      const points = Float32Array.from(ints, v => v / 32767);
      decoded.set(entry.key, points);
      resolve(points);
    };
    script.onerror = () => { loading.delete(entry.key); reject(Error(`Could not load the curve for t = ${formatT(entry.t)}.`)); };
    document.head.append(script);
  }));
  return loading.get(entry.key);
}

async function show(index) {
  const entry = LIST[index];
  wanted = entry.key;
  tex($('tValue'), `t = ${formatT(entry.t)}`);
  $('tSlider').setAttribute('aria-valuetext', `t = ${formatT(entry.t)}`);
  [...$('ticks').children].forEach((tick, i) => tick.classList.toggle('current', i === index));
  if (!decoded.has(entry.key)) { $('busy').hidden = false; $('busyText').textContent = `Loading the curve for t = ${formatT(entry.t)}…`; }
  try {
    const points = await load(entry);
    if (wanted !== entry.key) return;
    active = {...entry, points};
    describe();
    // Prefetch the neighbouring values only: each file is up to about 1 MB.
    for (const j of [index - 1, index + 1]) if (LIST[j]) load(LIST[j]).catch(() => {});
    dirty = true;
  } catch (error) {
    if (wanted === entry.key) $('repNote').textContent = error.message;
  } finally {
    if (wanted === entry.key) $('busy').hidden = true;
  }
}

function describe() {
  $('repPoints').textContent = (active.points.length / 7).toLocaleString('en');
  $('repRelation').textContent = scientific(active.relation_error);
  $('repChange').textContent = scientific(active.generator_change);
  const doubtful = active.generator_change > 1e-3;
  $('repNote').className = `panel-note${doubtful ? ' warn' : ''}`;
  $('repNote').textContent = active.t === 0
    ? 'At t = 0 the curve is a circle: one point of S² and a great circle of S³.'
    : doubtful ? 'The holonomy is not accurate enough for this value; read the picture as qualitative.' : '';
}

/* ---------- slider over t, to scale, snapping to the computed values ---------- */
const slider = $('tSlider');
const largest = LIST[LIST.length - 1].t;
let index = 0;
slider.max = largest;
LIST.forEach((entry, i) => {
  const tick = document.createElement('span');
  // Every other value is labelled; all are marked at their true position.
  if (i % 2 === 0) tick.textContent = formatT(entry.t);
  tick.style.left = `${100 * entry.t / largest}%`;
  $('ticks').append(tick);
});
function select(i) {
  index = Math.max(0, Math.min(LIST.length - 1, i));
  slider.value = LIST[index].t;
  show(index);
}
function nearest(t) {
  return LIST.reduce((best, entry, i) => Math.abs(entry.t - t) < Math.abs(LIST[best].t - t) ? i : best, 0);
}
slider.addEventListener('input', () => {
  const i = nearest(+slider.value);
  slider.value = LIST[i].t;
  if (i !== index) select(i);
});
slider.addEventListener('keydown', e => {
  const step = {ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3}[e.key];
  const jump = {Home: 0, End: LIST.length - 1}[e.key];
  if (step == null && jump == null) return;
  e.preventDefault();
  select(jump ?? index + step);
});
$('turn').addEventListener('input', e => { viewState.turn = +e.target.value * Math.PI / 180; dirty = true; });

/* ---------- segmented switches: factor shown, lifts shown ---------- */
function segmented(group, current, apply) {
  const buttons = [...$(group).querySelectorAll('button')];
  const set = value => {
    buttons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === value)));
    apply(value); updateCaption(); dirty = true;
  };
  buttons.forEach(b => b.addEventListener('click', () => set(b.dataset.value)));
  $(group).addEventListener('keydown', e => {
    const step = {ArrowRight: 1, ArrowLeft: -1}[e.key];
    if (!step) return;
    e.preventDefault();
    const i = buttons.findIndex(b => b.getAttribute('aria-checked') === 'true');
    const next = buttons[(i + step + buttons.length) % buttons.length];
    next.focus(); set(next.dataset.value);
  });
}
segmented('view', 's3', value => {
  viewState.mode = value;
  $('turnBlock').classList.toggle('muted', value !== 's3');
});
segmented('lifts', '0', value => { viewState.lift = +value; });

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
  const view = {width, height, yaw: viewState.yaw, pitch: viewState.pitch, size, lift: viewState.lift};
  if (viewState.mode === 's2') {
    const drawn = Drawing.sphere(ctx, points, view);
    $('counter').textContent = `${drawn.toLocaleString('en')} points drawn`;
  } else {
    const {visible, total} = Drawing.stereographic(ctx, points, {...view, turn: viewState.turn, zoom: viewState.zoom});
    $('counter').textContent = `${visible.toLocaleString('en')} of ${total.toLocaleString('en')} points in view`;
  }
}
function frame(time) {
  if (!still && !drag && time > viewState.pausedUntil && !document.hidden) {
    if (frame.last) viewState.yaw += Math.min(time - frame.last, 50) * .00012;
    dirty = true;
  }
  frame.last = time;
  if (dirty) { dirty = false; draw(); }
  requestAnimationFrame(frame);
}
function updateCaption() {
  const lifts = {
    '0': 'Both lifts: <span class="legend-dot upper"></span>upper (<i>u</i>₃ &gt; 0) and <span class="legend-dot lower"></span>lower (<i>u</i>₃ &lt; 0), exchanged by (<i>u</i>, <i>w</i>) ↦ (−<i>u</i>, −<i>w</i>).',
    '1': 'Upper lift only (<span class="legend-dot upper"></span><i>u</i>₃ &gt; 0): one point of S² × S³ for each null line.',
    '-1': 'Lower lift only (<span class="legend-dot lower"></span><i>u</i>₃ &lt; 0): one point of S² × S³ for each null line.'
  }[String(viewState.lift)];
  if (viewState.mode === 's2') {
    tex($('plotLegend'), '\\text{Limit curve, } S^2 \\text{ factor}');
    $('caption').innerHTML = `${lifts} Paler points are on the rear hemisphere. Drag or use the arrow keys to rotate.`;
  } else {
    tex($('plotLegend'), '\\text{Limit curve, } S^3 \\text{ factor}');
    $('caption').innerHTML = `${lifts} Projected stereographically to ℝ³; the circle is the outline of the unit sphere, image of a great sphere of S³, and paler points lie behind its centre. Drag to rotate, scroll to zoom.`;
  }
}

/* ---------- pointer and keyboard ---------- */
let drag = null;
const pause = () => { viewState.pausedUntil = performance.now() + 5000; };
canvas.addEventListener('pointerdown', e => {
  drag = {x: e.clientX, y: e.clientY, yaw: viewState.yaw, pitch: viewState.pitch};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  viewState.yaw = drag.yaw + (e.clientX - drag.x) * .008;
  viewState.pitch = Math.max(-1.55, Math.min(1.55, drag.pitch + (e.clientY - drag.y) * .008));
  dirty = true;
});
const release = () => { drag = null; pause(); };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('dblclick', () => { viewState.zoom = 1; dirty = true; });
canvas.addEventListener('wheel', e => {
  if (viewState.mode !== 's3') return;
  e.preventDefault();
  viewState.zoom = Math.max(.2, Math.min(8, viewState.zoom * Math.exp(e.deltaY * .0012)));
  dirty = true;
}, {passive: false});
canvas.addEventListener('keydown', e => {
  const k = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
  if (!k) return;
  e.preventDefault();
  viewState.yaw += k[0] * .08;
  viewState.pitch = Math.max(-1.55, Math.min(1.55, viewState.pitch + k[1] * .08));
  pause(); dirty = true;
});
new ResizeObserver(() => { dirty = true; }).observe(canvas);

function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('png').onclick = () => canvas.toBlob(blob => download(blob, `g2-limit-curve-t-${active ? active.key : ''}-${viewState.mode}.png`));

/* ---------- start ---------- */
(function start() {
  renderMathInElement(document.body, {
    delimiters: [{left: '\\[', right: '\\]', display: true}, {left: '\\(', right: '\\)', display: false}],
    throwOnError: false
  });
  const first = nearest(.35);
  index = first; slider.value = LIST[first].t;
  show(first);
  updateCaption();
  requestAnimationFrame(frame);
})();
