/* Drawing of a point cloud on S² × S³, the double cover of Ein^{2,3}.
   Points are a Float32Array, seven numbers per point: u ∈ S² (3), w ∈ S³ (4).
   The null line [u : w] has two lifts, (u, w) and (−u, −w). On the computed
   curves u₃ never vanishes, so the lifts form two disjoint curves: the
   "upper" lift (u₃ > 0) and the "lower" lift (u₃ < 0). `lift` selects
   1 (upper), −1 (lower) or 0 (both). Colour tells the lift apart; depth only
   changes the opacity. */
'use strict';
const Drawing = (() => {
  const INK = {
    // [behind, front far, front middle, front near]
    upper: ['rgba(18,107,86,.2)', 'rgba(18,107,86,.5)', 'rgba(18,107,86,.72)', 'rgba(12,77,62,.92)'],
    lower: ['rgba(176,112,40,.2)', 'rgba(176,112,40,.5)', 'rgba(176,112,40,.72)', 'rgba(140,84,24,.92)'],
    rim: '#c9d6d0', guide: '#dfe6e3'
  };

  // Camera: yaw about the vertical axis, then pitch. Returns [right, up, depth].
  function camera(yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return (x, y, z) => {
      const X = cy * x + sy * y, Y = -sy * x + cy * y;
      return [X, cp * z - sp * Y, sp * z + cp * Y];
    };
  }

  const signs = lift => lift === 0 ? [1, -1] : [lift];
  // Buckets per lift: 0 = behind, 1-3 = in front, by increasing depth.
  const buckets = () => ({upper: [[], [], [], []], lower: [[], [], [], []]});
  const band = D => D < 0 ? 0 : D > .66 ? 3 : D > .33 ? 2 : 1;

  // Behind first (both lifts), then the sphere wash, then the front.
  function plot(ctx, sets, cx, cy, r, size, between) {
    const half = size / 2;
    const fill = (name, k, s) => {
      const pts = sets[name][k];
      ctx.fillStyle = INK[name][k];
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) ctx.rect(cx + r * pts[i] - s / 2, cy - r * pts[i + 1] - s / 2, s, s);
      ctx.fill();
    };
    fill('upper', 0, size * .85); fill('lower', 0, size * .85);
    between();
    for (let k = 1; k <= 3; k++) { fill('upper', k, size); fill('lower', k, size); }
    return half;
  }

  /* S² factor: the selected lifts ±u on the sphere. */
  function sphere(ctx, points, {width, height, yaw, pitch, size, lift}) {
    const r = Math.min(width, height) * .43, cx = width / 2, cy = height / 2, view = camera(yaw, pitch);
    const n = points ? points.length / 7 : 0, sets = buckets();
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      const o = 7 * i, s0 = points[o + 2] >= 0 ? 1 : -1;
      const [X, Z, D] = view(points[o], points[o + 1], points[o + 2]);
      for (const sign of signs(lift)) {
        const s = sign * s0;
        sets[sign > 0 ? 'upper' : 'lower'][band(s * D)].push(s * X, s * Z);
        drawn++;
      }
    }
    plot(ctx, sets, cx, cy, r, size, () => {
      const wash = ctx.createRadialGradient(cx - r * .35, cy - r * .4, r * .05, cx, cy, r);
      wash.addColorStop(0, 'rgba(255,255,255,.5)');
      wash.addColorStop(1, 'rgba(220,236,230,.5)');
      ctx.fillStyle = wash;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = INK.rim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
    });
    return drawn;
  }

  /* S³ factor: rotate in the plane (w₂, w₃) by `turn`, project
     stereographically from w₃ = 1 into ℝ³, then view with the 3D camera.
     The unit sphere drawn is the image of the great sphere w₃ = 0. */
  function stereographic(ctx, points, {width, height, yaw, pitch, turn, zoom, size, lift}) {
    const r = Math.min(width, height) * .4 / zoom, cx = width / 2, cy = height / 2, view = camera(yaw, pitch);
    const c = Math.cos(turn), s = Math.sin(turn), far = 1.25 * Math.hypot(width, height) / (2 * r);
    const n = points ? points.length / 7 : 0, sets = buckets();
    let visible = 0, total = 0;
    for (let i = 0; i < n; i++) {
      const o = 7 * i + 3, s0 = points[o - 1] >= 0 ? 1 : -1, w0 = points[o], w1 = points[o + 1];
      const w2 = c * points[o + 2] - s * points[o + 3], w3 = s * points[o + 2] + c * points[o + 3];
      for (const choice of signs(lift)) {
        const sign = choice * s0;
        total++;
        const den = 1 - sign * w3;
        if (den < 1e-3) continue;
        const x = sign * w0 / den, y = sign * w1 / den, z = sign * w2 / den;
        if (Math.abs(x) > far || Math.abs(y) > far || Math.abs(z) > far) continue;
        const [X, Z, D] = view(x, y, z);
        // Depth relative to the centre of the unit sphere.
        sets[choice > 0 ? 'upper' : 'lower'][band(D)].push(X, Z);
        visible++;
      }
    }
    plot(ctx, sets, cx, cy, r, size, () => {
      ctx.strokeStyle = INK.rim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
      // Equator of the unit sphere, for depth.
      ctx.strokeStyle = INK.guide;
      ctx.beginPath();
      for (let k = 0; k <= 96; k++) {
        const a = 2 * Math.PI * k / 96, [X, Z] = view(Math.cos(a), Math.sin(a), 0);
        if (k) ctx.lineTo(cx + r * X, cy - r * Z); else ctx.moveTo(cx + r * X, cy - r * Z);
      }
      ctx.stroke();
    });
    return {visible, total};
  }

  return {sphere, stereographic};
})();
if (typeof module !== 'undefined') module.exports = Drawing;
