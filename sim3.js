// Blackhole Battle v3 deterministic simulation (shared by game + headless solver)
(function (root) {
  const G = 120, SOFT = 300, MAX_SPEED = 560, STEP = 1 / 120, STOP_SPEED = 14, MAX_PULL = 110;
  const launchSpeed = p => 50 + p * 2.6;            // p = pull 0..110
  const fuelFor = L => L.stops * 1.35 + 0.25;
  const KILL = 1.35;
  const MU = { planet: 0.14, rock: 0.09, metal: 0.05 }; // v3.3.1: per-level scale L.muK (ricochet levels play with slicker surfaces) // v3.3.0 tangential (Coulomb) friction per surface                                 // event horizon kill radius = r*KILL
  const LIST = ['holes', 'whites', 'planets', 'moons', 'asteroids', 'worms', 'fields', 'flares', 'gates', 'keys', 'magnets', 'stars'];
  function prep(src) {
    const L = JSON.parse(JSON.stringify(src));
    for (const k of LIST) L[k] = L[k] || [];
    L.W = L.W || 360; L.H = L.H || 640; L.pr = L.pr || 22;
    return L;
  }
  function newShip(L) { return { x: L.ship[0], y: L.ship[1], vx: 0, vy: 0, t: 0, fuel: fuelFor(L), broken: 0, keys: 0, flip: 1, wcd: 0 }; }
  function holePos(h, t) {
    if (h.bin) { const b = h.bin, a = b.w * t + b.ph; return [b.cx + Math.cos(a) * b.R, b.cy + Math.sin(a) * b.R]; }
    return [h.x, h.y];
  }
  function holeMass(h, t) { return h.pulse ? h.m * (1 + h.pulse.a * Math.sin(h.pulse.w * t + (h.pulse.ph || 0))) : h.m; }
  function moonPos(m, t) {
    const a = m.w * t + m.ph, ex = Math.cos(a) * m.a, ey = Math.sin(a) * m.b, c = Math.cos(m.rot || 0), s = Math.sin(m.rot || 0);
    return [m.cx + ex * c - ey * s, m.cy + ex * s + ey * c];
  }
  function flareOn(f, t) { return ((t + (f.ph || 0)) % f.period + f.period) % f.period < f.on; }
  function dilation(x, y, L, t) {
    let tf = 1;
    for (const h of L.holes) { const [hx, hy] = holePos(h, t); const d = Math.hypot(x - hx, y - hy), rs = h.r * 2.4;
      const q = Math.sqrt(Math.max(0.01, 1 - rs / Math.max(d, rs))); tf = Math.min(tf, 0.12 + 0.88 * q * q); }
    return tf;
  }
  function accel(o, L) {
    let ax = 0, ay = 0; const x = o.x, y = o.y, t = o.t;
    const add = (sx, sy, m) => { const dx = sx - x, dy = sy - y, r2 = dx * dx + dy * dy + SOFT, r = Math.sqrt(r2); const f = G * m / r2; ax += f * dx / r; ay += f * dy / r; };
    for (const h of L.holes) { const [hx, hy] = holePos(h, t); add(hx, hy, holeMass(h, t)); }
    for (const w of L.whites) add(w[0], w[1], -w[2]);
    for (const p of L.planets) if (p[3]) add(p[0], p[1], p[3]);
    for (const m of L.magnets) { const d = Math.hypot(m[0] - x, m[1] - y); if (d < m[3]) add(m[0], m[1], m[2] * (m[4] || 1) * o.flip * (1 + 2 * (1 - d / m[3]))); }
    for (const f of L.fields) if (x > f[0] && x < f[0] + f[2] && y > f[1] && y < f[1] + f[3]) { ax += f[4] * f[6]; ay += f[5] * f[6]; }
    return [ax, ay];
  }
  // v3.3.0 contact response: restitution drops a little for hard hits; Coulomb friction scrubs the tangential speed in proportion to the
  // normal impulse (glancing hits keep almost all their speed, head-on hits lose more and pick up spin). Returns impact info for FX.
  function respond(o, nx, ny, rest, mu, wx, wy) {
    const vn = o.vx * nx + o.vy * ny; if (vn >= 0) return { x: wx, y: wy, nx, ny, vn: 0, vt: 0, spin: 0 };
    const e = rest - 0.12 * Math.min(1, -vn / 420), jn = -(1 + e) * vn; o.vx += jn * nx; o.vy += jn * ny;
    const tx = -ny, ty = nx, vt = o.vx * tx + o.vy * ty, dvt = Math.min(Math.abs(vt), mu * jn) * Math.sign(vt);
    o.vx -= dvt * tx; o.vy -= dvt * ty;
    return { x: wx, y: wy, nx, ny, vn: -vn, vt, spin: dvt };
  }
  function bounceCircle(o, cx, cy, r, rest, mu) {
    const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy), R = r + 7;
    if (d >= R || d === 0) return null;
    const nx = dx / d, ny = dy / d; o.x = cx + nx * (R + 0.5); o.y = cy + ny * (R + 0.5);
    return respond(o, nx, ny, rest, mu || 0, cx + nx * r, cy + ny * r);
  }
  function hitRect(o, a) { // returns contact info or null; a=[x,y,w,h,ang]
    const c = Math.cos(-a[4]), s = Math.sin(-a[4]);
    const lx = (o.x - a[0]) * c - (o.y - a[1]) * s, ly = (o.x - a[0]) * s + (o.y - a[1]) * c;
    const hw = a[2] / 2, hh = a[3] / 2, nxl = Math.max(-hw, Math.min(lx, hw)), nyl = Math.max(-hh, Math.min(ly, hh));
    let dx = lx - nxl, dy = ly - nyl, d = Math.hypot(dx, dy);
    if (d >= 7) return null;
    if (d === 0) { const px = hw - Math.abs(lx), py = hh - Math.abs(ly); if (px < py) { dx = Math.sign(lx) || 1; dy = 0; } else { dx = 0; dy = Math.sign(ly) || 1; } d = 1; }
    const nx = dx / d, ny = dy / d, cb = Math.cos(a[4]), sb = Math.sin(a[4]);
    return { nx: nx * cb - ny * sb, ny: nx * sb + ny * cb, wx: nxl * cb - nyl * sb + a[0], wy: nxl * sb + nyl * cb + a[1] };
  }
  function bounceRect(o, a, rest, mu) {
    const h = hitRect(o, a); if (!h) return null;
    o.x = h.wx + h.nx * 7.5; o.y = h.wy + h.ny * 7.5;
    return respond(o, h.nx, h.ny, rest, mu || 0, h.wx, h.wy);
  }
  // one fixed step. ctl: {brake:bool}
  function step(o, L, ctl) {
    const tf = dilation(o.x, o.y, L, o.t);
    const d = STEP * (0.55 + 0.45 * tf);
    const [ax, ay] = accel(o, L);
    o.vx += ax * d; o.vy += ay * d;
    if (ctl && ctl.brake && o.fuel > 0) { const k = Math.pow(0.06, d); o.vx *= k; o.vy *= k; o.fuel = Math.max(0, o.fuel - STEP); }
    const sp = Math.hypot(o.vx, o.vy); if (sp > MAX_SPEED) { o.vx *= MAX_SPEED / sp; o.vy *= MAX_SPEED / sp; }
    o.x += o.vx * d; o.y += o.vy * d; o.t += d; if (o.wcd > 0) o.wcd -= d;
    const ev = { tf, bounce: false, broke: -1, worm: false, key: -1, hit: null };
    let h;
    for (const p of L.planets) if ((h = bounceCircle(o, p[0], p[1], p[2], 0.8, MU.planet * (L.muK ?? 1)))) { ev.bounce = true; h.kind = 'planet'; ev.hit = h; }
    for (let i = 0; i < L.asteroids.length; i++) {
      const a = L.asteroids[i]; if (a[5] && (o.broken >> i) & 1) continue;
      if ((h = bounceRect(o, a, 0.92, MU.rock * (L.muK ?? 1)))) { ev.bounce = true; h.kind = a[5] ? 'frag' : 'rock'; h.i = i; ev.hit = h; if (a[5]) { o.broken |= 1 << i; ev.broke = i; } }
    }
    for (const g of L.gates) if (!((o.keys >> g[5]) & 1) && (h = bounceRect(o, g, 0.9, MU.metal * (L.muK ?? 1)))) { ev.bounce = true; h.kind = 'metal'; ev.hit = h; }
    for (let i = 0; i < L.keys.length; i++) if (!((o.keys >> i) & 1) && Math.hypot(o.x - L.keys[i][0], o.y - L.keys[i][1]) < 20) { o.keys |= 1 << i; ev.key = i; }
    if (o.wcd <= 0) for (const w of L.worms) for (const [A, B] of [[w.a, w.b], [w.b, w.a]]) {
      if (Math.hypot(o.x - A[0], o.y - A[1]) < (w.r || 16)) {
        const rot = B[2] - A[2] + Math.PI, c = Math.cos(rot), s = Math.sin(rot);
        const vx = o.vx * c - o.vy * s, vy = o.vx * s + o.vy * c; o.vx = vx; o.vy = vy;
        const sp2 = Math.hypot(vx, vy) || 1; o.x = B[0] + vx / sp2 * ((w.r || 16) + 6); o.y = B[1] + vy / sp2 * ((w.r || 16) + 6);
        o.wcd = 0.35; ev.worm = true; break;
      }
    }
    return ev;
  }
  function status(o, L) {
    for (const h of L.holes) { const [hx, hy] = holePos(h, o.t); if (Math.hypot(o.x - hx, o.y - hy) < h.r * KILL) return 'swallowed'; }
    for (const m of L.moons) { const [mx, my] = moonPos(m, o.t); if (Math.hypot(o.x - mx, o.y - my) < m.r + 6) return 'moon'; }
    for (const f of L.flares) if (flareOn(f, o.t) && o.x > f.x && o.x < f.x + f.w && o.y > f.y && o.y < f.y + f.h) return 'flare';
    if (o.x < -40 || o.x > L.W + 40 || o.y < -40 || o.y > L.H + 40) return 'oob';
    if (Math.hypot(o.x - L.portal[0], o.y - L.portal[1]) < L.pr) return 'win';
    return null;
  }

  // Orbit-trap detector (v3.1.3). Pure helper, never alters the simulation: true while the ship has swept more than
  // TRAP_REV full turns around one attractor (hole / massive planet) without getting >25px closer to the portal,
  // or no such progress at all for TRAP_NOPROG seconds (wide eccentric loops).
  const TRAP_REV = 2, TRAP_SECS = 7, TRAP_NOPROG = 10;
  function trapNew(o, L) { return { k: -1, last: 0, ang: 0, np: 0, best: Math.hypot(o.x - L.portal[0], o.y - L.portal[1]) }; }
  function trapStep(tr, o, L) {
    let k = -1, bx = 0, by = 0, bd = 1e9;
    L.holes.forEach((h, i) => { const [x, y] = holePos(h, o.t), d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; bx = x; by = y; k = i; } });
    L.planets.forEach((p, i) => { if (!p[3]) return; const d = Math.hypot(o.x - p[0], o.y - p[1]); if (d < bd) { bd = d; bx = p[0]; by = p[1]; k = 100 + i; } });
    const pd = Math.hypot(o.x - L.portal[0], o.y - L.portal[1]);
    if (pd < tr.best - 25) { tr.best = pd; tr.ang = 0; tr.np = 0; } else tr.np++;
    const stale = tr.np * STEP > TRAP_NOPROG; // no real progress toward the portal for 10 s
    if (k < 0) return stale;
    const a = Math.atan2(o.y - by, o.x - bx);
    if (k !== tr.k) { tr.k = k; tr.ang = 0; tr.last = a; return stale; }
    let da = a - tr.last; if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
    tr.last = a; tr.ang += da;
    return stale || Math.abs(tr.ang) > TRAP_REV * 2 * Math.PI;
  }
  root.BHSim = { G, SOFT, STEP, STOP_SPEED, MAX_PULL, KILL, launchSpeed, fuelFor, MU, prep, newShip, holePos, holeMass, moonPos, flareOn, dilation, accel, step, status, hitRect, TRAP_REV, TRAP_SECS, TRAP_NOPROG, trapNew, trapStep };
})(typeof window !== 'undefined' ? window : globalThis);
