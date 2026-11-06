/* Drawing of a projective point cloud: both lifts ±p on S², or one affine chart.
   Points are a Float32Array of unit vectors, three numbers per point. */
'use strict';
const Drawing = (() => {
  const INK = {
    front: ['rgba(18,107,86,.5)', 'rgba(18,107,86,.72)', 'rgba(12,77,62,.92)'],
    back: 'rgba(107,92,165,.36)',
    rim: '#c9d6d0',
    axis: '#d8dfdc', label: '#60706a'
  };

  // Camera: yaw about the vertical axis X₂, then pitch. Returns [right, up, depth].
  function camera(yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return (x, y, z) => {
      const X = cy * x + sy * y, Y = -sy * x + cy * y;
      return [X, cp * z - sp * Y, sp * z + cp * Y];
    };
  }

  function sphere(ctx, points, {width, height, yaw, pitch, size}) {
    const r = Math.min(width, height) * .43, cx = width / 2, cy = height / 2, view = camera(yaw, pitch);
    const n = points ? points.length / 3 : 0, back = [], front = [[], [], []];
    for (let i = 0; i < n; i++) {
      const [X, Z, D] = view(points[3 * i], points[3 * i + 1], points[3 * i + 2]);
      // p and −p: one of the two lifts faces the reader.
      const s = D >= 0 ? 1 : -1, depth = Math.abs(D);
      front[depth > .66 ? 2 : depth > .33 ? 1 : 0].push(s * X, s * Z);
      back.push(-s * X, -s * Z);
    }
    const half = size / 2;
    ctx.fillStyle = INK.back;
    ctx.beginPath();
    for (let i = 0; i < back.length; i += 2) ctx.rect(cx + r * back[i] - half * .85, cy - r * back[i + 1] - half * .85, size * .85, size * .85);
    ctx.fill();
    const wash = ctx.createRadialGradient(cx - r * .35, cy - r * .4, r * .05, cx, cy, r);
    wash.addColorStop(0, 'rgba(255,255,255,.5)');
    wash.addColorStop(1, 'rgba(220,236,230,.5)');
    ctx.fillStyle = wash;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = INK.rim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
    front.forEach((band, k) => {
      ctx.fillStyle = INK.front[k];
      ctx.beginPath();
      for (let i = 0; i < band.length; i += 2) ctx.rect(cx + r * band[i] - half, cy - r * band[i + 1] - half, size, size);
      ctx.fill();
    });
    return 2 * n;
  }

  function niceStep(span) {
    const raw = span / 6, power = 10 ** Math.floor(Math.log10(raw)), m = raw / power;
    return power * (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10);
  }

  // Affine chart X_axis = 1; zoom is the half-width of the shortest side.
  function chart(ctx, points, {width, height, axis, zoom, pan, size}) {
    const others = [0, 1, 2].filter(i => i !== axis), scale = Math.min(width, height) / (2 * zoom);
    const cx = width / 2 - pan[0] * scale, cy = height / 2 + pan[1] * scale;
    const step = niceStep(Math.min(width, height) / scale);
    ctx.font = '11px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.lineWidth = 1;
    const x0 = Math.ceil((-cx) / scale / step) * step, x1 = (width - cx) / scale;
    const y0 = Math.ceil((cy - height) / scale / step) * step, y1 = cy / scale;
    ctx.strokeStyle = 'rgba(216,223,220,.55)';
    ctx.beginPath();
    for (let u = x0; u <= x1; u += step) { const x = Math.round(cx + u * scale) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let v = y0; v <= y1; v += step) { const y = Math.round(cy - v * scale) + .5; ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    ctx.strokeStyle = '#b9c8c1';
    ctx.beginPath(); ctx.moveTo(0, Math.round(cy) + .5); ctx.lineTo(width, Math.round(cy) + .5);
    ctx.moveTo(Math.round(cx) + .5, 0); ctx.lineTo(Math.round(cx) + .5, height); ctx.stroke();
    ctx.fillStyle = INK.label;
    const digits = Math.max(0, -Math.floor(Math.log10(step)));
    for (let u = x0; u <= x1; u += step) if (Math.abs(u) > step / 2) ctx.fillText(u.toFixed(digits), cx + u * scale + 4, Math.min(height - 6, Math.max(14, cy + 14)));
    for (let v = y0; v <= y1; v += step) if (Math.abs(v) > step / 2) ctx.fillText(v.toFixed(digits), Math.min(width - 34, Math.max(4, cx + 4)), cy - v * scale - 4);
    ctx.fillText(`X${sub(others[0])}/X${sub(axis)}`, width - 64, Math.min(height - 40, Math.max(14, cy - 8)));
    ctx.fillText(`X${sub(others[1])}/X${sub(axis)}`, 10, 18);
    const n = points ? points.length / 3 : 0, half = size / 2;
    let visible = 0;
    ctx.fillStyle = 'rgba(18,107,86,.78)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const w = points[3 * i + axis];
      if (Math.abs(w) < 1e-12) continue;
      const x = cx + scale * points[3 * i + others[0]] / w, y = cy - scale * points[3 * i + others[1]] / w;
      if (x < -2 || x > width + 2 || y < -2 || y > height + 2) continue;
      ctx.rect(x - half, y - half, size, size); visible++;
    }
    ctx.fill();
    return visible;
  }

  const sub = i => '₀₁₂'[i];
  return {sphere, chart, sub};
})();
if (typeof module !== 'undefined') module.exports = Drawing;
