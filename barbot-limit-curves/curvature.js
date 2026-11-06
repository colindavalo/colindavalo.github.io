/* Curvature of the harmonic metric, drawn on the x-sphere CP¹ = X/ι.
   Each data/curvature-<A>.js holds K on a latitude-longitude grid (8 bits on
   [-4, 0]); the sphere is painted pixel by pixel with bilinear sampling. */
'use strict';
const Curvature = (() => {
  const STOPS = [[29, 47, 69], [44, 90, 115], [63, 138, 134], [143, 191, 149], [239, 227, 180]];
  const LABELS = [['0', [0, 0, -1]], ['∞', [0, 0, 1]], ['1', [1, 0, 0]], ['i', [0, 1, 0]], ['−1', [-1, 0, 0]], ['−i', [0, -1, 0]]];
  const LUT = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = i / 255 * (STOPS.length - 1), k = Math.min(STOPS.length - 2, Math.floor(x)), f = x - k;
    for (let c = 0; c < 3; c++) LUT[3 * i + c] = Math.round(STOPS[k][c] + f * (STOPS[k + 1][c] - STOPS[k][c]));
  }

  function decode(entry) {
    const raw = atob(entry.values), values = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) values[i] = raw.charCodeAt(i);
    return {width: entry.width, height: entry.height, values};
  }

  // Paint into ctx (CSS size w × h) at the given pixel ratio.
  function draw(ctx, texture, {width, height, yaw, pitch, ratio}) {
    const W = Math.round(width * ratio), H = Math.round(height * ratio);
    const r = Math.min(W, H) * .4, cx = W / 2, cy = H / 2;
    const image = ctx.createImageData(W, H), out = image.data;
    const {width: tw, height: th, values} = texture;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H, Math.ceil(cy + r));
    for (let py = y0; py < y1; py++) {
      const b = (cy - py - .5) / r;
      for (let px = x0; px < x1; px++) {
        const a = (px + .5 - cx) / r, q = 1 - a * a - b * b;
        if (q <= 0) continue;
        const D = Math.sqrt(q);
        // Inverse of the camera used for the limit curve: (a, b, D) -> world.
        const z = cp * b + sp * D, Y = -sp * b + cp * D;
        const x = cyw * a - syw * Y, y = syw * a + cyw * Y;
        let u = (Math.atan2(y, x) + Math.PI) / (2 * Math.PI) * tw - .5;
        const v = (Math.PI / 2 - Math.asin(Math.max(-1, Math.min(1, z)))) / Math.PI * th - .5;
        const i0 = Math.floor(u), fu = u - i0, j0 = Math.max(0, Math.min(th - 2, Math.floor(v))), fv = Math.max(0, Math.min(1, v - j0));
        const ia = (i0 + tw) % tw, ib = (i0 + 1) % tw, row0 = j0 * tw, row1 = row0 + tw;
        const k = (values[row0 + ia] * (1 - fu) + values[row0 + ib] * fu) * (1 - fv)
                + (values[row1 + ia] * (1 - fu) + values[row1 + ib] * fu) * fv;
        const index = 3 * Math.round(k), light = .78 + .22 * D + .1 * Math.max(0, -.35 * a + .4 * b + .85 * D) ** 8;
        const o = 4 * (py * W + px), edge = Math.min(1, q * r * .9);   // soft antialiased rim
        out[o] = Math.min(255, LUT[index] * light); out[o + 1] = Math.min(255, LUT[index + 1] * light);
        out[o + 2] = Math.min(255, LUT[index + 2] * light); out[o + 3] = 255 * edge;
      }
    }
    ctx.putImageData(image, 0, 0);
    ctx.save();
    ctx.scale(ratio, ratio);
    const R = r / ratio, CX = cx / ratio, CY = cy / ratio;
    ctx.font = 'italic 15px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center';
    for (const [text, [x, y, z]] of LABELS) {
      const a = cyw * x + syw * y, b = -syw * x + cyw * y, depth = sp * z + cp * b;
      if (depth < .05) continue;
      const px = CX + R * a, py = CY - R * (cp * z - sp * b);
      ctx.fillStyle = '#17221f'; ctx.beginPath(); ctx.arc(px, py, 3, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px, py, 1.8, 0, 2 * Math.PI); ctx.fill();
      ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(23,34,31,.75)';
      ctx.strokeText(text, px, py - 8);
      ctx.fillStyle = '#ffffff'; ctx.fillText(text, px, py - 8);
    }
    ctx.restore();
  }

  return {decode, draw, gradient: () => `linear-gradient(90deg, ${STOPS.map((c, i) => `rgb(${c}) ${100 * i / (STOPS.length - 1)}%`).join(', ')})`};
})();
