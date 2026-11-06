/* Drawing of a point cloud on S² × S³, the double cover of Ein^{2,3}.
   Points are a Float32Array, seven numbers per point: u ∈ S² (3), w ∈ S³ (4).
   The null line is ±(u, w); both lifts are drawn. */
'use strict';
const Drawing = (() => {
  const INK = {
    front: ['rgba(18,107,86,.5)', 'rgba(18,107,86,.72)', 'rgba(12,77,62,.92)'],
    back: 'rgba(107,92,165,.36)',
    rim: '#c9d6d0', guide: '#dfe6e3', label: '#60706a'
  };

  // Camera: yaw about the vertical axis, then pitch. Returns [right, up, depth].
  function camera(yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return (x, y, z) => {
      const X = cy * x + sy * y, Y = -sy * x + cy * y;
      return [X, cp * z - sp * Y, sp * z + cp * Y];
    };
  }

  function plot(ctx, bands, back, cx, cy, r, size) {
    const half = size / 2;
    ctx.fillStyle = INK.back;
    ctx.beginPath();
    for (let i = 0; i < back.length; i += 2) ctx.rect(cx + r * back[i] - half * .85, cy - r * back[i + 1] - half * .85, size * .85, size * .85);
    ctx.fill();
    return () => bands.forEach((band, k) => {
      ctx.fillStyle = INK.front[k];
      ctx.beginPath();
      for (let i = 0; i < band.length; i += 2) ctx.rect(cx + r * band[i] - half, cy - r * band[i + 1] - half, size, size);
      ctx.fill();
    });
  }

  /* S² factor: both lifts ±u on the sphere, as on the Barbot page. */
  function sphere(ctx, points, {width, height, yaw, pitch, size}) {
    const r = Math.min(width, height) * .43, cx = width / 2, cy = height / 2, view = camera(yaw, pitch);
    const n = points ? points.length / 7 : 0, back = [], front = [[], [], []];
    for (let i = 0; i < n; i++) {
      const [X, Z, D] = view(points[7 * i], points[7 * i + 1], points[7 * i + 2]);
      const s = D >= 0 ? 1 : -1, depth = Math.abs(D);
      front[depth > .66 ? 2 : depth > .33 ? 1 : 0].push(s * X, s * Z);
      back.push(-s * X, -s * Z);
    }
    const drawFront = plot(ctx, front, back, cx, cy, r, size);
    const wash = ctx.createRadialGradient(cx - r * .35, cy - r * .4, r * .05, cx, cy, r);
    wash.addColorStop(0, 'rgba(255,255,255,.5)');
    wash.addColorStop(1, 'rgba(220,236,230,.5)');
    ctx.fillStyle = wash;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = INK.rim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
    drawFront();
    return 2 * n;
  }

  /* S³ factor: rotate in the plane (w₂, w₃) by `turn`, project
     stereographically from w₃ = 1 into ℝ³, then view with the 3D camera.
     The unit sphere drawn is the image of the great sphere w₃ = 0. */
  function stereographic(ctx, points, {width, height, yaw, pitch, turn, zoom, size}) {
    const r = Math.min(width, height) * .4 / zoom, cx = width / 2, cy = height / 2, view = camera(yaw, pitch);
    const c = Math.cos(turn), s = Math.sin(turn), far = 1.25 * Math.hypot(width, height) / (2 * r);
    const n = points ? points.length / 7 : 0, front = [[], [], []], back = [];
    let visible = 0;
    for (let i = 0; i < n; i++) {
      const o = 7 * i + 3, w0 = points[o], w1 = points[o + 1];
      const w2 = c * points[o + 2] - s * points[o + 3], w3 = s * points[o + 2] + c * points[o + 3];
      for (const sign of [1, -1]) {
        const den = 1 - sign * w3;
        if (den < 1e-3) continue;
        const x = sign * w0 / den, y = sign * w1 / den, z = sign * w2 / den;
        if (Math.abs(x) > far || Math.abs(y) > far || Math.abs(z) > far) continue;
        const [X, Z, D] = view(x, y, z);
        // Depth relative to the unit sphere: points behind it are drawn first.
        if (D < 0) back.push(X, Z);
        else front[D > .66 ? 2 : D > .33 ? 1 : 0].push(X, Z);
        visible++;
      }
    }
    const drawFront = plot(ctx, front, back, cx, cy, r, size);
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
    drawFront();
    return visible;
  }

  return {sphere, stereographic};
})();
if (typeof module !== 'undefined') module.exports = Drawing;
