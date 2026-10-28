/* Blackhole Battle v3.4.1 — L51 "Expedition" physics (prototype). Deterministic fixed step, no DOM. Separate from sim3.js:
   levels 1–50 never touch this file. Heavy piloted ship: fuel budget, throttle with spool-up, RCS attitude autopilot with
   angular inertia, gravity wells (+ tidal torque), magnets/barriers, asteroids (bounce + hull damage), moons, flares, wormhole. */
(function (root) {
  'use strict';
  const STEP = 1 / 120, TAU = Math.PI * 2, SOFT = 300;
  const K = { A_MAX: 95, SPOOL: 0.35, V_SOFT: 230, V_SOFT_K: 1.2, DAMP: 0.04, AMAX: 7, WMAX: 2.4, KP: 3.4, KD: 9,
    BURN: 2.4, RCS_BURN: 0.25, FUEL0: 100, PICK: 27, SHIP_R: 9, ROCK_E: 0.35, DMG_V: 55, DMG_K: 0.8, PLANET_CRASH_V: 90,
    LAUNCH_MIN: 40, LAUNCH_MAX: 210, PORTAL_V: 150, CP_R: 58, FUEL_R: 26, WORM_R: 30, EDGE: 40, EDGE_K: 6, RESPAWN_FUEL: 45,
    GATE_LO: 0.45, GATE_HI: 0.6, BRAKE_TAU: 0.55, BRAKE_VT: 70, RCS_T: 16, RCS_T_BURN: 0.9 };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - u * dx, py - ay - u * dy); };
  const polyD = (px, py, pl) => { let m = 1e9; for (let i = 0; i + 1 < pl.length; i++) m = Math.min(m, segD(px, py, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1])); return m; };
  const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

  // ------------------------------------------------------------------ map (world units, y down)
  function build() {
    const W = 2600, H = 1800, rocks = [], R = rng(51051);
    const ok = (x, y, r, pad) => rocks.every(o => Math.hypot(o.x - x, o.y - y) > o.r + r + pad);
    const add = (x, y, r, kind, drift) => { const q = { x0: x, y0: y, x, y, vx: 0, vy: 0, r, kind, seed: Math.floor(R() * 997) / 997, spin: (R() - .5) * .5,
      ax: drift ? (R() - .5) * 2 * drift : 0, ay: drift ? (R() - .5) * 2 * drift : 0, per: 9 + R() * 12, ph: R() * TAU, tone: R() }; rocks.push(q); return q; };
    // field: rocks packed in a box, keeping clear corridors (polylines) of half-width hw
    const field = (x0, x1, y0, y1, n, rmin, rmax, gaps, hw, drift, tries) => { for (let k = 0, put = 0; k < (tries || 6000) && put < n; k++) {
      const r = rmin + Math.pow(R(), 1.6) * (rmax - rmin), x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
      if (gaps.some(g => polyD(x, y, g) < hw + r)) continue; if (!ok(x, y, r, 3)) continue; add(x, y, r, 'rock', drift); put++; } };
    const ridge = (x0, x1, y, rmin, rmax) => { for (let x = x0; x <= x1;) { const r = rmin + R() * (rmax - rmin); add(x, y + (R() - .5) * 34, r, 'ridge', 0); x += r * (1.05 + R() * .35); } };
    // ridges separate the three rows (ridge1 leaves the right side open for the gravity-assist climb; ridge2 is closed: wormhole)
    ridge(-20, 2070, 1230, 30, 50); ridge(-20, 2620, 700, 30, 50);
    const GAP_A = [[[880, 1385], [1010, 1330], [1110, 1395], [1260, 1420]], [[880, 1650], [1020, 1715], [1130, 1640], [1260, 1610]]];
    field(915, 1225, 1262, 1795, 60, 11, 34, GAP_A, 40, 7);
    const GAP_C = [[[1620, 175], [1730, 250], [1850, 190], [1990, 260]], [[1620, 560], [1760, 470], [1880, 545], [1990, 470]]];
    field(1655, 1955, 20, 660, 46, 10, 30, GAP_C, 38, 9);
    // a few loose rocks for texture (kept off the route)
    for (const [x, y, r] of [[300, 1320, 22], [1990, 1690, 26], [2520, 1720, 30], [2560, 1040, 18], [600, 1120, 20], [1980, 820, 24], [140, 560, 26], [900, 80, 20], [2300, 620, 22], [2560, 120, 28]]) add(x, y, r, 'rock', 4);
    return {
      id: 'expedition-01', W, H, rocks, gapA: GAP_A, gapC: GAP_C,
      start: { x: 170, y: 1580, a: 0 },
      cps: [{ x: 520, y: 1500, a: 0 }, { x: 1385, y: 1470, a: 0 }, { x: 2380, y: 980, a: Math.PI }, { x: 940, y: 950, a: Math.PI }, { x: 470, y: 420, a: 0 }, { x: 2110, y: 380, a: 0 }],
      fuel: [{ x: 760, y: 1600 }, { x: 1600, y: 1345 }, { x: 680, y: 1060 }, { x: 1530, y: 560 }, { x: 2250, y: 520 }],
      holes: [{ x: 2250, y: 1460, gm: 1.3e6, rs: 24, disk: 1 }, { x: 1250, y: 330, gm: 2.0e6, rs: 32, disk: 1.25 }],
      whites: [{ x: 2010, y: 1010, gm: 7e5, r: 20 }],
      planets: [{ x: 1720, y: 1610, r: 54, gm: 4e5, moons: [{ d: 122, r: 17, per: 9, ph: 0.6 }, { d: 188, r: 20, per: -14, ph: 2.6 }] }],
      magnets: [{ x: 1670, y: 800, pol: 1, k: 4e5 }, { x: 1450, y: 1100, pol: -1, k: 4e5 }],
      barriers: [{ x: 1790, y0: 600, y1: 1290, pol: 1 }, { x: 1565, y0: 600, y1: 1290, pol: -1 }, { x: 1340, y0: 600, y1: 1290, pol: 1 }],
      flares: [{ x: 1085, y0: 600, y1: 1290, w: 64, per: 3.6, on: 1.25, ph: 0 }],
      worm: { x: 250, y: 930, ex: 320, ey: 430, ea: 0 },
      portal: { x: 2440, y: 340, r: 46 },
      star: { x: -0.62, y: -0.55 } // key-light direction (towards the star), screen/world space
    };
  }
  function rockAt(o, t) { const w = TAU / o.per; o.x = o.x0 + o.ax * Math.sin(w * t + o.ph); o.y = o.y0 + o.ay * Math.cos(w * t + o.ph); o.vx = o.ax * w * Math.cos(w * t + o.ph); o.vy = -o.ay * w * Math.sin(w * t + o.ph); }
  function moonPos(p, m, t) { const a = m.ph + TAU * t / m.per; return [p.x + Math.cos(a) * m.d, p.y + Math.sin(a) * m.d * .92, -Math.sin(a) * m.d * TAU / m.per, Math.cos(a) * m.d * .92 * TAU / m.per]; }
  const flareOn = (f, t) => ((t + f.ph) % f.per + f.per) % f.per < f.on;
  const flarePhase = (f, t) => (((t + f.ph) % f.per + f.per) % f.per) / f.per;

  function newShip(M, at) { const p = at || M.start; return { x: p.x, y: p.y, vx: 0, vy: 0, ang: p.a, w: 0, thr: 0, fuel: K.FUEL0, hull: 100, pol: 1, alive: true, docked: true, cp: -1, cpFuel: K.FUEL0,
    t: 0, won: false, cause: '', rcs: 0, rcsSide: 0, ext: 0, gx: 0, gy: 0, picked: [], wormCD: 0, tooFast: 0, prox: 0 }; }
  function launch(s, ang, k) { if (!s.docked || !s.alive) return; k = Math.max(0, Math.min(1, k)); const v = K.LAUNCH_MIN + (K.LAUNCH_MAX - K.LAUNCH_MIN) * k; s.vx = Math.cos(ang) * v; s.vy = Math.sin(ang) * v; s.ang = ang; s.w = 0; s.docked = false; }
  function gravity(M, s, x, y) { let ax = 0, ay = 0, tq = 0, prox = 0;
    for (const h of M.holes) { const dx = h.x - x, dy = h.y - y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2), f = h.gm / (r2 + SOFT); ax += f * dx / r; ay += f * dy / r;
      tq += -1.5 * h.gm / (r2 * r + 4e4) * Math.sin(2 * wrap(s.ang - Math.atan2(dy, dx))) * .6; prox = Math.max(prox, Math.min(1, (h.rs * 9) / Math.max(r, 1) - .6)); }
    for (const h of M.whites) { const dx = h.x - x, dy = h.y - y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2), f = h.gm / (r2 + 2000); ax -= f * dx / r; ay -= f * dy / r; }
    for (const p of M.planets) { const dx = p.x - x, dy = p.y - y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2), f = p.gm / (r2 + SOFT); ax += f * dx / r; ay += f * dy / r; }
    for (const m of M.magnets) { const dx = m.x - x, dy = m.y - y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2), f = m.k / (r2 + 900) * (m.pol === s.pol ? -1 : 1); ax += f * dx / r; ay += f * dy / r; }
    return [ax, ay, tq, Math.max(0, prox)]; }
  function die(s, cause, ev) { if (!s.alive) return; s.alive = false; s.cause = cause; ev.push({ e: 'die', cause, x: s.x, y: s.y }); }
  // in: { head: wanted heading (rad) | null, turn: -1..1 manual rate (keyboard), thr: 0..1 throttle lever, flip: bool }
  function step(M, s, inp, ev) {
    ev = ev || []; const dt = STEP; s.t += dt; const t = s.t;
    for (const o of M.rocks) if (o.ax || o.ay) rockAt(o, t);
    if (!s.alive || s.won) return ev;
    if (inp.flip) { s.pol = -s.pol; ev.push({ e: 'flip', pol: s.pol }); }
    if (s.docked) { s.thr = 0; s.rcs = 0; return ev; }
    const [gx, gy, tq, prox] = gravity(M, s, s.x, s.y); s.gx = gx; s.gy = gy; s.prox = prox;
    // attitude: PD autopilot -> commanded angular accel; RCS supplies (cmd - external torque), clamped
    // 3.4.1 input: dir/k = one-finger vector (nose follows, engine gated to ~30deg); brake = autopilot velocity-kill (retro-burn + RCS translation)
    let head = inp.head, thrIn = inp.thr || 0, tax = 0, tay = 0; s.brk = 0; s.rcsT = 0;
    const gate = e => Math.max(0, Math.min(1, (K.GATE_HI - Math.abs(e)) / (K.GATE_HI - K.GATE_LO)));
    if (inp.brake) { s.brk = 1; const vt = inp.dir != null ? K.BRAKE_VT * Math.max(0, Math.min(1, inp.k || 0)) : 0, tvx = vt ? Math.cos(inp.dir) * vt : 0, tvy = vt ? Math.sin(inp.dir) * vt : 0;
      const Dx = (tvx - s.vx) / K.BRAKE_TAU - gx, Dy = (tvy - s.vy) / K.BRAKE_TAU - gy, Dm = Math.hypot(Dx, Dy); head = null; thrIn = 0;
      if (Dm > .5) { let g = 0; if (Dm > 14) { head = Math.atan2(Dy, Dx); g = gate(wrap(head - s.ang)); thrIn = Math.min(1, Dm / K.A_MAX) * g; }
        const r = Math.min(K.RCS_T, Dm) * (1 - g); if (s.fuel > 0 && r > 0) { tax = Dx / Dm * r; tay = Dy / Dm * r; s.rcsT = r / K.RCS_T; } } }
    else if (inp.dir != null) { head = inp.dir; thrIn = Math.max(0, Math.min(1, inp.k || 0)) * gate(wrap(inp.dir - s.ang)); }
    let wd = 0; if (head != null) wd = Math.max(-K.WMAX, Math.min(K.WMAX, wrap(head - s.ang) * K.KP)); else if (inp.turn) wd = inp.turn * K.WMAX;
    let need = (wd - s.w) * K.KD - tq, rcs = Math.max(-K.AMAX, Math.min(K.AMAX, need));
    if (s.fuel <= 0 && Math.abs(rcs) > K.AMAX * .35) rcs = Math.sign(rcs) * K.AMAX * .35; // reserve cold gas: weak but never zero
    s.w += (rcs + tq) * dt; s.ang = wrap(s.ang + s.w * dt); s.rcs = Math.abs(rcs) / K.AMAX; s.rcsSide = Math.sign(rcs); s.ext = Math.abs(tq);
    // main engine with spool-up (heavy feel)
    const tgt = s.fuel > 0 ? Math.max(0, Math.min(1, thrIn)) : 0; s.thr += (tgt - s.thr) * (1 - Math.exp(-dt / K.SPOOL));
    const a = s.thr * K.A_MAX; let ax = gx + Math.cos(s.ang) * a + tax, ay = gy + Math.sin(s.ang) * a + tay;
    if (s.fuel > 0) { s.fuel = Math.max(0, s.fuel - (s.thr * K.BURN + s.rcs * K.RCS_BURN + s.rcsT * K.RCS_T_BURN) * dt); if (s.fuel === 0) ev.push({ e: 'empty' }); }
    // soft map edge (force field, no death)
    const E = K.EDGE; if (s.x < E) ax += (E - s.x) * K.EDGE_K; if (s.x > M.W - E) ax -= (s.x - M.W + E) * K.EDGE_K; if (s.y < E) ay += (E - s.y) * K.EDGE_K; if (s.y > M.H - E) ay -= (s.y - M.H + E) * K.EDGE_K;
    s.vx += ax * dt; s.vy += ay * dt; let sp = Math.hypot(s.vx, s.vy);
    let damp = K.DAMP; if (sp > K.V_SOFT) damp += (sp - K.V_SOFT) / sp * K.V_SOFT_K; const f = Math.max(0, 1 - damp * dt); s.vx *= f; s.vy *= f;
    const px = s.x; s.x += s.vx * dt; s.y += s.vy * dt; sp = Math.hypot(s.vx, s.vy);
    // collisions: rocks (bounce + damage)
    const SR = K.SHIP_R;
    for (const o of M.rocks) { const dx = s.x - o.x, dy = s.y - o.y, d = Math.hypot(dx, dy), m = o.r * .92 + SR; if (d >= m) continue;
      const nx = dx / d, ny = dy / d, rvx = s.vx - o.vx, rvy = s.vy - o.vy, vn = rvx * nx + rvy * ny; s.x = o.x + nx * m; s.y = o.y + ny * m;
      if (vn < 0) { s.vx -= (1 + K.ROCK_E) * vn * nx; s.vy -= (1 + K.ROCK_E) * vn * ny; s.vx *= .9; s.vy *= .9; s.w += vn * .01 * (nx * Math.sin(s.ang) - ny * Math.cos(s.ang));
        const dmg = -vn > K.DMG_V ? (-vn - K.DMG_V) * K.DMG_K : 0; if (dmg > 0) s.hull = Math.max(0, s.hull - dmg); ev.push({ e: 'hit', x: s.x - nx * SR, y: s.y - ny * SR, v: -vn, dmg });
        if (s.hull <= 0) { die(s, 'hull', ev); return ev; } } }
    for (const p of M.planets) { const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy), m = p.r + SR;
      if (d < m) { const nx = dx / d, ny = dy / d, vn = s.vx * nx + s.vy * ny; if (-vn > K.PLANET_CRASH_V) { die(s, 'planet', ev); return ev; } s.x = p.x + nx * m; s.y = p.y + ny * m; if (vn < 0) { s.vx -= 1.3 * vn * nx; s.vy -= 1.3 * vn * ny; } ev.push({ e: 'hit', x: s.x, y: s.y, v: -vn, dmg: 0 }); }
      for (const mo of p.moons) { const [mx, my] = moonPos(p, mo, t); if (Math.hypot(s.x - mx, s.y - my) < mo.r + SR) { die(s, 'moon', ev); return ev; } } }
    for (const h of M.holes) if (Math.hypot(s.x - h.x, s.y - h.y) < h.rs * .85) { die(s, 'hole', ev); return ev; }
    for (const b of M.barriers) { if (s.y < b.y0 || s.y > b.y1) continue; const crossed = (px - b.x) * (s.x - b.x) <= 0 || Math.abs(s.x - b.x) < SR;
      if (crossed && b.pol !== s.pol) { const side = Math.sign(px - b.x) || -Math.sign(s.vx) || 1; s.x = b.x + side * (SR + 1); if ((s.vx > 0) === (side < 0)) s.vx = -s.vx * .55; ev.push({ e: 'zap', x: b.x, y: s.y, pol: b.pol }); } }
    for (const fl of M.flares) if (flareOn(fl, t) && Math.abs(s.x - fl.x) < fl.w / 2 + SR * .5 && s.y > fl.y0 && s.y < fl.y1) { die(s, 'flare', ev); return ev; }
    // pickups, checkpoints, wormhole, portal
    M.fuel.forEach((u, i) => { if (s.picked.indexOf(i) < 0 && Math.hypot(s.x - u.x, s.y - u.y) < K.FUEL_R + SR) { s.picked.push(i); s.fuel = Math.min(K.FUEL0, s.fuel + K.PICK); ev.push({ e: 'fuel', i, x: u.x, y: u.y }); } });
    M.cps.forEach((c, i) => { if (i > s.cp && Math.hypot(s.x - c.x, s.y - c.y) < K.CP_R) { s.cp = i; s.cpFuel = s.fuel; s.cpPicked = s.picked.slice(); ev.push({ e: 'cp', i, x: c.x, y: c.y }); } });
    const wm = M.worm; if (s.wormCD > 0) s.wormCD -= dt; else if (Math.hypot(s.x - wm.x, s.y - wm.y) < K.WORM_R) { const v = Math.min(140, Math.max(60, sp)); s.x = wm.ex; s.y = wm.ey; s.vx = Math.cos(wm.ea) * v; s.vy = Math.sin(wm.ea) * v; s.ang = wm.ea; s.w = 0; s.wormCD = 1.5; ev.push({ e: 'worm' }); }
    const P = M.portal, pd = Math.hypot(s.x - P.x, s.y - P.y); if (pd < P.r) { if (sp < K.PORTAL_V) { s.won = true; ev.push({ e: 'win' }); } else if (s.tooFast <= 0) { s.tooFast = 1.2; ev.push({ e: 'fast' }); } }
    if (s.tooFast > 0) s.tooFast -= dt;
    return ev;
  }
  // respawn at the last checkpoint (or the start): at rest, docked for a fresh slingshot launch
  function respawn(M, s) { const c = s.cp >= 0 ? M.cps[s.cp] : M.start, n = newShip(M, c); n.cp = s.cp; n.t = s.t; n.pol = s.pol;
    n.fuel = s.cp >= 0 ? Math.max(s.cpFuel, K.RESPAWN_FUEL) : K.FUEL0; n.cpFuel = s.cpFuel; n.picked = (s.cp >= 0 ? s.cpPicked || [] : []).slice(); n.cpPicked = n.picked.slice(); n.deaths = (s.deaths || 0) + 1; return n; }
  function nextGoal(M, s) { return s.cp + 1 < M.cps.length ? M.cps[s.cp + 1] : M.portal; }

  // scripted pilot (tests + attract/demo): waypoint pursuit with velocity-error steering, gravity compensation, flare timing, polarity
  const ROUTE = [[520, 1500, 120], [700, 1580, 110], [760, 1600, 100], [860, 1405, 70], [1010, 1330, 65], [1110, 1395, 65], [1260, 1420, 80], [1385, 1470, 110],
    [1600, 1345, 110], [1800, 1350, 120], [2050, 1340, 130], [2400, 1330, 110], [2430, 1150, 100], [2380, 980, 90], [2200, 900, 90], [2000, 900, 90],
    [1850, 950, 80, 0, 1], [1700, 950, 80, 0, -1], [1620, 950, 80, 0, -1], [1450, 950, 80, 0, 1], [1260, 950, 60], [1195, 950, 0, 'flare'], [1000, 950, 170], [940, 950, 110],
    [680, 1060, 100], [450, 980, 100], [250, 930, 90], [470, 420, 110], [800, 560, 130], [1150, 590, 120], [1530, 560, 110], [1620, 560, 70], [1760, 470, 65], [1880, 545, 65],
    [1990, 470, 80], [2110, 380, 90], [2300, 350, 70], [2440, 340, 40]];
  function bot(M, s0) { let i = 0, wait = 0, flipQ = 0; const route = ROUTE.map(r => ({ x: r[0], y: r[1], v: r[2], tag: r[3], pol: r[4] }));
    if (s0 && s0.cp >= 0) { const c = M.cps[s0.cp]; i = route.findIndex(r => Math.hypot(r.x - c.x, r.y - c.y) < 40) + 1; }
    return function (s) { const inp = { dir: null, k: 0, brake: false, flip: false };
      if (s.docked) return inp; while (i < route.length - 1 && Math.hypot(s.x - route[i].x, s.y - route[i].y) < (route[i].tag === 'flare' ? 14 : 34)) {
        if (route[i].tag === 'flare') { const f = M.flares[0], ph = flarePhase(f, s.t); if (!(ph > f.on / f.per + .02 && ph < f.on / f.per + .12)) break; } i++; }
      const w = route[i], dx = w.x - s.x, dy = w.y - s.y, d = Math.hypot(dx, dy) || 1;
      // polarity: match the next barrier we are approaching
      for (const b of M.barriers) if (Math.abs(s.x - b.x) < 120 && s.y > b.y0 && s.y < b.y1 && b.pol !== s.pol && (s.vx <= 0 ? s.x > b.x : s.x < b.x)) { inp.flip = !flipQ; flipQ = 1; break; }
      if (!inp.flip) flipQ = 0;
      if (w.tag === 'flare' && d < 30) { const n = route[i + 1]; inp.dir = Math.atan2(n.y - s.y, n.x - s.x); inp.k = 0; return inp; }
      const vt = Math.min(w.v || 0, Math.sqrt(2 * 45 * d) + (w.v ? 0 : 0)), vdx = dx / d * vt, vdy = dy / d * vt;
      let ex = (vdx - s.vx) * 1.4 - s.gx * .9, ey = (vdy - s.vy) * 1.4 - s.gy * .9; if (w.v === 0 || i === route.length - 1) { ex = (dx * 1.2 - s.vx * 2) - s.gx; ey = (dy * 1.2 - s.vy * 2) - s.gy; }
      const em = Math.hypot(ex, ey); if (em < 4) return inp; inp.dir = Math.atan2(ey, ex); inp.k = Math.cos(wrap(inp.dir - s.ang)) > .8 ? Math.min(1, em / 70) : 0;
      // way too fast for this leg (e.g. after a slingshot): hold the brake like a player would
      const sp = Math.hypot(s.vx, s.vy); if (w.v && sp > w.v + 70 && (s.vx * dx + s.vy * dy) / d < sp * .6) inp.brake = true; return inp; }; }
  root.BHSim51 = { STEP, K, build, newShip, launch, step, respawn, gravity, moonPos, flareOn, flarePhase, rockAt, nextGoal, wrap, bot, ROUTE };
})(typeof window !== 'undefined' ? window : globalThis);
