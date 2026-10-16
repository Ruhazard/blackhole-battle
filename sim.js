// Shared deterministic simulation (used by game and headless solver)
(function () {
  const G = 120, SOFT = 300, MAX_SPEED = 520, STEP = 1 / 120, STOP_SPEED = 14, MAX_PULL = 110;
  const launchSpeed = p => 50 + p * 2.6;
  const fuelFor = L => L.stops * 1.35 + 0.25;

  function prep(src) {
    const L = JSON.parse(JSON.stringify(src));
    for (const k of ['holes','planets','moons','asteroids','stations','winds','magnets','stars']) L[k] = L[k] || [];
    return L;
  }
  function moonPos(m, t) { return [m[0] + Math.cos(m[4] * t + m[5]) * m[2], m[1] + Math.sin(m[4] * t + m[5]) * m[2]]; }
  function dilation(x, y, L) {
    let tf = 1;
    for (const h of L.holes) {
      const d = Math.hypot(x - h[0], y - h[1]), rs = h[3] * 2.4;
      const t = Math.sqrt(Math.max(0.01, 1 - rs / Math.max(d, rs)));
      tf = Math.min(tf, 0.12 + 0.88 * t * t);
    }
    return tf;
  }
  function accel(x, y, L) {
    let ax = 0, ay = 0;
    const add = (sx, sy, m, mul) => { const dx = sx - x, dy = sy - y, r2 = dx * dx + dy * dy + SOFT, r = Math.sqrt(r2); const f = G * m * mul / r2; ax += f * dx / r; ay += f * dy / r; };
    for (const h of L.holes) add(h[0], h[1], h[2], 1);
    for (const p of L.planets) if (p[3]) add(p[0], p[1], p[3], 1);
    for (const s of L.stations) add(s[0], s[1], s[2], 1);
    for (const m of L.magnets) { const d = Math.hypot(m[0] - x, m[1] - y); if (d < m[3]) add(m[0], m[1], m[2], 1 + 2 * (1 - d / m[3])); }
    return [ax, ay];
  }
  function bounceCircle(o, cx, cy, r, rest) {
    const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy), R = r + 7;
    if (d >= R || d === 0) return false;
    const nx = dx / d, ny = dy / d; o.x = cx + nx * (R + 0.5); o.y = cy + ny * (R + 0.5);
    const vn = o.vx * nx + o.vy * ny; if (vn < 0) { o.vx -= (1 + rest) * vn * nx; o.vy -= (1 + rest) * vn * ny; }
    return true;
  }
  function bounceRect(o, a, rest) {
    const c = Math.cos(-a[4]), s = Math.sin(-a[4]);
    const lx = (o.x - a[0]) * c - (o.y - a[1]) * s, ly = (o.x - a[0]) * s + (o.y - a[1]) * c;
    const hw = a[2] / 2, hh = a[3] / 2;
    const nxl = Math.max(-hw, Math.min(lx, hw)), nyl = Math.max(-hh, Math.min(ly, hh));
    let dx = lx - nxl, dy = ly - nyl, d = Math.hypot(dx, dy);
    if (d >= 7) return false;
    if (d === 0) { // inside: push out along smallest axis
      const px = hw - Math.abs(lx), py = hh - Math.abs(ly);
      if (px < py) { dx = Math.sign(lx) || 1; dy = 0; } else { dx = 0; dy = Math.sign(ly) || 1; } d = 1;
    }
    let nx = dx / d, ny = dy / d;
    const cb = Math.cos(a[4]), sb = Math.sin(a[4]);
    const wnx = nx * cb - ny * sb, wny = nx * sb + ny * cb;
    const wx = nxl * cb - nyl * sb + a[0], wy = nxl * sb + nyl * cb + a[1];
    o.x = wx + wnx * 7.5; o.y = wy + wny * 7.5;
    const vn = o.vx * wnx + o.vy * wny; if (vn < 0) { o.vx -= (1 + rest) * vn * wnx; o.vy -= (1 + rest) * vn * wny; }
    return true;
  }
  // o: {x,y,vx,vy,t(sim clock),fuel}; returns {tf, bounce}
  function step(o, L, braking) {
    const tf = dilation(o.x, o.y, L);
    const d = STEP * (0.55 + 0.45 * tf);
    const [ax, ay] = accel(o.x, o.y, L);
    o.vx += ax * d; o.vy += ay * d;
    for (const w of L.winds) if (o.x > w[0] && o.x < w[0] + w[2] && o.y > w[1] && o.y < w[1] + w[3]) { o.vx += w[4] * w[6] * d; o.vy += w[5] * w[6] * d; }
    if (braking && o.fuel > 0) { const k = Math.pow(0.06, d); o.vx *= k; o.vy *= k; o.fuel = Math.max(0, o.fuel - STEP); }
    const sp = Math.hypot(o.vx, o.vy); if (sp > MAX_SPEED) { o.vx *= MAX_SPEED / sp; o.vy *= MAX_SPEED / sp; }
    o.x += o.vx * d; o.y += o.vy * d; o.t += d;
    let bounce = false;
    for (const p of L.planets) bounce = bounceCircle(o, p[0], p[1], p[2], 0.8) || bounce;
    for (const s of L.stations) bounce = bounceCircle(o, s[0], s[1], 12, 0.6) || bounce;
    for (const m of L.moons) { const [mx, my] = moonPos(m, o.t); bounce = bounceCircle(o, mx, my, m[3], 0.9) || bounce; }
    for (const a of L.asteroids) bounce = bounceRect(o, a, 0.9) || bounce;
    return { tf, bounce };
  }
  // status after step
  function status(o, L) {
    for (const h of L.holes) if (Math.hypot(o.x - h[0], o.y - h[1]) < h[3] * 0.85) return 'swallowed';
    if (o.x < -40 || o.x > 400 || o.y < -40 || o.y > 680) return 'oob';
    if (Math.hypot(o.x - L.portal[0], o.y - L.portal[1]) < 22) return 'win';
    return null;
  }
  window.BHSim = { G, SOFT, STEP, STOP_SPEED, MAX_PULL, launchSpeed, fuelFor, prep, moonPos, dilation, accel, step, status };
})();
