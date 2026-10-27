/* Blackhole Battle v3.4.0 — stage 2: visuals, sound, progress (gameplay/physics unchanged from v3.0) */
(() => {
'use strict';
const S = window.BHSim;
const LEVELS = window.BH3_LEVELS || window.BH3_SRC;
const CAT = window.BHCat.build(LEVELS), SECTORS = CAT.sectors, LID = i => CAT.idOf[i]; window.BHProg.setCatalog(CAT);
const T = (k, v) => I18N.t(k, v);
const PU = {}; for (const [k, i] of [['extra', '🚀'], ['scan', '📡'], ['shield', '🛡'], ['slow', '⏳']]) PU[k] = { i, get n() { return T('pu.' + k); } };
const $ = id => document.getElementById(id);
const cv = $('c'), octx = cv.getContext('2d'); let ctx = octx;
const sc = document.createElement('canvas'), sctx = sc.getContext('2d');
const glc = $('gl'), GFX = window.BHGfx;
let useGL = !!(GFX && glc && !/[?&]nogl/.test(location.search) && GFX.init(glc));
const NOOP = () => {}; const AU = window.BHAudio || { unlock: NOOP, configure: NOOP, update: NOOP, aimStart: NOOP, aimPower: NOOP, aimEnd: NOOP, launch: NOOP, bounce: NOOP, star: NOOP, win: NOOP, lose: NOOP, magnet: NOOP, key: NOOP, worm: NOOP, stop: NOOP, crash: NOOP, shield: NOOP, click: NOOP, ach: NOOP };
const PR = window.BHProg;
let W, H, DPR, SC, OX, OY, camWY = 0, Z = 1, camCX = 180, camCY = 320, QS = 1, BGS = 1, qLevel = 1, autoQ = 1, autoUp = 0, fpsT = 0, fpsN = 0;
const X = x => OX + (180 + (x - camCX) * Z) * SC, Y = y => OY + (320 + (y - camCY) * Z) * SC, R = v => v * SC * Z;
const SHIPS = window.BHShips; let shipFX = { bank: 0, pa: null, sqT: 9, wheel: 0, death: null, win: null, spinA: 0, spinV: 0 }; // v3.2.0 visual-only ship state
const glowCache = new Map(); let lenses = [], planetCache = {}, fl = { bounces: 0, margin: 1e9 }, cpK = 0, proxK = 0;
const QN = { get 0() { return T('q.0'); }, get 1() { return T('q.1'); }, get 2() { return T('q.2'); } };
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// ---------- save ----------
const KEY = 'bh_v3';
let save; try { save = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { save = null; }
save = Object.assign({ unlocked: 1, best: {}, tut: {}, pu: { extra: 0, scan: 0, shield: 0, slow: 0 }, streak: 0, ach: {}, set: {} }, save || {});
save.set = Object.assign({ vib: true, snd: true, sfx: 80, mus: 60, musOn: true, ship: 'shuttle', aim: 'sling', q: 'auto', facts: 'win' }, save.set || {}); PR.ensure(save);
save.facts = save.facts || {}; save.lfail = save.lfail || {}; save.hintOk = save.hintOk || {}; /* per-level failures + earned 'ideal path' hints */ I18N.set(save.set.lang); const FACTS = window.BH_FACTS || {}; const lvName = i => I18N.lvName(LID(i), LEVELS[i].n);
const isOpen = i => CAT.levelOpen(save, i), bestOf = i => save.best[LID(i)];
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
if (CAT.migrate(save)) persist();
{ let ch = 0; for (const id in save.best) if (FACTS[id] && !save.facts[id]) { save.facts[id] = { t: 0, s3: save.best[id].s === 3 ? 1 : 0 }; ch = 1; } if (ch) persist(); } // facts for already-beaten levels
const puTotal = () => Object.values(save.pu).reduce((a, b) => a + b, 0);

// ---------- haptics ----------
const AH = window.AndroidHaptics;
function vib(ms, amp) { if (!save.set.vib) return; try { if (AH) AH.vibrate(ms, amp); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
function vibP(t, a) { if (!save.set.vib) return; try { if (AH) AH.pattern(t.join(','), a.join(',')); else if (navigator.vibrate) navigator.vibrate(t.slice(1)); } catch (e) {} }
const HAP = {
  tick: () => vib(8, 28), launch: () => vib(38, 80), bounce: () => vib(10, 55), magnet: () => vibP([0, 18, 40, 18], [0, 70, 0, 45]),
  star: () => vibP([0, 12, 60, 12], [0, 70, 0, 70]), death: () => vib(360, 110), stop: () => vib(20, 50), key: () => vibP([0, 10, 40, 10, 40, 16], [0, 60, 0, 60, 0, 90]),
  heart: k => vibP([0, 14, 95, 10], [0, Math.round(25 + 55 * k), 0, Math.round(15 + 40 * k)])
};

// ---------- background ----------
let bg = null, layers = [], twinkles = [];
// ---------- painted procedural space (Space-Rangers-like): fbm nebulae, dust lanes, far galaxies/suns/planets, parallax, dust, comets ----------
const PAL = [ // per sector: base, nebula A, nebula B, highlight, dust tint
  { base: ['#05030f', '#0b0626', '#03020a'], a: [124, 58, 237], b: [37, 99, 235], h: [94, 234, 212], d: [167, 139, 250] },   // 1 Пояс Кеплера
  { base: ['#020812', '#06182a', '#02050a'], a: [14, 165, 233], b: [20, 184, 166], h: [253, 224, 71], d: [125, 211, 252] },  // 2 Місяці Гіганта
  { base: ['#0d0310', '#22061f', '#06020a'], a: [219, 39, 119], b: [79, 70, 229], h: [251, 113, 133], d: [244, 114, 182] },  // 3 Магнітар
  { base: ['#020c0a', '#04201a', '#020806'], a: [16, 185, 129], b: [124, 58, 237], h: [167, 243, 208], d: [110, 231, 183] },  // 4 Кротові нори
  { base: ['#0f0503', '#2a0a06', '#080203'], a: [234, 88, 12], b: [190, 18, 60], h: [253, 186, 116], d: [251, 146, 60] },    // 5 Горизонт подій
  { base: ['#06030f', '#140828', '#03020a'], a: [147, 51, 234], b: [219, 39, 119], h: [56, 189, 248], d: [196, 181, 253] },  // menu
];
let bgSet = null, bgCache = {}, bgKey = -1, dust = [], comets = [], cometT = 3;
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, s, oct) { let f = 0, amp = .5, fr = 1; for (let o = 0; o < oct; o++) { f += amp * vnoise(x * fr, y * fr, s + o * 17); fr *= 2.03; amp *= .5; } return f / (1 - Math.pow(.5, oct)); }
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function buildBGSet(key) {
  const P = PAL[key], r = rng(97 + key * 31), seed = 11 + key * 7, M = 30, BW = W + M * 2, BH = H + M * 2;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * BGS); c.height = Math.ceil(h * BGS); const x = c.getContext('2d'); x.scale(BGS, BGS); return [c, x]; };
  const [base, b] = mk(BW, BH);
  const g = b.createLinearGradient(0, 0, BW * .3, BH); g.addColorStop(0, P.base[0]); g.addColorStop(.5, P.base[1]); g.addColorStop(1, P.base[2]); b.fillStyle = g; b.fillRect(0, 0, BW, BH);
  // fbm nebula field rendered at low res, upscaled smoothly -> soft painted look
  const ds = qLevel === 0 ? 5 : 3, nw = Math.ceil(BW / ds), nh = Math.ceil(BH / ds), oct = qLevel === 0 ? 4 : 5;
  const nc = document.createElement('canvas'); nc.width = nw; nc.height = nh; const nx = nc.getContext('2d'); const id = nx.createImageData(nw, nh), D = id.data; const sc0 = 3.2 / Math.max(nw, nh);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const fx = x * sc0, fy = y * sc0; const wx = fbm(fx + 3.1, fy + 1.7, seed + 5, 3) * 1.6, wy = fbm(fx - 2.3, fy + 4.4, seed + 9, 3) * 1.6; // domain warp = swirly brush strokes
    const n1 = fbm(fx + wx, fy + wy, seed, oct), n2 = fbm(fx * 1.7 + 9, fy * 1.7 - 3, seed + 3, 4), n3 = fbm(fx * 2.4 - wx, fy * 2.4 + wy, seed + 7, 4);
    const dens = Math.pow(sstep(.38, .82, n1), 1.35), hi = sstep(.68, .92, n1) * sstep(.45, .8, n3), ridge = 1 - Math.abs(2 * n3 - 1), dark = sstep(.82, .97, ridge) * .7;
    const m = sstep(.3, .7, n2); let R0 = P.a[0] + (P.b[0] - P.a[0]) * m, G0 = P.a[1] + (P.b[1] - P.a[1]) * m, B0 = P.a[2] + (P.b[2] - P.a[2]) * m;
    R0 += (P.h[0] - R0) * hi; G0 += (P.h[1] - G0) * hi; B0 += (P.h[2] - B0) * hi;
    const al = Math.min(1, dens * .78 + hi * .5) * (1 - dark); const o = (y * nw + x) * 4; D[o] = R0; D[o + 1] = G0; D[o + 2] = B0; D[o + 3] = al * 255;
  }
  nx.putImageData(id, 0, 0); b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high'; b.drawImage(nc, 0, 0, BW, BH);
  b.globalCompositeOperation = 'screen'; b.globalAlpha = .45; b.drawImage(nc, -BW * .05, -BH * .03, BW * 1.1, BH * 1.06); b.globalAlpha = 1; // glow pass
  // brush highlights: soft bright cores
  for (let i = 0; i < 6; i++) { const x = r() * BW, y = r() * BH, rad = (40 + r() * 110); const c = [P.h, P.a, P.b][i % 3]; const hg = b.createRadialGradient(x, y, 0, x, y, rad); hg.addColorStop(0, `rgba(${c},.28)`); hg.addColorStop(1, `rgba(${c},0)`); b.fillStyle = hg; b.fillRect(0, 0, BW, BH); }
  b.globalCompositeOperation = 'source-over';
  // embedded star clusters
  for (let i = 0; i < 3; i++) { const cx = r() * BW, cy = r() * BH; for (let k = 0; k < 60; k++) { const a = r() * 6.28, d = Math.pow(r(), 2) * 50; b.fillStyle = `rgba(255,255,255,${.3 + r() * .6})`; b.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, .9, .9); } }
  // far layer: galaxies, a distant sun, a dim giant planet (all clearly background: dim, no gameplay meaning)
  const [far, f] = mk(BW, BH);
  for (let i = 0; i < 2 + (qLevel > 0 ? 1 : 0); i++) { const gx = r() * BW, gy = r() * BH, gr = 14 + r() * 26, rot = r() * 3.14, tilt = .3 + r() * .5;
    f.save(); f.translate(gx, gy); f.rotate(rot); f.scale(1, tilt); const cg = f.createRadialGradient(0, 0, 0, 0, 0, gr * .5); cg.addColorStop(0, 'rgba(255,248,230,.85)'); cg.addColorStop(1, 'rgba(255,248,230,0)'); f.fillStyle = cg; f.beginPath(); f.arc(0, 0, gr * .5, 0, 7); f.fill();
    for (let arm = 0; arm < 2; arm++) for (let t = 0; t < 70; t++) { const th = t / 70 * 5.5 + arm * Math.PI, rr = gr * .12 * Math.exp(th * .33); if (rr > gr) break; const c = t % 3 ? P.d : P.h; f.fillStyle = `rgba(${c},${.35 * (1 - rr / gr)})`; f.beginPath(); f.arc(Math.cos(th) * rr + (r() - .5) * 2, Math.sin(th) * rr + (r() - .5) * 2, 1.1 + r() * 1.6, 0, 7); f.fill(); }
    f.restore(); }
  { const sx = r() * BW, sy = r() * BH * .6, c = P.h; const sg = f.createRadialGradient(sx, sy, 0, sx, sy, 60); sg.addColorStop(0, 'rgba(255,255,255,.95)'); sg.addColorStop(.06, `rgba(${c},.7)`); sg.addColorStop(.3, `rgba(${c},.12)`); sg.addColorStop(1, `rgba(${c},0)`); f.fillStyle = sg; f.beginPath(); f.arc(sx, sy, 60, 0, 7); f.fill();
    f.strokeStyle = 'rgba(255,255,255,.35)'; f.lineWidth = .8; f.beginPath(); f.moveTo(sx - 34, sy); f.lineTo(sx + 34, sy); f.moveTo(sx, sy - 22); f.lineTo(sx, sy + 22); f.stroke(); }
  { const side = r() < .5 ? -1 : 1, pr = Math.min(BW, BH) * (.32 + r() * .12), px = side < 0 ? -pr * .45 : BW + pr * .45, py = BH * (.55 + r() * .35), c = P.b, l = Math.atan2(BH * .1 - py, BW * .5 - px);
    f.save(); f.globalAlpha = .55; const pg = f.createRadialGradient(px + Math.cos(l) * pr * .5, py + Math.sin(l) * pr * .5, pr * .1, px, py, pr); pg.addColorStop(0, `rgb(${c.map(v => Math.min(255, v + 60))})`); pg.addColorStop(.7, `rgb(${c.map(v => v * .35 | 0)})`); pg.addColorStop(1, 'rgb(4,3,10)');
    f.fillStyle = pg; f.beginPath(); f.arc(px, py, pr, 0, 7); f.fill(); f.save(); f.beginPath(); f.arc(px, py, pr, 0, 7); f.clip();
    for (let k = 0; k < 8; k++) { f.fillStyle = `rgba(255,255,255,${.03 + r() * .05})`; f.fillRect(px - pr, py - pr + r() * pr * 2, pr * 2, pr * (.03 + r() * .08)); } f.restore();
    f.globalAlpha = .8; f.strokeStyle = `rgba(${P.h},.35)`; f.lineWidth = 3; f.beginPath(); f.arc(px, py, pr * 1.01, l - 1.2, l + 1.2); f.stroke(); f.restore(); }
  // star layers (parallax)
  const layersN = [0.6, 1, 1.6].map((sz, li) => { const [c, x] = mk(W + 80, H + 80);
    for (let i = 0; i < [300, 120, 42][li]; i++) { const sx = r() * (W + 80), sy = r() * (H + 80), a = 0.3 + r() * 0.7, tint = ['255,255,255', '199,210,254', '254,243,199', P.d.join(',')][Math.floor(r() * 4)]; x.fillStyle = `rgba(${tint},${a})`; x.beginPath(); x.arc(sx, sy, sz * (0.5 + r()), 0, 7); x.fill();
      if (li === 2 && r() < .4) { x.strokeStyle = `rgba(${tint},${a * .35})`; x.lineWidth = .6; x.beginPath(); x.moveTo(sx - 5, sy); x.lineTo(sx + 5, sy); x.moveTo(sx, sy - 5); x.lineTo(sx, sy + 5); x.stroke(); } }
    return c; });
  const tw = Array.from({ length: 50 }, () => ({ x: r() * W, y: r() * H, p: r() * 6.28, s: 0.6 + r() * 1.4, f: .6 + r() * 2.5, c: r() < .3 ? P.h.join(',') : '255,255,255' }));
  return { base, far, layers: layersN, tw, P, M };
}
function ensureBG(key) { if (key === bgKey && bgSet) return; bgKey = key; bgSet = bgCache[key] || (bgCache[key] = buildBGSet(key)); bg = bgSet.base; layers = bgSet.layers; twinkles = bgSet.tw;
  const r = rng(key + 5); dust = Array.from({ length: qLevel === 0 ? 0 : qLevel === 2 ? 46 : 28 }, () => ({ x: r() * W, y: r() * H, z: .3 + r() * .7, s: 6 + r() * 22, vx: (r() - .5) * 6, vy: (r() - .5) * 4, a: .03 + r() * .06 })); comets = []; }
function buildBG() { bgCache = {}; const k = bgKey < 0 ? 5 : bgKey; bgKey = -1; ensureBG(k); }
function resize() {
  const dpr = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight;
  qLevel = save.set.q === 'low' ? 0 : save.set.q === 'high' ? 2 : autoQ;
  // v3.1.7: the gameplay layer (ship, beam, objects, text) is always drawn at (near-)native DPR so it stays crisp; quality only scales
  // the lensed scene buffer (soft nebula background + hole backs) that is uploaded to WebGL every frame.
  DPR = Math.min(dpr, [2, 2.5, 3][qLevel]); QS = Math.min(dpr, [1, 1.25, 1.5][qLevel]);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); octx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  if (useGL) { sc.width = Math.round(W * QS); sc.height = Math.round(H * QS); sctx.setTransform(sc.width / W, 0, 0, sc.height / H, 0, 0); GFX.resize(W, H, QS); glc.style.display = 'block'; }
  else { glc && (glc.style.display = 'none'); }
  BGS = Math.min(dpr, 1.5); // background art is soft; a fixed scale means a quality change never rebuilds it (that rebuild was a 100-400 ms hitch)
  SC = Math.min(W / 360, H / 640); OX = (W - 360 * SC) / 2; OY = (H - 640 * SC) / 2;
  const vk = W + 'x' + H + '@' + BGS; if (vk !== resize.vk) { resize.vk = vk; planetCache = {}; glowCache.clear(); buildBG(); } }
addEventListener('resize', resize); resize();
let parX = 0, parY = 0;
function drawBG(t) {
  const B = bgSet, M = B.M, P = B.P, dtb = Math.min(.05, t - (drawBG.t || t)); drawBG.t = t;
  const cy = camWY * SC; // world scroll on tall boss maps
  const drift = Math.sin(t * .021) * 10, driftY = Math.cos(t * .017) * 8;
  ctx.drawImage(B.base, -M - parX * 3 + drift, -M - (cy * .02) % M + driftY, W + M * 2, H + M * 2);
  ctx.drawImage(B.far, -M - parX * 7 + drift * .6, -M - (cy * .04) % M, W + M * 2, H + M * 2);
  // drifting dust clouds
  if (dust.length) { for (const d of dust) { d.x += d.vx * dtb; d.y += d.vy * dtb; if (d.x < -40) d.x += W + 80; if (d.x > W + 40) d.x -= W + 80; if (d.y < -40) d.y += H + 80; if (d.y > H + 40) d.y -= H + 80;
    const x = d.x - parX * 18 * d.z, y = ((d.y - cy * .15 * d.z) % (H + 80) + H + 80) % (H + 80) - 40; const gg = ctx.createRadialGradient(x, y, 0, x, y, d.s); gg.addColorStop(0, `rgba(${P.d},${d.a})`); gg.addColorStop(1, `rgba(${P.d},0)`); ctx.fillStyle = gg; ctx.fillRect(x - d.s, y - d.s, d.s * 2, d.s * 2); } }
  layers.forEach((Ly, i) => { const k = [6, 14, 26][i]; const oy = ((cy * [0.05, 0.1, 0.2][i]) % (H)); ctx.drawImage(Ly, -40 - parX * k, -40 - parY * k - oy, W + 80, H + 80); ctx.drawImage(Ly, -40 - parX * k, -40 - parY * k - oy + H, W + 80, H + 80); });
  for (const s of twinkles) { const a = 0.25 + 0.75 * Math.pow(Math.abs(Math.sin(t * s.f + s.p)), 3); ctx.fillStyle = `rgba(${s.c},${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.s * (0.7 + a * .5), 0, 7); ctx.fill();
    if (a > .9 && s.s > 1.4) { ctx.strokeStyle = `rgba(${s.c},${(a - .9) * 4})`; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(s.x - 6, s.y); ctx.lineTo(s.x + 6, s.y); ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x, s.y + 6); ctx.stroke(); } }
  // comets & shooting stars
  if (qLevel > 0) { cometT -= dtb; if (cometT <= 0) { cometT = 3.5 + Math.random() * 6; const big = Math.random() < .35, a = .4 + Math.random() * .9 + (Math.random() < .5 ? 0 : Math.PI - 1.7), sp = big ? 90 + Math.random() * 60 : 420 + Math.random() * 300;
      comets.push({ x: Math.random() * W, y: Math.random() * H * .5, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp, l: big ? 5 : .7, L0: big ? 5 : .7, big }); }
    for (let i = comets.length - 1; i >= 0; i--) { const c = comets[i]; c.x += c.vx * dtb; c.y += c.vy * dtb; c.l -= dtb; if (c.l <= 0) { comets.splice(i, 1); continue; }
      const f = Math.sin(Math.PI * (1 - c.l / c.L0)), tl = c.big ? 70 : 90, n = Math.hypot(c.vx, c.vy), tx = c.x - c.vx / n * tl, ty = c.y - c.vy / n * tl;
      const cg = ctx.createLinearGradient(c.x, c.y, tx, ty); cg.addColorStop(0, `rgba(255,255,255,${.85 * f})`); cg.addColorStop(.25, `rgba(${P.h},${.4 * f})`); cg.addColorStop(1, `rgba(${P.h},0)`);
      ctx.strokeStyle = cg; ctx.lineWidth = c.big ? 2.4 : 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.lineCap = 'butt';
      if (c.big) glow(c.x, c.y, 7, 'rgba(224,242,254,A)', .7 * f); } }
}

// ---------- state ----------
let state = 'menu', li = 0, L = null, ship = null, launchesLeft = 0, collected = new Set(), clock = 0, started = false;
const HINT_EVERY = 10, HINT_MS = 5200; let hintPath = null; // ideal-path star-dust playback
let braking = false, trail = [], attempt = [], ghost = null, parts = [], pops = [], shake = 0, aim = null, preview = [], tf = 1, animT = 0, curSector = 0, thrust = 0;
let active = {}, scanArmed = false, shieldOn = false, slowT = 0, heartT = 0, press = null, aimId = null, launchT = -1e9, flySteps = 0, trap = null, trapT = 0, trapHint = false, failTok = 0, lastTick = 0, ghostLevel = -1;

// v3.3.1: build every per-level sprite before the first frame (was: on the first rendered frame -> level-start hitch)
const GLOW_PRE = ['129,140,248', '224,242,254', '236,254,255', '248,113,113', '250,204,21', '251,146,60', '253,224,71', '255,255,255', '34,211,238', '96,165,250', '52,211,153', '244,114,182', '255,237,213'];
function prewarm() { if (!L || !SC) return; GLOW_PRE.forEach(c => glowSprite(`rgba(${c},A)`)); L.planets.forEach((p, i) => { const sp = planetSprite(p, i, Math.round(p[2] * SC * 1.14 * 4) / 4); glowSprite(`rgba(${sp.rgb},A)`); }); shadowSprite(); noiseTile(); railStrips(); smokeSprite(); puffSprite();
  L.planets.forEach((p, i) => planetSprite(p, i, Math.round(p[2] * SC * 1.14 * 4) / 4)); L.asteroids.forEach((a, i) => asteroidSprite(a, i, skinOf('asteroids', i)));
  L.holes.forEach(h => wellSprite(Math.round(h.r * SC * AST_ZMAX * 4) / 4)); L.gates.forEach((g, gi) => gateSprite(g, gi)); if (L.magnets.length) { magSprite(1); magSprite(-1); }
  torusSprite(); if (L.moons.length) grainMoonInit(); if (L.stars.length) for (let k = 0; k < 16; k++) starSprite(k); if (L.magnets.length) { magSprite(1); magSprite(-1); } } // stars/magnets: level-independent pieceCache -> built once per DPR, later levels reuse them
function startLevel(i, keepGhost) {
  if (!keepGhost || ghostLevel !== i) { ghost = null; }
  hintPath = null; li = i; ensureBG(SECTORS[CAT.secOf[i]].pal); AU.theme(secTheme(CAT.secOf[i])); L = S.prep(LEVELS[i]); L.skin = resolveSkins(LID(i), L); ship = S.newShip(L); ship.ang = -Math.PI / 2;
  launchesLeft = L.L; collected = new Set(); clock = 0; started = false; resetInput();
  shipFX.death = null; shipFX.win = null; shipFX.sqT = 9; shipFX.bank = 0; shipFX.pa = null; shipFX.spinA = 0; shipFX.spinV = 0; smokeSprite(); // prewarm (no canvas creation on the first launch)
  trail = []; attempt = []; pclear(); pops = []; edgeRipples = []; aim = null; preview = []; tf = 1; active = {}; scanArmed = false; shieldOn = false; slowT = 0;
  planetCache = {}; prewarm(); camWY = clampCam(ship.y); Z = 1; camCX = 180; camCY = camWY + 320; camOX = 0; camOY = 0; keepShipInView(0, true); fl = { bounces: 0, margin: 1e9 }; AU.aimEnd(); state = 'aim'; show(null); $('hud').style.display = 'flex'; hudSet('hTime', 'text', '0.0');
  $('hLevel').textContent = `${i + 1}. ${lvName(i)}`; $('hTarget').textContent = L.t3 ? `3★ ≤ ${L.t3}${T('hud.sec')}` : '';
  $('chipFuel').style.display = L.stops ? '' : 'none'; syncHintBtn();
  hud(); buildPU(); requestAnimationFrame(placeAch);
  const h = $('hint'); h.innerHTML = '💡 ' + (i === 0 && save.set.aim === 'direct' ? T('tut.direct') : I18N.lvHint(LID(i), L.hint)); h.style.display = 'block';
  $('hand').classList.toggle('dir', save.set.aim === 'direct'); $('hand').style.display = (i === 0 && !save.tut.aim) ? 'block' : 'none';
}
// v3.3.2: keep the ship + its aim ring (with margin) fully on screen, horizontally and vertically, in every state.
// The target offset depends only on the ship position and the base camera (no feedback), so it cannot oscillate; it is eased (snapped at level start).
let camOX = 0, camOY = 0;
function keepShipInView(dt, snap) {
  const hp = hintPath && hintPath.head, fx = hp ? hp[0] : ship.x, fy = hp ? hp[1] : ship.y; // the star-dust hint head takes the camera while it plays
  const k = SC * Z, m = (Math.max(30, R(34)) + 10) / k, bx = camCX, by = camCY;
  const lo = fx + m - ((W - OX) / SC - 180) / Z, hi = fx - m + (OX / SC + 180) / Z; // allowed camCX range
  const loY = fy + m - ((H - OY) / SC - 320) / Z, hiY = fy - m + (OY / SC + 320) / Z;
  const tx = lo > hi ? fx - bx : Math.min(hi, Math.max(lo, bx)) - bx, ty = loY > hiY ? fy - by : Math.min(hiY, Math.max(loY, by)) - by;
  const e = snap ? 1 : Math.min(1, dt * 6); camOX += (tx - camOX) * e; camOY += (ty - camOY) * e; if (Math.abs(camOX) < .01) camOX = 0; if (Math.abs(camOY) < .01) camOY = 0;
  camCX = bx + camOX; camCY = by + camOY; }
function clampCam(y) { return L.H <= 640 ? 0 : Math.max(0, Math.min(L.H - 640, y - 380)); }
// v3.1.7: hud() runs every flight frame; it now only touches the DOM when a value actually changed (was innerHTML rebuilds + style writes each frame)
const hudC = {}; function hudSet(id, prop, v) { const k = id + prop; if (hudC[k] === v) return; hudC[k] = v; const e = $(id); if (prop === 'html') e.innerHTML = v; else if (prop === 'text') e.textContent = v; else if (prop === 'cls') e.classList.toggle('on', v); else e.style[prop] = v; }
function hud() {
  const nL = L.L + (active.extra ? 1 : 0); let pips = ''; for (let k = 0; k < nL; k++) pips += `<i class="${k < launchesLeft ? '' : 'u'}"></i>`;
  hudSet('hL', 'html', T('hud.launches') + ' ' + pips); hudSet('hB', 'text', String(collected.size));
  hudSet('fuelF', 'width', (100 * ship.fuel / Math.max(0.01, S.fuelFor(L))).toFixed(1) + '%'); hudSet('chipFuel', 'cls', !!braking);
  if (L.magnets.length) { hudSet('chipPol', 'display', ''); hudSet('chipPol', 'html', T(ship.flip > 0 ? 'hud.mag.norm' : 'hud.mag.inv')); } else hudSet('chipPol', 'display', 'none');
  const fx = []; if (shieldOn) fx.push(T('hud.shield')); if (scanArmed) fx.push(T('hud.scan')); if (slowT > 0) fx.push('⏳ ' + slowT.toFixed(1) + T('hud.sec'));
  hudSet('chipFx', 'display', fx.length ? '' : 'none'); hudSet('chipFx', 'text', fx.join(' · '));
}
function buildPU() {
  const box = $('pu'); const owned = Object.keys(PU).filter(k => save.pu[k] > 0 || active[k]);
  if (state !== 'aim' || started || !owned.length) { box.style.display = 'none'; return; }
  box.style.display = 'flex'; box.innerHTML = '<span>' + T('hud.bonuses') + '</span>' + owned.map(k => `<button data-k="${k}" class="${active[k] ? 'act' : ''}">${PU[k].i} ${save.pu[k]}</button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); usePU(b.dataset.k); });
}
function usePU(k) {
  if (active[k] || save.pu[k] <= 0) return;
  save.pu[k]--; save.stats.puUsed++; persist(); active[k] = 1; AU.click(); achCheck();
  if (k === 'extra') launchesLeft++;
  if (k === 'scan') scanArmed = true;
  if (k === 'shield') shieldOn = true;
  toast(T('pu.on', { i: PU[k].i, n: PU[k].n })); HAP.tick(); hud(); buildPU();
}
function toast(t, ms) { const e = $('toast'); e.innerHTML = t; e.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => e.style.display = 'none', ms || 1400); }
function show(id) { document.querySelectorAll('.scr').forEach(e => e.classList.remove('on')); if (id) $(id).classList.add('on'); }

// ---------- input ----------
function wpos(e) { return { x: camCX + ((e.clientX - OX) / SC - 180) / Z, y: camCY + ((e.clientY - OY) / SC - 320) / Z }; }
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
// Aim direction (v3.1.6): 'sling' = launch opposite to the drag (default), 'direct' = launch along the drag. Power is drag length in both.
const aimSign = () => save.set.aim === 'direct' ? -1 : 1;
const AIM_DEAD = 12, AIM_SLOW = 70, AIM_FINE = 0.35;
// Angle model: the angle follows the drag direction only beyond a dead zone; slow finger motion = fine adjust (35% gain);
// fast motion re-syncs toward the finger direction; the displayed/launched angle is low-pass filtered (~70 ms). Power = drag length only.
function aimMove(p, now) {
  const dt = Math.max(1, now - (aim.lt || now - 16)) / 1000, sp = Math.hypot(p.x - aim.x, p.y - aim.y) / dt; aim.x = p.x; aim.y = p.y; aim.lt = now;
  const k = aimSign(), dx = k * (aim.sx - aim.x), dy = k * (aim.sy - aim.y), d = Math.hypot(dx, dy); if (d < AIM_DEAD) return;
  const raw = Math.atan2(dy, dx);
  if (aim.tgt == null) { aim.tgt = raw; aim.ang = raw; aim.raw = raw; return; }
  const dRaw = wrapA(raw - aim.raw); aim.raw = raw;
  const fine = sp < AIM_SLOW; aim.fine = fine;
  aim.tgt = wrapA(aim.tgt + dRaw * (fine ? AIM_FINE : 1));
  if (!fine) aim.tgt = wrapA(aim.tgt + wrapA(raw - aim.tgt) * 0.25);
}
function aimSmooth(dt) { if (!aim || aim.tgt == null) return; const e = wrapA(aim.tgt - aim.ang); aim.ang = Math.abs(e) < 0.002 ? aim.tgt : wrapA(aim.ang + e * Math.min(1, dt * 14)); }
function aimVec() { const k = aimSign(), dx = k * (aim.sx - aim.x), dy = k * (aim.sy - aim.y), d = Math.hypot(dx, dy); const pull = Math.min(d, S.MAX_PULL);
  if (aim.ang != null) return { a: aim.ang, p: pull, pct: Math.round(pull / S.MAX_PULL * 100) };
  return { a: Math.atan2(dy, dx), p: pull, pct: Math.round(pull / S.MAX_PULL * 100) }; }
function launch(a, p) {
  const sp = S.launchSpeed(p); ship.vx = Math.cos(a) * sp; ship.vy = Math.sin(a) * sp;
  resetInput(); launchT = performance.now(); flySteps = 0; hintPath = null; $('bHintPath').style.display = 'none'; trap = S.trapNew(ship, L); trapT = 0; setTrapHint(false);
  launchesLeft--; started = true; state = 'fly'; aim = null; thrust = 0.35; shipFX.sqT = 0; ship.scan = scanArmed; preview = []; scanArmed = false;
  if (active.slow && !active.slowUsed) { slowT = 3; active.slowUsed = 1; }
  { const tx = ship.x - Math.cos(a) * 12.4, ty = ship.y - Math.sin(a) * 12.4, rd = save.set.ship === 'roadster'; // v3.2.0 launch burst: cold-gas cloud + ice (roadster) / ignition smoke + hot sparks (shuttle)
    for (let i = 0; i < 18; i++) { const j = a + Math.PI + (Math.random() - .5) * (rd ? .9 : 1.3), v = 50 + Math.random() * 90;
      if (rd) { puff(tx, ty, Math.cos(j) * v, Math.sin(j) * v); if (i % 2) ice(tx, ty, Math.cos(j) * v * 1.4, Math.sin(j) * v * 1.4); }
      else { smoke(tx, ty, Math.cos(j) * v * .8, Math.sin(j) * v * .8, 2 + Math.random() * 2); if (i % 2) spark(tx, ty, i % 4 === 1 ? 'rgba(254,215,170,.95)' : 'rgba(186,230,253,.95)', 60 + Math.random() * 120, j); } } }
  $('hint').style.display = 'none'; $('hand').style.display = 'none'; $('pu').style.display = 'none'; placeAch();
  if (li === 0) { save.tut.aim = 1; persist(); }
  HAP.launch(); AU.launch(p / S.MAX_PULL * 100); save.stats.launches++; hud();
}
// Input model (v3.1.1):
//  - aiming is bound to the pointer id that started it; other pointers are ignored
//  - brake/tap during flight needs a NEW press that starts >= BRAKE_GRACE ms after launch; the aim gesture's pointer never brakes
//  - all press/brake state is reset on launch, stop, level start/end, pointercancel, blur and visibility change
const BRAKE_GRACE = 150, HOLD_MS = 160;
function resetInput() { press = null; aimId = null; braking = false; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (state === 'fly') {
    if (press || e.pointerId === aimId) return;                       // multi-touch / leftover aim pointer
    if (performance.now() - launchT < BRAKE_GRACE) return;            // too soon after launch: not a brake press
    press = { id: e.pointerId, t: performance.now() }; return;
  }
  if (state !== 'aim' || aim) return;
  aimId = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  const z = SC * Z, p = { x: e.clientX / z, y: e.clientY / z }; aim = { z, sx: p.x, sy: p.y, x: p.x, y: p.y, lastPct: 0 }; // screen-space drag (immune to camera easing)
  $('hand').style.display = 'none'; AU.aimStart();
});
cv.addEventListener('pointermove', e => {
  if (state !== 'aim' || !aim || e.pointerId !== aimId) return; aimMove({ x: e.clientX / aim.z, y: e.clientY / aim.z }, performance.now());
  const v = aimVec(); AU.aimPower(v.pct); const step = Math.floor(v.pct / 10); if (step !== aim.lastPct) { aim.lastPct = step; HAP.tick(); }
});
const up = e => {
  if (press && e.pointerId === press.id) {
    const held = performance.now() - press.t, wasBraking = braking; press = null; braking = false;
    if (state === 'fly' && !wasBraking && held < HOLD_MS && L.magnets.length) { ship.flip = -ship.flip; HAP.magnet(); AU.magnet(ship.flip); save.stats.flips++; achCheck(); burst(ship.x, ship.y, ship.flip > 0 ? '#f87171' : '#60a5fa', 12); }
    if (L) hud(); return;
  }
  if (e.pointerId !== aimId) return;
  aimId = null;
  if (state !== 'aim' || !aim) { aim = null; return; }
  const v = aimVec(); if (v.p < 6) { aim = null; preview = []; AU.aimEnd(); return; }
  launch(v.a, v.p);
};
const cancel = e => {
  if (press && e.pointerId === press.id) { press = null; braking = false; if (L) hud(); }
  if (e.pointerId === aimId) { aimId = null; aim = null; preview = []; AU.aimEnd(); }
};
addEventListener('pointerup', up); addEventListener('pointercancel', cancel); cv.addEventListener('lostpointercapture', e => { if (e.pointerId === aimId) up(e); });
addEventListener('blur', () => { cancel({ pointerId: press ? press.id : -99 }); if (aim) cancel({ pointerId: aimId }); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (press) cancel({ pointerId: press.id }); if (aim) cancel({ pointerId: aimId }); } });
function computePreview(a, p) {
  const sp = S.launchSpeed(p); const o = Object.assign({}, ship, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, fuel: 0 }); const pts = [];
  for (let i = 0; i < 700; i++) { S.step(o, L, null); if (i % 6 === 0) pts.push([o.x, o.y]); if (S.status(o, L)) { pts.push([o.x, o.y]); break; } }
  return pts;
}

// ---------- effects ----------
// v3.3.0: pooled particles — fixed cap, recycled objects, swap-remove (no splice / no per-spark allocation once warm)
const PCAP = 420, pfree = []; let pRing = 0;
function pnew(x, y, vx, vy, l, r, c) { const p = pfree.pop() || {}; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.l = l; p.l0 = l; p.r = r; p.c = c; p.c2 = ''; p.smoke = p.puff = p.ice = p.deb = p.streak = p.ring = p.flash = 0; p.ph = 0; p.rot = 0; p.vr = 0;
  if (parts.length >= PCAP) { pRing = (pRing + 1) % PCAP; if (pfree.length < 600) pfree.push(parts[pRing]); parts[pRing] = p; } else parts.push(p); return p; }
function pclear() { for (const p of parts) if (pfree.length < 600) pfree.push(p); parts.length = 0; }
const qMul = () => [.5, .8, 1][qLevel] || 1;
function spark(x, y, col, sp, ang) { const a = ang ?? Math.random() * 6.28, s = sp ?? 40 + Math.random() * 120; pnew(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.5, 1 + Math.random() * 2, col); }
function streak(x, y, vx, vy, col, l) { pnew(x, y, vx, vy, l || .25 + Math.random() * .3, .9 + Math.random() * .8, col).streak = 1; }
function shard(x, y, vx, vy, c, c2, r, l) { const p = pnew(x, y, vx, vy, l || .7 + Math.random() * .6, r, c); p.deb = 1; p.c2 = c2; p.rot = Math.random() * 6.28; p.vr = (Math.random() - .5) * 22; p.ph = Math.random(); }
function shockwave(x, y, r0, r1, col, l) { const p = pnew(x, y, 0, 0, l || .45, r1, col); p.ring = 1; p.ph = r0; }
function flash(x, y, r, col, l) { const p = pnew(x, y, 0, 0, l || .22, r, col); p.flash = 1; }
// impact response FX, scaled by the normal speed of the hit (world units/s). Sparks skid along the surface in the slide direction.
const HIT_PAL = { metal: ['#e2e8f0', '#475569', '#fde68a'], ice: ['#e0f2fe', '#0e7490', '#bae6fd'], rock: ['#d6d3d1', '#44403c', '#fbbf24'], planet: ['#cbd5e1', '#334155', '#fdba74'] };
function impactFX(h) {
  const k = Math.min(1, h.vn / 260), q = qMul(), ask = h.i != null ? skinOf('asteroids', h.i) : null;
  const pal = HIT_PAL[h.kind === 'metal' || ask === 'metal' ? 'metal' : ask === 'ice' ? 'ice' : h.kind === 'planet' ? 'planet' : 'rock'];
  const tx = -h.ny, ty = h.nx, sd = Math.sign(h.vt) || 1, ns = Math.round((5 + 16 * k) * q);
  for (let i = 0; i < ns; i++) { const al = (Math.random() * 1.5 - .25) * sd, out = .15 + Math.random() * .8, dx = tx * al + h.nx * out, dy = ty * al + h.ny * out, m = Math.hypot(dx, dy) || 1, v = 70 + Math.random() * 260 * (.35 + k);
    streak(h.x, h.y, dx / m * v, dy / m * v, Math.random() < .5 ? pal[2] : '#fff7ed'); }
  const nd = Math.round((1 + 7 * k) * q); for (let i = 0; i < nd; i++) { const a = Math.atan2(h.ny, h.nx) + (Math.random() - .5) * 2.2, v = 40 + Math.random() * 120 * (.4 + k); shard(h.x, h.y, Math.cos(a) * v, Math.sin(a) * v, pal[0], pal[1], .9 + Math.random() * 1.6 * (.5 + k)); }
  if (h.kind !== 'metal' && k > .15) for (let i = 0; i < 2; i++) smoke(h.x + h.nx * 3, h.y + h.ny * 3, h.nx * 25 + (Math.random() - .5) * 20, h.ny * 25 + (Math.random() - .5) * 20, 2 + 2 * k);
  if (k > .3) { flash(h.x, h.y, 14 + 26 * k, '255,237,213'); shockwave(h.x, h.y, 4, 22 + 30 * k, '254,215,170', .35); }
  shake = Math.min(9, shake + 1.5 + h.vn / 70);
  shipFX.spinV += sd * Math.min(14, Math.abs(h.spin) / 10 + k * 3); if (k > .25) shipFX.sqT = 0; // visual: the hull is knocked into a spin and squashes
}
// ship break-up (non-hole deaths): light flash, two shockwaves, hull debris, fire streaks and smoke
function explodeFX(x, y, vx, vy, kind) {
  const q = qMul(), hull = kind === 'roadster' ? [['#dc2626', '#7f1d1d'], ['#e5e7eb', '#4b5563'], ['#111827', '#000']] : [['#f8fafc', '#94a3b8'], ['#1f2937', '#030712'], ['#cbd5e1', '#475569']];
  flash(x, y, 70, '255,237,213', .32); flash(x, y, 34, '255,255,255', .14); shockwave(x, y, 6, 70, '254,215,170', .55); shockwave(x, y, 4, 40, '255,255,255', .3);
  for (let i = 0; i < Math.round(18 * q) + 4; i++) { const a = Math.random() * 6.28, v = 40 + Math.random() * 170, c = hull[i % 3]; shard(x, y, Math.cos(a) * v + vx * .3, Math.sin(a) * v + vy * .3, c[0], c[1], 1.4 + Math.random() * 2.6, .9 + Math.random() * .8); }
  for (let i = 0; i < Math.round(26 * q); i++) { const a = Math.random() * 6.28, v = 90 + Math.random() * 300; streak(x, y, Math.cos(a) * v + vx * .2, Math.sin(a) * v + vy * .2, ['#fde68a', '#fb923c', '#fff7ed'][i % 3], .3 + Math.random() * .35); }
  for (let i = 0; i < Math.round(10 * q); i++) { const a = Math.random() * 6.28, v = 15 + Math.random() * 45; smoke(x, y, Math.cos(a) * v, Math.sin(a) * v, 3 + Math.random() * 3); }
  burst(x, y, '#f97316', Math.round(12 * q));
}
function burst(x, y, col, n) { for (let i = 0; i < n; i++) spark(x, y, col); }

// ---------- tick ----------
function tick() {
  clock += S.STEP; flySteps++;
  const ev = S.step(ship, L, { brake: braking && ship.fuel > 0 });
  tf = ev.tf;
  const stt = save.stats; stt.flight += S.STEP; if (tf < 0.6) stt.dilate += S.STEP;
  for (const h of L.holes) { const [hx, hy] = S.holePos(h, ship.t); const m = (Math.hypot(ship.x - hx, ship.y - hy) - h.r * S.KILL) / h.r; if (m < fl.margin) fl.margin = m; }
  if (ev.bounce) { if (ev.hit) impactFX(ev.hit); else { shake = Math.min(9, shake + 4); burst(ship.x, ship.y, '#fbbf24', 8); } HAP.bounce(); AU.bounce(); fl.bounces++; stt.bounces++; }
  if (ev.broke >= 0) { const a = L.asteroids[ev.broke], ca = Math.cos(a[4]), sa = Math.sin(a[4]), q = qMul(); // v3.3.0: the cracked slab shatters into lit rock shards + dust
    for (let k = 0; k < Math.round(26 * q) + 6; k++) { const u = (Math.random() - .5) * a[2], w = (Math.random() - .5) * a[3], px = a[0] + ca * u - sa * w, py = a[1] + sa * u + ca * w, an = Math.random() * 6.28, v = 30 + Math.random() * 130;
      shard(px, py, Math.cos(an) * v + ship.vx * .25, Math.sin(an) * v + ship.vy * .25, '#d6d3d1', '#44403c', 1.2 + Math.random() * 2.8, .9 + Math.random() * .7); }
    for (let k = 0; k < Math.round(8 * q); k++) smoke(a[0] + ca * (Math.random() - .5) * a[2], a[1] + sa * (Math.random() - .5) * a[2], (Math.random() - .5) * 40, (Math.random() - .5) * 40, 3 + Math.random() * 3);
    flash(ship.x, ship.y, 40, '255,237,213'); shockwave(ship.x, ship.y, 6, 50, '214,211,209', .45); shake = Math.min(10, shake + 7); toast(T('ev.broke'), 900); AU.crash(); stt.breaks++; achCheck(); }
  if (ev.key >= 0) { burst(L.keys[ev.key][0], L.keys[ev.key][1], '#fde047', 30); HAP.key(); AU.key(); toast(T('ev.gate'), 1000); }
  if (ev.worm) { burst(ship.x, ship.y, '#34d399', 24); shake = 6; trail = []; AU.worm(); stt.worms++; achCheck(); }
  const lt = trail[trail.length - 1];
  if (!lt || Math.hypot(ship.x - lt.x, ship.y - lt.y) > 2.5) { trail.push({ x: ship.x, y: ship.y, tf }); if (trail.length > 160) trail.shift(); }
  const la = attempt[attempt.length - 1]; if (!la || Math.hypot(ship.x - la[0], ship.y - la[1]) > 4) { attempt.push([ship.x, ship.y, ev.worm ? 1 : 0]); if (attempt.length > 3000) attempt.shift(); }
  L.stars.forEach((s, k) => {
    if (!collected.has(k) && Math.hypot(ship.x - s[0], ship.y - s[1]) < 22) { collected.add(k); burst(s[0], s[1], '#fde047', 26); pops.push({ x: s[0], y: s[1], t: 0 }); HAP.star(); AU.star(collected.size); save.stats.bonus++;
      const b = $('bonus'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); hud(); }
  });
  const st = S.status(ship, L);
  if (st === 'win') return win();
  if (st) {
    if (shieldOn) { shieldOn = false; deflect(st); hud(); return; }
    return fail(['swallowed', 'moon', 'flare', 'oob'].includes(st) ? T('fail.' + st) : T('fail.generic'), st);
  }
  // orbit trap / no-progress: >2 turns around one attractor without nearing the portal, or a per-launch hard cap
  const capped = flySteps * S.STEP > (L.H > 700 ? 32 : 20);
  if (trap && (S.trapStep(trap, ship, L) || capped)) {
    const canBrake = L.stops > 0 && ship.fuel > 0 && launchesLeft > 0;
    if (!(braking && ship.fuel > 0)) trapT += S.STEP; // the countdown pauses while the player is braking
    setTrapHint(true, canBrake);
    if (trapT >= S.TRAP_SECS) { setTrapHint(false); return fail(T('fail.trap'), 'trap'); }
  } else if (trapT) { trapT = 0; setTrapHint(false); }
  if (braking && flySteps > 18 && Math.hypot(ship.vx, ship.vy) < S.STOP_SPEED) {
    ship.vx = 0; ship.vy = 0; braking = false; trapT = 0; setTrapHint(false); burst(ship.x, ship.y, '#fb923c', 14); HAP.stop(); AU.stop();
    if (launchesLeft > 0) { press = null; braking = false; aim = null; aimId = null; state = 'aim'; syncHintBtn(); const h = $('hint'); h.innerHTML = T('ev.stop', { n: launchesLeft }); h.style.display = 'block'; }
    else fail(T('fail.stranded'), 'stranded');
    hud();
  }
  if (braking && ship.fuel <= 0) braking = false;
}
// ---------- ideal-path hint: replay the stored solver solution in the pure sim and show it once as star-dust ----------
function solverPath(i) {
  const L0 = S.prep(LEVELS[i]), sol = LEVELS[i].sol; if (!sol) return null; const o = S.newShip(L0), pts = [], marks = []; let steps = 0;
  for (let k = 0; k < sol.length; k++) { const st = sol[k], sp = S.launchSpeed(st.p); o.vx = Math.cos(st.a) * sp; o.vy = Math.sin(st.a) * sp;
    marks.push({ t: 'launch', n: k + 1, x: o.x, y: o.y, at: pts.length }); let done = false;
    for (let j = 0; j < 2600; j++) { if (st.tg != null && j === st.tg) { o.flip = -o.flip; marks.push({ t: 'tap', x: o.x, y: o.y, at: pts.length }); }
      const br = st.b != null && j >= st.b && o.fuel > 0; if (br && j === st.b) marks.push({ t: 'brake', x: o.x, y: o.y, at: pts.length });
      const wx = o.x, wy = o.y; S.step(o, L0, { brake: br }); steps++; if (Math.hypot(o.x - wx, o.y - wy) > 60) pts.push(null); // wormhole jump
      if (j % 2 === 0) pts.push([o.x, o.y]); const r = S.status(o, L0); if (r) { done = true; break; }
      if (br && Math.hypot(o.vx, o.vy) < S.STOP_SPEED) { o.vx = 0; o.vy = 0; marks.push({ t: 'stop', x: o.x, y: o.y, at: pts.length }); break; } }
    if (done) break; }
  return { pts, marks };
}
function syncHintBtn() { $('bHintPath').style.display = L && save.hintOk[LID(li)] && state === 'aim' && !hintPath ? '' : 'none'; }
function useHintPath() {
  if (state !== 'aim' || !save.hintOk[LID(li)]) return; const P = solverPath(li); if (!P) return;
  delete save.hintOk[LID(li)]; save.lfail[LID(li)] = 0; persist(); // counter resets after use; shown once
  hintPath = Object.assign(P, { t0: performance.now(), head: null, dust: [] }); toast(T('hp.watch'), 1600); AU.star(3); HAP.tick(); syncHintBtn();
}
function drawHintPath() {
  if (!hintPath) return; const e = performance.now() - hintPath.t0; if (e > HINT_MS) { hintPath = null; syncHintBtn(); return; }
  const P = hintPath, n = P.pts.length, reveal = Math.min(1, e / (HINT_MS * 0.6)), upto = Math.floor(n * reveal), fade = e > HINT_MS * 0.72 ? 1 - (e - HINT_MS * 0.72) / (HINT_MS * 0.28) : 1;
  const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < upto; k++) { const p = P.pts[k]; if (!p) continue; const age = (upto - k) / n, tw = .55 + .45 * Math.sin(animT * 9 + k * 1.7);
    const a = fade * Math.max(.18, 1 - age * 1.4) * tw; ctx.fillStyle = `rgba(253,230,138,${a.toFixed(3)})`; const rr = R(1.3 + 1.5 * tw);
    ctx.beginPath(); ctx.arc(X(p[0]) + Math.sin(k * 12.9) * R(2), Y(p[1]) + Math.cos(k * 7.3) * R(2), rr, 0, 7); ctx.fill();
    if (k % 14 === 0) { ctx.fillStyle = `rgba(255,255,255,${(a * .9).toFixed(3)})`; const x = X(p[0]), y = Y(p[1]), s2 = R(3.5 * tw); ctx.fillRect(x - s2, y - .6, s2 * 2, 1.2); ctx.fillRect(x - .6, y - s2, 1.2, s2 * 2); } }
  let hp = null; for (let k = Math.min(upto, n - 1); k >= 0 && !hp; k--) hp = P.pts[k]; P.head = hp;
  if (hp && reveal < 1) { const g = ctx.createRadialGradient(X(hp[0]), Y(hp[1]), 0, X(hp[0]), Y(hp[1]), R(14)); g.addColorStop(0, `rgba(255,250,220,${fade})`); g.addColorStop(1, 'rgba(253,224,71,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(hp[0]), Y(hp[1]), R(14), 0, 7); ctx.fill(); }
  ctx.globalCompositeOperation = pc;
  for (const m of P.marks) { if (m.at > upto) continue; const x = X(m.x), y = Y(m.y), pul = 1 + .15 * Math.sin(animT * 6);
    const col = m.t === 'brake' ? '251,146,60' : m.t === 'stop' ? '34,211,238' : m.t === 'tap' ? '96,165,250' : '253,224,71';
    ctx.strokeStyle = `rgba(${col},${(.9 * fade).toFixed(3)})`; ctx.lineWidth = R(2); ctx.setLineDash(m.t === 'brake' ? [R(3), R(3)] : []); ctx.beginPath(); ctx.arc(x, y, R(m.t === 'launch' ? 13 : 10) * pul, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(${col},${fade.toFixed(3)})`; ctx.font = `bold ${R(10)}px sans-serif`; ctx.textAlign = 'center';
    const lab = m.t === 'launch' ? (m.n > 1 ? T('hp.relaunch', { n: m.n }) : P.marks.some(q => q.t === 'stop') ? T('hp.launchN', { n: 1 }) : '') : m.t === 'brake' ? T('hp.brake') : m.t === 'tap' ? T('hp.tap') : '';
    if (lab) ctx.fillText(lab, x, y - R(16)); ctx.textAlign = 'left'; }
}
function setTrapHint(on, canBrake) { const h = $('hint');
  if (!on) { if (trapHint) { trapHint = false; h.classList.remove('pulse'); if (state === 'fly') h.style.display = 'none'; } return; }
  const txt = T(canBrake ? 'trap.brake' : 'trap.lost'); if (trapHint === txt) return;
  trapHint = txt; h.innerHTML = txt; h.style.display = 'block'; h.classList.add('pulse'); }
function deflect(st) {
  toast(T('ev.shield'), 1100); shake = 12; burst(ship.x, ship.y, '#67e8f9', 40); HAP.bounce(); AU.shield(); save.stats.shields++; achCheck();
  let nx = -ship.vx, ny = -ship.vy;
  if (st === 'swallowed') { let best = null; for (const h of L.holes) { const [hx, hy] = S.holePos(h, ship.t); const d = Math.hypot(ship.x - hx, ship.y - hy); if (!best || d < best.d) best = { d, hx, hy, r: h.r }; }
    const dx = ship.x - best.hx, dy = ship.y - best.hy, d = Math.hypot(dx, dy) || 1; ship.x = best.hx + dx / d * best.r * (S.KILL + 1.2); ship.y = best.hy + dy / d * best.r * (S.KILL + 1.2); nx = dx / d * 220; ny = dy / d * 220; }
  else if (st === 'oob') { ship.x = Math.max(5, Math.min(L.W - 5, ship.x)); ship.y = Math.max(5, Math.min(L.H - 5, ship.y)); }
  else { ship.x -= ship.vx * 0.06; ship.y -= ship.vy * 0.06; }
  ship.vx = nx * 0.8; ship.vy = ny * 0.8;
}
function starsFor(t) { return !L.t3 ? 3 : t <= L.t3 ? 3 : t <= L.t2 ? 2 : 1; }
function win() {
  shipFX.win = { t: 0, x: ship.x, y: ship.y, ang: ship.ang || 0 };
  resetInput(); state = 'result'; burst(L.portal[0], L.portal[1], '#22d3ee', 50); $('hud').style.display = 'none'; $('hint').style.display = 'none'; ghost = null;
  const t = clock, st = starsFor(t), timePts = Math.max(0, Math.round(((L.t2 || 20) - t) * 100)), bon = collected.size * 250, unused = launchesLeft * 300;
  const score = st * 1000 + timePts + bon + unused;
  const prev = bestOf(li) || { s: 0, sc: 0 }; const isBest = score > prev.sc; const rk0 = PR.rank(PR.stars(save));
  save.best[LID(li)] = { s: Math.max(prev.s, st), sc: Math.max(prev.sc, score), t: Math.min(prev.t || 1e9, +t.toFixed(2)) };
  save.stats.wins++; AU.win(st);
  { const nx = CAT.nextIndex(li); if (nx != null && CAT.secOf[nx] === CAT.secOf[li]) save.open[LID(nx)] = 1; }
  let streakMsg = '';
  if (st === 3) { save.streak++; if (save.streak % 4 === 0) streakMsg = grant(T('streak.grant', { n: save.streak })); else streakMsg = T('streak.prog', { n: save.streak % 4 }); }
  else { save.streak = 0; streakMsg = T('streak.reset'); }
  if (L.boss && !save.ach['boss:' + LID(li)]) { save.ach['boss:' + LID(li)] = 1; streakMsg += '<br>' + grant(T('boss.beaten')); }
  const rk1 = PR.rank(PR.stars(save)); if (rk1.i > rk0.i) streakMsg += '<br>' + T('res.rank', { r: rk1.name });
  const fid = LID(li), fNew = !!FACTS[fid] && !save.facts[fid], f3New = !!FACTS[fid] && st === 3 && !(save.facts[fid] || {}).s3;
  if (FACTS[fid]) save.facts[fid] = { t: (save.facts[fid] || {}).t || Date.now(), s3: ((save.facts[fid] || {}).s3 || st === 3) ? 1 : 0 };
  achCheck({ type: 'win', bonus: collected.size, margin: fl.margin, bounces: fl.bounces, time: t });
  persist();
  const fMode = save.set.facts, showFact = !!FACTS[fid] && (fMode === 'always' || (fMode === 'win' && (fNew || f3New)));
  $('rTitle').textContent = T('res.' + Math.max(1, st));
  $('rStars').innerHTML = [0, 1, 2].map(k => `<span class="${k < st ? '' : 'e'}">★</span>`).join('');
  $('rRows').innerHTML = `<div><span>${T('res.time', { t: t.toFixed(1), t3: L.t3, t2: L.t2 })}</span></div><div><span>${T('res.rating', { s: st })}</span><b>${st * 1000}</b></div><div><span>${T('res.timeBonus')}</span><b>${timePts}</b></div><div><span>${T('res.bonusStars', { n: collected.size })}</span><b>${bon}</b></div><div><span>${T('res.spare', { n: launchesLeft })}</span><b>${unused}</b></div>`;
  $('rScore').textContent = score; $('rTotal').textContent = T('res.total', { s: I18N.num(PR.score(save)), r: rk1.name }); $('rBest').textContent = isBest ? T('res.record') : T('res.best', { s: bestOf(li).sc }); $('rStreak').innerHTML = streakMsg;
  $('bNext').style.display = CAT.nextIndex(li) != null && isOpen(li + 1) ? '' : 'none';
  setTimeout(() => { if (state !== 'result') return; if (showFact) factCard(fid, st, fNew); else show('result'); }, 450);
}
function factCard(id, st, isNew) {
  const f = I18N.fact(id); if (!f) return show('result'); const s3 = (save.facts[id] || {}).s3;
  $('fcLab').textContent = `${isNew ? '✦ ' + T('fact.new') : T('fact.label')} · ${f.boss ? T('fact.boss') + ' · ' : ''}${T('codex.level', { n: f.n })}`;
  $('fcTitle').textContent = f.title; $('fcText').textContent = f.text; $('fcSrc').textContent = T('fact.src', { s: f.src });
  const fs = $('fcStar'); fs.className = 'fstar ' + (s3 ? 'on' : 'dim'); fs.textContent = s3 ? T('fact.star') : T('fact.starHint');
  state = 'fact'; show('factCard'); AU.star(1); const t0 = performance.now();
  $('factCard').onclick = () => { if (performance.now() - t0 < 350 || state !== 'fact') return; state = 'result'; show('result'); };
}
function grant(why) {
  if (puTotal() >= 3) return T('grant.full', { w: why });
  const keys = Object.keys(PU); const k = keys[(save.streak + Object.keys(save.ach).length + li) % keys.length]; save.pu[k]++;
  return T('grant.got', { w: why, i: PU[k].i, n: PU[k].n });
}
const AR_MS = 2000; // auto-restart after a loss
function arStart(tok) { const c = $('arC'); c.style.transition = 'none'; c.style.strokeDashoffset = '0'; void c.getBoundingClientRect();
  c.style.transition = `stroke-dashoffset ${AR_MS}ms linear`; c.style.strokeDashoffset = '113.1'; $('arWrap').classList.add('on');
  setTimeout(() => { if (state === 'fail' && tok === failTok) arRestart(); }, AR_MS); }
function arRestart() { if (state !== 'fail') return; failTok++; $('arWrap').classList.remove('on'); startLevel(li, true); }
function fail(msg, why) {
  if (why === 'oob') edgeRipples.push({ x: ship.x, y: ship.y, t: 0, big: 1 });
  { let hx = null, hy = null, bd = 1e9; if (why === 'swallowed') for (const h of L.holes) { const [qx, qy] = S.holePos(h, ship.t), d = Math.hypot(qx - ship.x, qy - ship.y); if (d < bd) { bd = d; hx = qx; hy = qy; } }
    shipFX.death = { t: 0, x: ship.x, y: ship.y, ang: ship.ang || 0, hx, hy, vx: ship.vx, vy: ship.vy, kind: save.set.ship }; }
  resetInput(); state = 'fail'; if (why === 'swallowed') { burst(ship.x, ship.y, '#a78bfa', 18); shake = 8; } else { explodeFX(ship.x, ship.y, ship.vx, ship.vy, save.set.ship); shake = 10; } HAP.death(); AU.lose();
  save.stats.fails++; save.stats.deaths[why || 'other'] = (save.stats.deaths[why || 'other'] || 0) + 1; achCheck({ type: 'fail' }); persist(); $('hud').style.display = 'none'; $('hint').style.display = 'none';
  ghost = attempt.slice(); ghostLevel = li;
  { const id = LID(li); save.lfail[id] = (save.lfail[id] || 0) + 1; let earned = false; if (save.lfail[id] >= HINT_EVERY && !save.hintOk[id] && LEVELS[li].sol) { save.hintOk[id] = 1; earned = true; } persist();
    $('fHint').innerHTML = earned ? T('hp.earned') : save.hintOk[id] ? T('hp.ready') : save.lfail[id] >= 3 && LEVELS[li].sol ? T('hp.progress', { n: HINT_EVERY - save.lfail[id] }) : ''; $('fHint').classList.toggle('new', earned); }
  $('fText').textContent = msg; const tok = ++failTok; setTrapHint(false);
  setTimeout(() => { if (state !== 'fail' || tok !== failTok) return; show('fail'); arStart(tok); }, 500);
}

// ---------- drawing ----------
// v3.1.7: glows are pre-rendered radial sprites per colour (was a new gradient object per call, dozens per frame)
function glowSprite(col) { let c = glowCache.get(col); if (c) return c; if (glowCache.size > 96) glowCache.clear(); c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, col.replace('A', 1)); g.addColorStop(1, col.replace('A', 0)); x.fillStyle = g; x.fillRect(0, 0, 128, 128); glowCache.set(col, c); return c; }
function glow(x, y, r, col, a) { if (!(r > 0) || !(a > 0)) return; const ga = ctx.globalAlpha; ctx.globalAlpha = ga * Math.min(1, a); ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = ga; }
let smokeSpr = null; function smokeSprite() { if (smokeSpr) return smokeSpr; smokeSpr = document.createElement('canvas'); smokeSpr.width = smokeSpr.height = 64; const x = smokeSpr.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(203,213,225,1)'); g.addColorStop(.5, 'rgba(148,163,184,.55)'); g.addColorStop(1, 'rgba(100,116,139,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return smokeSpr; }
let puffSpr = null; function puffSprite() { if (puffSpr) return puffSpr; puffSpr = document.createElement('canvas'); puffSpr.width = puffSpr.height = 64; const x = puffSpr.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(226,232,240,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return puffSpr; }
// black hole: scene part (lensed in WebGL) + top part (front of disk, kill ring)
function diskStroke(x, y, r, t, from, to, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35); const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 4; k++) { const g = ctx.createLinearGradient(-r * 2.6, 0, r * 2.6, 0); // doppler beaming: approaching side brighter
    const c = [[251, 146, 60], [253, 186, 116], [253, 224, 71], [255, 247, 237]][k]; g.addColorStop(0, `rgba(${c},${(.75 - k * .08) * a})`); g.addColorStop(.5, `rgba(${c},${(.35 - k * .05) * a})`); g.addColorStop(1, `rgba(${c},${(.18) * a})`);
    ctx.strokeStyle = g; ctx.lineWidth = R(3.4 - k * 0.7); ctx.beginPath(); ctx.ellipse(0, 0, r * (2.6 - k * .32), r * (0.62 - k * .075), 0, from, to); ctx.stroke(); }
  // hot clumps orbiting
  for (let k = 0; k < 7; k++) { const an = t * (1.6 + k * .13) + k * 0.9; if (((an % 6.283) + 6.283) % 6.283 < from || ((an % 6.283) + 6.283) % 6.283 > to) continue; const rr = 1.75 + (k % 3) * .3; ctx.fillStyle = `rgba(255,237,213,${.55 * a})`; ctx.beginPath(); ctx.ellipse(Math.cos(an) * r * rr, Math.sin(an) * r * rr * .24, R(1.6), R(1), 0, 0, 7); ctx.fill(); }
  ctx.globalCompositeOperation = pc; ctx.restore();
}
function drawHoleScene(h, t) {
  const [hx, hy] = S.holePos(h, t); const mk = S.holeMass(h, t) / h.m; const x = X(hx), y = Y(hy), r = R(h.r) * (0.85 + 0.15 * mk);
  if (useGL) lenses.push({ x, y, r, s: 0.8 + 0.2 * mk });
  { const rs = Math.round(h.r * SC * AST_ZMAX * 4) / 4, ws = wellSprite(rs), f = r / rs; ctx.drawImage(ws.c, x - (ws.R0 + .5) * f, y - (ws.R0 + .5) * f, ws.c.width / DPR * f, ws.c.height / DPR * f); } // v3.3.0 gravity well
  if (!useGL) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, 7); ctx.clip(); ctx.translate(x, y); ctx.rotate(Math.PI); ctx.scale(1.35, 1.35); ctx.translate(-x, -y); ctx.globalAlpha = 0.85; ctx.drawImage(bg, 0, 0, W, H); ctx.restore();
    const dk = ctx.createRadialGradient(x, y, r, x, y, r * 3.2); dk.addColorStop(0, 'rgba(0,0,0,.85)'); dk.addColorStop(.35, 'rgba(20,0,40,.35)'); dk.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = dk; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 3; i++) { const ph = (t * (h.pulse ? h.pulse.w * 0.3 : 0.45) + i / 3) % 1; ctx.strokeStyle = `rgba(196,181,253,${0.28 * ph * mk})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * (7 - ph * 6), 0, 7); ctx.stroke(); }
  glow(x, y, r * 3.4, 'rgba(251,146,60,A)', .16 * mk);
  diskStroke(x, y, r, t, 0, 6.283, 1);
  if (!useGL) { ctx.save(); ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 26; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,237,213,.9)'; ctx.lineWidth = R(1.3); ctx.beginPath(); ctx.arc(x, y, r * 1.06, 0, 7); ctx.stroke(); }
}
function drawHoleTop(h, t) {
  const [hx, hy] = S.holePos(h, t); const mk = S.holeMass(h, t) / h.m; const x = X(hx), y = Y(hy), r = R(h.r) * (0.85 + 0.15 * mk);
  diskStroke(x, y, r, t, 0, Math.PI, 0.9); // front half of the disk passes in front of the shadow
  ctx.strokeStyle = `rgba(248,113,113,${0.55 + 0.25 * Math.sin(t * 5)})`; ctx.lineWidth = 1.6; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(x, y, R(h.r * S.KILL), 0, 7); ctx.stroke(); ctx.setLineDash([]);
}
function drawWhite(w, t) {
  const x = X(w[0]), y = Y(w[1]), r = R(w[3]); if (useGL) lenses.push({ x, y, r, s: -1 });
  for (let i = 0; i < 4; i++) { const ph = (t * 0.6 + i / 4) % 1; ctx.strokeStyle = `rgba(165,243,252,${0.4 * (1 - ph)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * (1.2 + ph * 6), 0, 7); ctx.stroke(); }
  glow(x, y, r * 3, 'rgba(224,242,254,A)', .7); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
const PCOL = [['#60a5fa', '#1e3a8a', '147,197,253'], ['#f472b6', '#831843', '249,168,212'], ['#34d399', '#064e3b', '110,231,183'], ['#fbbf24', '#78350f', '253,224,71'], ['#a78bfa', '#3b0764', '196,181,253']];
// nearest light source for shading (white holes, flares, accretion disks, portal; else a distant sun top-left)
function lightAt(px, py) {
  let best = { d: 1e9, a: -2.3, c: '255,244,220', k: 0.6 };
  const tt = ship ? ship.t : animT;
  const con = (lx, ly, c, k, range) => { const d = Math.hypot(lx - px, ly - py); if (d > 1 && d < range && d / k < best.d) best = { d: d / k, a: Math.atan2(ly - py, lx - px), c, k: Math.min(1, 0.45 + k * (1 - d / range)) }; };
  if (L) { L.whites.forEach(w => con(w[0], w[1], '224,242,254', 1.3, 620)); L.flares.forEach(f => con(f.x + f.w / 2, f.y + f.h / 2, '254,215,170', S.flareOn(f, tt) ? 1.6 : 0.6, 520));
    L.holes.forEach(h => { const [hx, hy] = S.holePos(h, tt); con(hx, hy, '253,186,116', 1, 300); }); con(L.portal[0], L.portal[1], '103,232,249', 0.7, 230); }
  return best;
}
// ---------- visual skins (v3.1.4): per-object looks from skins3.js; never touches physics ----------
function resolveSkins(id, L) { const d = (window.BH_SKINS || {})[id] || {}, out = {};
  for (const k of ['asteroids', 'planets', 'moons', 'magnets']) { const v = d[k];
    out[k] = L[k].map((o, j) => v == null ? null : typeof v === 'string' ? v : Array.isArray(v) ? v[j] || null : (((v.y || []).find(([m]) => (k === 'moons' ? o.cy : o[1]) < m) || [0, v.d || null])[1])); }
  return out; }
const skinOf = (k, i) => (L && L.skin && L.skin[k] && L.skin[k][i]) || null;
const PSKIN = { rocky: ['#a8a29e', '#3f3a36', '214,211,209'], mars: ['#fb923c', '#7c2d12', '251,146,60'], earth: ['#60a5fa', '#1e3a8a', '147,197,253'],
  desert: ['#fde68a', '#92400e', '253,230,138'], lava: ['#991b1b', '#1c0606', '248,113,113'], gas: ['#fed7aa', '#9a3412', '253,186,116'],
  ringed: ['#fef3c7', '#a16207', '253,230,138'], ice: ['#a5f3fc', '#155e75', '165,243,252'], sun: ['#fffbeb', '#f59e0b', '253,186,116'], neutron: ['#ffffff', '#3b82f6', '147,197,253'] };
function planetSprite(p, i, r) {
  const sk = skinOf('planets', i); if (sk && PSKIN[sk]) return skinSprite(p, i, r, sk);
  const key = i + '_' + Math.round(r * 10) + '@' + DPR; if (planetCache[key]) return planetCache[key];
  const [c1, c2, rgb] = PCOL[(Math.round(p[0] + p[1]) + i) % PCOL.length]; const d = Math.ceil(r * 2 * DPR) + 2; const rr = rng(Math.round(p[0] * 7 + p[1] * 13 + i));
  const body = document.createElement('canvas'); body.width = body.height = d; const b = body.getContext('2d'); b.scale(DPR, DPR); const cr = r;
  b.save(); b.beginPath(); b.arc(cr + .5, cr + .5, cr, 0, 7); b.clip();
  const g = b.createRadialGradient(cr * .7, cr * .7, cr * .1, cr, cr, cr * 1.05); g.addColorStop(0, c1); g.addColorStop(1, c2); b.fillStyle = g; b.fillRect(0, 0, cr * 2 + 1, cr * 2 + 1);
  for (let k = 0; k < 9; k++) { const yy = rr() * cr * 2, hh = cr * (.06 + rr() * .18); b.fillStyle = `rgba(${rr() < .5 ? '255,255,255' : '0,0,20'},${.06 + rr() * .1})`; b.beginPath(); b.ellipse(cr, yy, cr * 1.3, hh, (rr() - .5) * .25, 0, 7); b.fill(); }
  for (let k = 0; k < 5; k++) { b.fillStyle = 'rgba(0,0,0,.12)'; b.beginPath(); b.arc(rr() * cr * 2, rr() * cr * 2, cr * (.05 + rr() * .1), 0, 7); b.fill(); }
  bakeSphere(b, cr); b.restore();
  const cl = document.createElement('canvas'); cl.width = d * 2; cl.height = d; const c = cl.getContext('2d'); c.scale(DPR, DPR);
  for (let k = 0; k < 22; k++) { const x = rr() * cr * 4, y = cr * (.2 + rr() * 1.6), w = cr * (.3 + rr() * .6); const cg = c.createRadialGradient(x, y, 0, x, y, w); cg.addColorStop(0, 'rgba(255,255,255,.32)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = cg; c.beginPath(); c.ellipse(x, y, w, w * .35, 0, 0, 7); c.fill(); }
  // rings are decorative only: skip them if they would overlap a gameplay object or route
  const clear = r0 => { const R0 = p[2] * 1.9; const near = (x, y, rr) => Math.hypot(x - p[0], (y - p[1]) * 2.2) < R0 + rr;
    return !(L.planets.some(q => q !== p && near(q[0], q[1], q[2])) || L.stars.some(t => near(t[0], t[1], 12)) || L.holes.some(h => near(h.x, h.y, h.r * 3)) || near(L.portal[0], L.portal[1], L.pr) || near(L.ship[0], L.ship[1], 14) || L.moons.some(m => near(m.cx, m.cy, m.a + m.r)) || L.worms.some(w => near(w.a[0], w.a[1], 20) || near(w.b[0], w.b[1], 20))); };
  return planetCache[key] = { body, cl, rgb, ring: (p[2] > 45 || (i + Math.round(p[0])) % 4 === 1) && clear() };
}
function skinSprite(p, i, r, sk) {
  const key = i + '_' + Math.round(r * 10) + sk + '@' + DPR; if (planetCache[key]) return planetCache[key];
  const [c1, c2, rgb] = PSKIN[sk], d = Math.ceil(r * 2 * DPR) + 2, rr = rng(Math.round(p[0] * 7 + p[1] * 13 + i)), cr = r;
  const body = document.createElement('canvas'); body.width = body.height = d; const b = body.getContext('2d'); b.scale(DPR, DPR);
  b.save(); b.beginPath(); b.arc(cr + .5, cr + .5, cr, 0, 7); b.clip();
  const g = b.createRadialGradient(cr * .7, cr * .7, cr * .1, cr, cr, cr * 1.05); g.addColorStop(0, c1); g.addColorStop(1, c2); b.fillStyle = g; b.fillRect(0, 0, cr * 2 + 1, cr * 2 + 1);
  const band = (cols, n, wob) => { for (let k = 0; k < n; k++) { const y = (k + .5) / n * cr * 2; b.fillStyle = cols[k % cols.length]; b.beginPath(); b.ellipse(cr, y, cr * 1.4, cr / n * (0.55 + rr() * .5), (rr() - .5) * wob, 0, 7); b.fill(); } };
  const spots = (n, col, s0, s1) => { for (let k = 0; k < n; k++) { b.fillStyle = col; b.beginPath(); b.arc(rr() * cr * 2, rr() * cr * 2, cr * (s0 + rr() * s1), 0, 7); b.fill(); } };
  if (sk === 'gas') { band(['rgba(255,247,237,.55)', 'rgba(194,65,12,.45)', 'rgba(253,230,138,.4)', 'rgba(124,45,18,.4)'], 9, .06);
    b.fillStyle = 'rgba(185,28,28,.75)'; b.beginPath(); b.ellipse(cr * 1.35, cr * 1.3, cr * .26, cr * .14, 0, 0, 7); b.fill(); b.strokeStyle = 'rgba(254,215,170,.6)'; b.lineWidth = Math.max(.6, cr * .03); b.stroke(); }
  else if (sk === 'ringed') band(['rgba(254,243,199,.45)', 'rgba(202,138,4,.3)', 'rgba(255,251,235,.35)'], 8, .03);
  else if (sk === 'ice') band(['rgba(236,254,255,.18)', 'rgba(8,145,178,.2)'], 6, .02);
  else if (sk === 'desert') { band(['rgba(254,243,199,.25)', 'rgba(180,83,9,.25)'], 7, .3); spots(4, 'rgba(120,53,15,.2)', .05, .12); }
  else if (sk === 'earth') { for (let k = 0; k < 6; k++) { b.fillStyle = k % 3 ? 'rgba(34,197,94,.75)' : 'rgba(161,98,7,.6)'; b.beginPath(); b.ellipse(rr() * cr * 2, rr() * cr * 2, cr * (.18 + rr() * .3), cr * (.1 + rr() * .2), rr() * 3, 0, 7); b.fill(); }
    b.fillStyle = 'rgba(255,255,255,.85)'; b.beginPath(); b.ellipse(cr, cr * .06, cr * .6, cr * .16, 0, 0, 7); b.fill(); b.beginPath(); b.ellipse(cr, cr * 1.96, cr * .55, cr * .14, 0, 0, 7); b.fill(); }
  else if (sk === 'mars') { spots(7, 'rgba(69,26,3,.28)', .05, .12); b.fillStyle = 'rgba(255,255,255,.9)'; b.beginPath(); b.ellipse(cr, cr * .08, cr * .38, cr * .13, 0, 0, 7); b.fill(); }
  else if (sk === 'rocky') { for (let k = 0; k < 9; k++) { const x = rr() * cr * 2, y = rr() * cr * 2, s2 = cr * (.05 + rr() * .14); b.fillStyle = 'rgba(0,0,0,.25)'; b.beginPath(); b.arc(x, y, s2, 0, 7); b.fill(); b.strokeStyle = 'rgba(255,255,255,.18)'; b.lineWidth = Math.max(.5, s2 * .25); b.beginPath(); b.arc(x - s2 * .15, y - s2 * .15, s2, 3.6, 5.6); b.stroke(); } }
  else if (sk === 'lava') { b.strokeStyle = 'rgba(251,146,60,.95)'; b.lineWidth = Math.max(.8, cr * .05); b.shadowColor = '#f97316'; b.shadowBlur = cr * .2;
    for (let k = 0; k < 7; k++) { b.beginPath(); let x = rr() * cr * 2, y = rr() * cr * 2; b.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (rr() - .5) * cr * .7; y += (rr() - .5) * cr * .7; b.lineTo(x, y); } b.stroke(); } b.shadowBlur = 0; }
  else if (sk === 'sun') { for (let k = 0; k < 60; k++) { b.fillStyle = `rgba(${rr() < .5 ? '255,255,255' : '194,65,12'},${.08 + rr() * .1})`; b.beginPath(); b.arc(rr() * cr * 2, rr() * cr * 2, cr * (.03 + rr() * .07), 0, 7); b.fill(); }
    spots(2, 'rgba(120,53,15,.45)', .04, .05); }
  if (sk !== 'neutron') bakeSphere(b, cr, sk === 'sun'); b.restore();
  const cl = document.createElement('canvas'); cl.width = d * 2; cl.height = d; const c = cl.getContext('2d'); c.scale(DPR, DPR);
  const nCl = sk === 'earth' ? 18 : sk === 'ice' || sk === 'gas' ? 6 : 0;
  for (let k = 0; k < nCl; k++) { const x = rr() * cr * 4, y = cr * (.2 + rr() * 1.6), w = cr * (.3 + rr() * .6); const cg = c.createRadialGradient(x, y, 0, x, y, w); cg.addColorStop(0, 'rgba(255,255,255,.32)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = cg; c.beginPath(); c.ellipse(x, y, w, w * .35, 0, 0, 7); c.fill(); }
  return planetCache[key] = { body, cl, rgb, sk, ring: sk === 'ringed', self: sk === 'sun' || sk === 'neutron' };
}
function ringArc(x, y, r, from, to) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3);
  [[1.75, 2.6, 'rgba(253,230,138,.28)'], [1.55, 1.6, 'rgba(254,243,199,.4)'], [1.38, 3.2, 'rgba(214,211,209,.22)']].forEach(([k, w, c]) => { ctx.strokeStyle = c; ctx.lineWidth = R(w); ctx.beginPath(); ctx.ellipse(0, 0, r * k, r * k * .24, 0, from, to); ctx.stroke(); });
  ctx.restore();
}

// ---------- v3.3.0: tabletop volume ----------
// One key light for the whole board (top-left, same direction as lightAt's default); every piece casts a soft contact shadow toward the bottom-right.
// Everything here is pre-rendered once (per DPR / size) — per frame it is only drawImage + a few cheap strokes.
const KEY_A = -2.3, SDX = -Math.cos(KEY_A), SDY = -Math.sin(KEY_A);
let shadowSpr = null; function shadowSprite() { if (shadowSpr) return shadowSpr; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,6,.85)'); g.addColorStop(.45, 'rgba(0,0,6,.6)'); g.addColorStop(.75, 'rgba(0,0,6,.22)'); g.addColorStop(1, 'rgba(0,0,6,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return shadowSpr = c; }
// contact shadow: r = footprint radius (screen px), h = height above the board (screen px) -> offset + softness, a = opacity
function cshadow(x, y, r, h, a) { if (!(r > 0)) return; const rr = r * 1.12 + h * .45, ga = ctx.globalAlpha; ctx.globalAlpha = ga * a; ctx.drawImage(shadowSprite(), x + SDX * h - rr, y + SDY * h - rr, rr * 2, rr * 2); ctx.globalAlpha = ga; }
// fine surface grain (rock / ice / metal micro texture), blended with 'overlay' into baked sprites
let noiseT = null; function noiseTile() { if (noiseT) return noiseT; const n = 96, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), id = x.createImageData(n, n), r = rng(4242);
  const lo = new Float32Array(16 * 16); for (let i = 0; i < lo.length; i++) lo[i] = r();
  for (let y = 0; y < n; y++) for (let xx = 0; xx < n; xx++) { const u = xx / n * 16, v = y / n * 16, i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0, L0 = (a, b) => lo[(b & 15) * 16 + (a & 15)];
    const low = (L0(i0, j0) * (1 - fu) + L0(i0 + 1, j0) * fu) * (1 - fv) + (L0(i0, j0 + 1) * (1 - fu) + L0(i0 + 1, j0 + 1) * fu) * fv, v8 = Math.max(0, Math.min(255, 128 + (low - .5) * 70 + (r() - .5) * 60)), k = (y * n + xx) * 4;
    id.data[k] = id.data[k + 1] = id.data[k + 2] = v8; id.data[k + 3] = 255; }
  x.putImageData(id, 0, 0); return noiseT = c; }
function grainFill(b, x, y, w, h, a) { const pc = b.globalCompositeOperation, ga = b.globalAlpha; b.globalCompositeOperation = 'overlay'; b.globalAlpha = a; b.fillStyle = b.createPattern(noiseTile(), 'repeat'); b.fillRect(x, y, w, h); b.globalCompositeOperation = pc; b.globalAlpha = ga; }
// baked sphere volume (inside the body clip): micro texture + limb darkening (ambient occlusion toward the silhouette)
function bakeSphere(b, cr, warm) { grainFill(b, 0, 0, cr * 2 + 1, cr * 2 + 1, warm ? .18 : .42);
  const g = b.createRadialGradient(cr + .5, cr + .5, cr * .55, cr + .5, cr + .5, cr); g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(.7, warm ? 'rgba(120,40,0,.12)' : 'rgba(0,0,10,.16)'); g.addColorStop(1, warm ? 'rgba(120,40,0,.4)' : 'rgba(0,0,10,.5)');
  b.fillStyle = g; b.fillRect(0, 0, cr * 2 + 1, cr * 2 + 1); }
// black-hole gravity well: a pre-rendered funnel (terraced rings lit from the key light) sunk into the board
function wellSprite(r) { const key = 'well' + Math.round(r * 4) + '@' + DPR; if (planetCache[key]) return planetCache[key]; const R0 = r * 6.6, d = Math.ceil(R0 * 2 * DPR) + 2, c = document.createElement('canvas'); c.width = c.height = d;
  const b = c.getContext('2d'); b.scale(DPR, DPR); b.translate(R0 + .5, R0 + .5);
  const dg = b.createRadialGradient(0, 0, r, 0, 0, R0); dg.addColorStop(0, 'rgba(0,0,0,.55)'); dg.addColorStop(.4, 'rgba(6,2,20,.32)'); dg.addColorStop(1, 'rgba(6,2,20,0)'); b.fillStyle = dg; b.beginPath(); b.arc(0, 0, R0, 0, 7); b.fill();
  for (let k = 0; k < 6; k++) { const q = k / 6, rk = R0 * (1 - q * .78) * .96, a = .07 + q * .16, off = q * r * .5; // deeper terraces drift away from the light
    const g = b.createLinearGradient(-SDX * rk, -SDY * rk, SDX * rk, SDY * rk); g.addColorStop(0, `rgba(0,0,0,${a * 1.4})`); g.addColorStop(.5, `rgba(167,139,250,${a * .35})`); g.addColorStop(1, `rgba(221,214,254,${a * 1.5})`);
    b.strokeStyle = g; b.lineWidth = Math.max(.8, r * (.16 - q * .08)); b.beginPath(); b.arc(SDX * off, SDY * off, rk, 0, 7); b.stroke(); }
  return planetCache[key] = { c, R0 }; }
// shading for 3D bonus stars: 10 facets lit by the key light
const STAR_LO = [180, 110, 6], STAR_HI = [255, 250, 205];
function facetCol(b) { b = Math.max(0, Math.min(1, b)); return `rgb(${STAR_LO.map((v, i) => Math.round(v + (STAR_HI[i] - v) * b)).join(',')})`; }
// light direction expressed in an object's local (rotated) frame
const localLight = rot => [Math.cos(KEY_A - rot), Math.sin(KEY_A - rot)];
function drawShadows() { // contact shadows / ambient occlusion on the board (before any piece is drawn)
  L.planets.forEach(p => { const r = R(p[2]), sk = skinOf('planets', L.planets.indexOf(p)); if (sk === 'sun' || sk === 'neutron') return; cshadow(X(p[0]), Y(p[1]), r, r * .22 + R(5), .7); });
  L.moons.forEach(m => { const [mx, my] = S.moonPos(m, ship.t); cshadow(X(mx), Y(my), R(m.r), R(m.r) * .3 + R(5), .6); });
  L.keys.forEach((k, i) => { if (!((ship.keys >> i) & 1)) cshadow(X(k[0]), Y(k[1]), R(9), R(8) - Math.sin(animT * 3) * R(2), .5); });
  L.magnets.forEach(m => cshadow(X(m[0]), Y(m[1]), R(13), R(6), .55));
  L.worms.forEach(w => { for (const P of [w.a, w.b]) cshadow(X(P[0]), Y(P[1]), R(w.r || 16) * .9, R(4), .45); });
}
function drawPlanet(p, i) {
  const x = X(p[0]), y = Y(p[1]), r = R(p[2]), rs = Math.round(p[2] * SC * 1.14 * 4) / 4, sf = r / rs; const sp = planetSprite(p, i, rs); const lt = lightAt(p[0], p[1]); // v3.1.7: sprite built once at max-zoom size (was rebuilt every frame while the camera zoomed)
  glow(x, y, r * (sp.self ? 2.6 : 1.45), `rgba(${sp.rgb},A)`, sp.self ? .6 : .3);
  if (sp.sk === 'neutron') neutronBeams(x, y, r, '147,197,253');
  if (sp.ring) ringArc(x, y, r, Math.PI, Math.PI * 2);
  ctx.drawImage(sp.body, x - (rs + .5) * sf, y - (rs + .5) * sf, sp.body.width / DPR * sf, sp.body.height / DPR * sf);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  const off = ((animT * r * .06) % (r * 2)); ctx.drawImage(sp.cl, x - r - off, y - r, r * 4, r * 2); ctx.drawImage(sp.cl, x + r * 3 - off, y - r, r * 4, r * 2);
  if (!sp.self) { // terminator shadow (night side away from the light)
  const lx = x + Math.cos(lt.a) * r * .55, ly = y + Math.sin(lt.a) * r * .55; const tg = ctx.createRadialGradient(lx, ly, r * .15, lx, ly, r * 1.75);
  tg.addColorStop(0, 'rgba(0,0,8,0)'); tg.addColorStop(.55, 'rgba(0,0,8,.15)'); tg.addColorStop(.8, 'rgba(0,0,8,.72)'); tg.addColorStop(1, 'rgba(0,0,8,.9)'); ctx.fillStyle = tg; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.restore();
  // atmosphere rim, brighter on the lit side
  const ag = ctx.createLinearGradient(x - Math.cos(lt.a) * r, y - Math.sin(lt.a) * r, x + Math.cos(lt.a) * r, y + Math.sin(lt.a) * r); ag.addColorStop(0, `rgba(${sp.rgb},.08)`); ag.addColorStop(1, `rgba(${sp.rgb},.85)`);
  ctx.strokeStyle = ag; ctx.lineWidth = R(2.2); ctx.beginPath(); ctx.arc(x, y, r * 1.02, 0, 7); ctx.stroke();
  if (!sp.self) { glow(x + Math.cos(lt.a) * r * .46, y + Math.sin(lt.a) * r * .46, r * .34, 'rgba(255,255,255,A)', .2 + .12 * lt.k); // v3.3.0 specular + cool back-rim
    ctx.strokeStyle = 'rgba(165,180,252,.32)'; ctx.lineWidth = Math.max(1, R(1.3)); ctx.beginPath(); ctx.arc(x, y, r * .97, lt.a + Math.PI - .95, lt.a + Math.PI + .95); ctx.stroke(); }
  if (sp.ring) ringArc(x, y, r, 0, Math.PI);
}
function neutronBeams(x, y, r, col) { const a = animT * 2.2, pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  for (const s of [0, Math.PI]) { const g = ctx.createLinearGradient(x, y, x + Math.cos(a + s) * r * 5, y + Math.sin(a + s) * r * 5); g.addColorStop(0, `rgba(${col},.75)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a + s - .14) * r * 5, y + Math.sin(a + s - .14) * r * 5); ctx.lineTo(x + Math.cos(a + s + .14) * r * 5, y + Math.sin(a + s + .14) * r * 5); ctx.closePath(); ctx.fill(); }
  ctx.globalCompositeOperation = pc; }
const MSKIN = { luna: ['#f8fafc', '#94a3b8', '#1e293b'], io: ['#fef9c3', '#eab308', '#713f12'], europa: ['#ffffff', '#cbd5e1', '#475569'], ice: ['#e0f2fe', '#7dd3fc', '#0c4a6e'] };
function grainMoonInit() { if (limbS) return; limbS = document.createElement('canvas'); limbS.width = limbS.height = 128; const b = limbS.getContext('2d'), g = b.createRadialGradient(64, 64, 35, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,0,10,.5)'); b.fillStyle = g; b.fillRect(0, 0, 128, 128);
    const p = b.globalCompositeOperation; b.globalCompositeOperation = 'source-atop'; b.globalAlpha = .12; b.drawImage(noiseTile(), 0, 0, 128, 128); b.globalCompositeOperation = p; }
let limbS = null; function grainMoon(x, y, r) { grainMoonInit(); ctx.drawImage(limbS, x - r, y - r, r * 2, r * 2); } // limb darkening from a cached sprite
function drawMoon(m, t, mi) {
  ctx.save(); ctx.translate(X(m.cx), Y(m.cy)); ctx.rotate(m.rot || 0); ctx.strokeStyle = 'rgba(248,113,113,.18)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1, R(m.a)), Math.max(1, R(m.b)), 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  const [mx, my] = S.moonPos(m, t); const x = X(mx), y = Y(my), r = R(m.r); const lt = lightAt(mx, my);
  glow(x, y, r * 2.2, 'rgba(248,113,113,A)', .25);
  const g = ctx.createRadialGradient(x + Math.cos(lt.a) * r * .4, y + Math.sin(lt.a) * r * .4, 0, x, y, r * 1.1); const msk = skinOf('moons', mi), mc = MSKIN[msk] || MSKIN.luna; g.addColorStop(0, mc[0]); g.addColorStop(.6, mc[1]); g.addColorStop(1, mc[2]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  if (msk === 'io') { [[.3, -.2, .16, '#ea580c'], [-.35, .3, .12, '#1c1917'], [.05, .45, .1, '#dc2626'], [-.2, -.4, .09, '#f97316']].forEach(c => { ctx.fillStyle = c[3]; ctx.beginPath(); ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, 7); ctx.fill(); });
    const pa = .5 + .5 * Math.sin(t * 5); ctx.fillStyle = `rgba(253,224,71,${.35 * pa})`; ctx.beginPath(); ctx.ellipse(x - r * .2, y - r * 1.15, r * .3, r * .45 * pa + r * .1, 0, 0, 7); ctx.fill(); } // volcanic plume
  else if (msk === 'europa') { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip(); ctx.strokeStyle = 'rgba(146,64,14,.6)'; ctx.lineWidth = Math.max(.6, r * .07); const q = rng(7);
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x + (q() - .5) * r * 2.2, y - r); ctx.quadraticCurveTo(x + (q() - .5) * r * 2, y, x + (q() - .5) * r * 2.2, y + r); ctx.stroke(); } ctx.restore(); }
  else if (msk === 'ice') { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .22, 0, 7); ctx.fill(); }
  else { ctx.fillStyle = 'rgba(51,65,85,.55)'; [[.3, -.2, .25], [-.35, .3, .18], [.05, .45, .12]].forEach(c => { ctx.beginPath(); ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, 7); ctx.fill(); }); }
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip(); grainMoon(x, y, r); ctx.restore();
  glow(x + Math.cos(lt.a) * r * .45, y + Math.sin(lt.a) * r * .45, r * .4, 'rgba(255,255,255,A)', .3); ctx.strokeStyle = 'rgba(165,180,252,.3)'; ctx.lineWidth = Math.max(1, R(1.1)); ctx.beginPath(); ctx.arc(x, y, r * .95, lt.a + Math.PI - .9, lt.a + Math.PI + .9); ctx.stroke();
  const [nx, ny] = S.moonPos(m, t + 0.15); ctx.strokeStyle = 'rgba(248,113,113,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(X(nx), Y(ny)); ctx.stroke();
}
function rectPath(a, i, jag) {
  const w = R(a[2]), h = R(a[3]); const r = rng(i * 97 + 13); const n = Math.max(6, Math.round(a[2] / 10));
  ctx.beginPath(); for (let k = 0; k <= n; k++) ctx.lineTo(-w / 2 + w * k / n, -h / 2 - (jag ? r() * h * .25 : 0)); for (let k = n; k >= 0; k--) ctx.lineTo(-w / 2 + w * k / n, h / 2 + (jag ? r() * h * .25 : 0)); ctx.closePath();
}
// v3.1.7: asteroid bodies (gradient, craters, strata, 3D shading) are pre-rendered once per level into a sprite at max-zoom size;
// only the animated bits (ice glints, metal sheen, crack lines) are drawn live. The per-frame clip + ~80 crater paths were the boss-level hitch.
function astPaint(a, i, ask, live) {
  const w = R(a[2]), h = R(a[3]), n = Math.max(4, Math.round(a[2] / 14));
  if (!live) { rectPath(a, i, true); const g = ctx.createLinearGradient(0, -h * .75, 0, h * .75);
    const AC = ask === 'ice' ? ['#f0f9ff', '#7dd3fc', '#0c4a6e', 'rgba(224,242,254,.9)'] : ask === 'metal' ? ['#f1f5f9', '#64748b', '#0f172a', 'rgba(203,213,225,.8)'] : [a[5] ? '#d6d3d1' : '#a8a29e', '#57534e', '#292524', a[5] ? 'rgba(250,250,250,.8)' : 'rgba(253,186,116,.5)'];
    g.addColorStop(0, AC[0]); g.addColorStop(.5, AC[1]); g.addColorStop(1, AC[2]); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = AC[3]; ctx.lineWidth = 1; ctx.stroke(); }
  if (live && ask !== 'ice' && ask !== 'metal') return;
  ctx.save(); rectPath(a, i, true); ctx.clip(); const q = rng(i * 31 + 7);
  if (ask === 'ice') { if (!live) { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < n * 2; k++) ctx.fillRect(-w / 2 + q() * w, -h / 2 + q() * h * .5, R(1.4), R(1.4)); } // frost
    else { for (let k = 0; k < n * 2; k++) { q(); q(); } for (let k = 0; k < n; k++) { const gx = -w / 2 + q() * w, gy = -h / 2 + q() * h, tw = Math.max(0, Math.sin(animT * 3 + k * 2.3)); if (tw > .6) { const s2 = R(4) * tw; ctx.fillStyle = `rgba(255,255,255,${tw})`; ctx.fillRect(gx - s2, gy - .5, s2 * 2, 1); ctx.fillRect(gx - .5, gy - s2, 1, s2 * 2); } } } } // glints
  else if (ask === 'metal') { if (!live) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-w / 2, -h * .28, w, R(1.6)); ctx.fillStyle = 'rgba(15,23,42,.7)'; for (let k = 0; k < n; k++) { ctx.beginPath(); ctx.arc(-w / 2 + (k + .5) * w / n, h * .15, R(1.3), 0, 7); ctx.fill(); } }
    else { const sx = ((animT * .25 + i * .37) % 1.6 - .3) * w - w / 2; const sg = ctx.createLinearGradient(sx - R(10), 0, sx + R(10), 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(sx - R(10), -h, R(20), h * 2); } }
  else { for (let k = 0; k < n * 2; k++) { const cx = -w / 2 + q() * w, cy = -h * .4 + q() * h * .8, cr = R(1.2 + q() * 2.6); // craters: dark pit + lit lower rim
      ctx.fillStyle = 'rgba(28,25,23,.5)'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(245,245,244,.22)'; ctx.lineWidth = Math.max(.6, cr * .3); ctx.beginPath(); ctx.arc(cx, cy, cr, .3, Math.PI - .3); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let k = 0; k < n; k++) { ctx.beginPath(); ctx.ellipse(-w / 2 + q() * w, -h * .1 + q() * h * .3, R(6 + q() * 10), R(1 + q() * 1.5), 0, 0, 7); ctx.fill(); } } // strata
  if (!live) { const sh = ctx.createLinearGradient(0, -h * .75, 0, h * .75); sh.addColorStop(0, 'rgba(255,250,240,.28)'); sh.addColorStop(.22, 'rgba(255,250,240,0)'); sh.addColorStop(.62, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = sh; ctx.fillRect(-w / 2 - R(4), -h, w + R(8), h * 2); } // top light / bottom shadow -> reads as a 3D rock
  ctx.restore();
}
const AST_ZMAX = 1.14;
function asteroidSprite(a, i, ask) {
  const key = 'ast' + i + (ask || '') + '@' + DPR + '_' + Math.round(SC * 1000); if (planetCache[key]) return planetCache[key];
  const z0 = Z; Z = AST_ZMAX; const pad = R(16), pw = R(a[2]) + 8 + pad * 2, ph = R(a[3]) * 1.6 + 8 + pad * 2, c = document.createElement('canvas'); c.width = Math.ceil(pw * DPR); c.height = Math.ceil(ph * DPR);
  const old = ctx; ctx = c.getContext('2d'); ctx.scale(DPR, DPR); ctx.translate(pw / 2, ph / 2);
  try { // v3.3.0: the belt segment is a solid slab on the board — soft drop shadow, extruded side wall, textured top, bevelled lit edge
    const [lx, ly] = localLight(a[4]), sx = -lx, sy = -ly, dep = R(5), OFF = 4000, side = ask === 'ice' ? ['#0e3a52', '#155e75'] : ask === 'metal' ? ['#0b1220', '#334155'] : ['#1c1917', '#44403c'];
    ctx.save(); ctx.translate(-OFF, 0); ctx.shadowColor = 'rgba(0,0,6,.7)'; ctx.shadowBlur = R(7) * DPR; ctx.shadowOffsetX = (OFF + sx * R(9)) * DPR; ctx.shadowOffsetY = sy * R(9) * DPR; rectPath(a, i, true); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    for (let k = 6; k >= 1; k--) { ctx.save(); ctx.translate(sx * dep * k / 6, sy * dep * k / 6); rectPath(a, i, true); ctx.fillStyle = k > 3 ? side[0] : side[1]; ctx.fill(); ctx.restore(); }
    astPaint(a, i, ask, false);
    ctx.save(); rectPath(a, i, true); ctx.clip(); const w = R(a[2]), h = R(a[3]); grainFill(ctx, -w / 2 - 4, -h, w + 8, h * 2, ask === 'ice' ? .25 : ask === 'metal' ? .3 : .6);
    const bg = ctx.createLinearGradient(lx * w * .5, ly * h * .9, -lx * w * .5, -ly * h * .9); bg.addColorStop(0, 'rgba(255,255,255,.55)'); bg.addColorStop(.45, 'rgba(255,255,255,0)'); bg.addColorStop(.6, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,.6)');
    rectPath(a, i, true); ctx.strokeStyle = bg; ctx.lineWidth = R(3.2); ctx.stroke(); ctx.restore();
  } finally { ctx = old; Z = z0; }
  return planetCache[key] = { c, pw, ph };
}
function drawAsteroid(a, i) {
  if (a[5] && (ship.broken >> i) & 1) return;
  const ask = skinOf('asteroids', i), sp = asteroidSprite(a, i, ask), f = Z / AST_ZMAX;
  ctx.save(); ctx.translate(X(a[0]), Y(a[1])); ctx.rotate(a[4]);
  ctx.drawImage(sp.c, -sp.pw / 2 * f, -sp.ph / 2 * f, sp.pw * f, sp.ph * f);
  astPaint(a, i, ask, true);
  if (a[5]) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; const w = R(a[2]); ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(k * w / 6, -R(a[3]) / 2); ctx.lineTo(k * w / 6 + R(5), 0); ctx.lineTo(k * w / 6 - R(3), R(a[3]) / 2); } ctx.stroke(); }
  ctx.restore();
}
// v3.3.1: static board pieces are baked once per level at max-zoom size (per DPR) and blitted scaled — no gradients / text / path work per frame
const pieceCache = {}; // level-independent pieces (stars, magnets): kept across levels, keyed by DPR/scale
function baked(key, size, paint, keep) { const k = key + '@' + DPR + '_' + Math.round(SC * 1000), cache = keep ? pieceCache : planetCache; const sp = cache[k]; if (sp) return sp;
  const z0 = Z, old = ctx; Z = AST_ZMAX; const [pw, ph] = size(); const c = document.createElement('canvas'); c.width = Math.ceil(pw * DPR); c.height = Math.ceil(ph * DPR);
  ctx = c.getContext('2d'); ctx.scale(DPR, DPR); ctx.translate(pw / 2, ph / 2); try { paint(); } finally { ctx = old; Z = z0; } return cache[k] = { c, pw, ph }; }
function blit(sp, x, y, sc) { const f = Z / AST_ZMAX * (sc || 1); ctx.drawImage(sp.c, x - sp.pw / 2 * f, y - sp.ph / 2 * f, sp.pw * f, sp.ph * f); }
function gateSprite(g, gi) { return baked('gate' + gi, () => [Math.hypot(R(g[2]), R(g[3])) + R(26), Math.hypot(R(g[2]), R(g[3])) + R(26)], () => { ctx.rotate(g[4]); gateBody(g); }); }
function gateBody(g) { const w = R(g[2]), h = R(g[3]), [lx, ly] = localLight(g[4]), dep = R(4.5);
  ctx.fillStyle = 'rgba(0,0,6,.22)'; ctx.fillRect(-w / 2 - lx * R(9) - R(3), -h / 2 - ly * R(9) - R(3), w + R(6), h + R(6)); ctx.fillStyle = 'rgba(0,0,6,.38)'; ctx.fillRect(-w / 2 - lx * R(6), -h / 2 - ly * R(6), w, h);
  ctx.fillStyle = '#5b3a0b'; ctx.fillRect(-w / 2 - lx * dep, -h / 2 - ly * dep, w, h); ctx.fillStyle = '#7c4f0e'; ctx.fillRect(-w / 2 - lx * dep * .5, -h / 2 - ly * dep * .5, w, h);
  const mg = ctx.createLinearGradient(lx * w * .5, ly * h * .5, -lx * w * .5, -ly * h * .5); mg.addColorStop(0, '#fef08a'); mg.addColorStop(.5, '#eab308'); mg.addColorStop(1, '#a16207'); ctx.fillStyle = mg; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip(); ctx.fillStyle = 'rgba(28,25,23,.78)';
  for (let k = -w / 2 - h; k < w / 2 + h; k += R(14)) { ctx.beginPath(); ctx.moveTo(k, -h / 2); ctx.lineTo(k + R(7), -h / 2); ctx.lineTo(k + R(7) + h, h / 2); ctx.lineTo(k + h, h / 2); ctx.closePath(); ctx.fill(); } ctx.restore();
  const bv = ctx.createLinearGradient(lx * w * .5, ly * h * .5, -lx * w * .5, -ly * h * .5); bv.addColorStop(0, 'rgba(255,255,255,.85)'); bv.addColorStop(.5, 'rgba(255,255,255,.1)'); bv.addColorStop(1, 'rgba(0,0,0,.6)');
  ctx.strokeStyle = bv; ctx.lineWidth = Math.max(1, R(1.6)); ctx.strokeRect(-w / 2 + R(.8), -h / 2 + R(.8), w - R(1.6), h - R(1.6));
  ctx.font = `${R(14)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🔒', 0, R(5)); ctx.textAlign = 'left'; }
function drawGate(g, t, gi) {
  if ((ship.keys >> g[5]) & 1) return; const x = X(g[0]), y = Y(g[1]); blit(gateSprite(g, gi), x, y);
  ctx.save(); ctx.translate(x, y); ctx.rotate(g[4]); ctx.fillStyle = `rgba(254,240,138,${(.1 + .1 * Math.sin(t * 4)).toFixed(3)})`; const w = R(g[2]), h = R(g[3]); ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
}
function drawKey(k, i, t) {
  if ((ship.keys >> i) & 1) return; const x = X(k[0]), y = Y(k[1]); glow(x, y, R(26), 'rgba(250,204,21,A)', .5);
  ctx.font = `${R(22)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🔑', x, y + R(8) + Math.sin(t * 3) * R(2)); ctx.textAlign = 'left';
}
function drawWorm(w, t, i) {
  const cols = ['52,211,153', '244,114,182', '96,165,250']; const c = cols[i % 3];
  for (const P of [w.a, w.b]) {
    const x = X(P[0]), y = Y(P[1]), r = R(w.r || 16); glow(x, y, r * 2.4, `rgba(${c},A)`, .45);
    ctx.save(); ctx.translate(x, y); for (let k = 0; k < 4; k++) { ctx.rotate(t * (1.5 + k * .4)); ctx.strokeStyle = `rgba(${c},${.9 - k * .18})`; ctx.lineWidth = R(2.2); ctx.beginPath(); ctx.arc(0, 0, r * (1 - k * .2), k, k + 4); ctx.stroke(); } ctx.restore();
    ctx.strokeStyle = `rgba(${c},.9)`; ctx.lineWidth = 2; const ex = x + Math.cos(P[2]) * r * 1.9, ey = y + Math.sin(P[2]) * r * 1.9;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(P[2]) * r * 1.1, y + Math.sin(P[2]) * r * 1.1); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(P[2] - .5) * R(7), ey - Math.sin(P[2] - .5) * R(7)); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(P[2] + .5) * R(7), ey - Math.sin(P[2] + .5) * R(7)); ctx.stroke();
  }
}
function drawField(f, t) {
  const x = X(f[0]), y = Y(f[1]), w = R(f[2]), h = R(f[3]); const lift = f[7] === 'lift'; const col = lift ? '52,211,153' : '250,204,21';
  ctx.fillStyle = `rgba(${col},.06)`; ctx.fillRect(x, y, w, h); ctx.strokeStyle = `rgba(${col},.22)`; ctx.setLineDash([6, 6]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  const r = rng(Math.round(f[1]) + 3), dx = f[4], dy = f[5];
  for (let k = 0; k < 34; k++) { const sp = .25 + r() * .35; let px = r(), py = r(); px = ((px + t * sp * dx) % 1 + 1) % 1; py = ((py + t * sp * dy) % 1 + 1) % 1;
    const xx = x + px * w, yy = y + py * h; ctx.strokeStyle = `rgba(${col},${.25 + r() * .4})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - dx * R(12), yy - dy * R(12)); ctx.stroke(); }
}
function drawFlare(f, t) {
  const on = S.flareOn(f, t), ph = ((t + (f.ph || 0)) % f.period + f.period) % f.period, warn = !on && f.period - ph < 0.5;
  const x = X(f.x), y = Y(f.y), w = R(f.w), h = R(f.h);
  if (on) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(251,146,60,.15)'); g.addColorStop(.5, `rgba(254,215,170,${.55 + .2 * Math.sin(t * 30)})`); g.addColorStop(1, 'rgba(251,146,60,.15)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); }
  else { ctx.fillStyle = warn ? `rgba(251,146,60,${.15 + .15 * Math.sin(t * 25)})` : 'rgba(251,146,60,.05)'; ctx.fillRect(x, y, w, h); }
  ctx.strokeStyle = on ? 'rgba(254,215,170,.9)' : 'rgba(251,146,60,.35)'; ctx.setLineDash(on ? [] : [5, 5]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  ctx.fillStyle = on ? '#fff7ed' : 'rgba(253,186,116,.7)'; ctx.font = `bold ${R(11)}px sans-serif`; ctx.fillText(on ? T('flare.on') : warn ? T('flare.soon') : '☀ ' + (f.period - ph).toFixed(1) + T('hud.sec'), x + R(6), y + R(14));
}
function drawMagnet(m, t) {
  const x = X(m[0]), y = Y(m[1]), pol = (m[4] || 1) * ship.flip, col = pol > 0 ? '248,113,113' : '96,165,250';
  ctx.strokeStyle = `rgba(${col},.3)`; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(x, y, R(m[3]), 0, 7); ctx.stroke(); ctx.setLineDash([]);
  for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; let s = (t * .7 + k / 10) % 1; s = pol > 0 ? 1 - s : s; const rr = R(m[3]) * (1 - s * .85); ctx.fillStyle = `rgba(${col},.9)`; ctx.beginPath(); ctx.arc(x + Math.cos(a + s) * rr, y + Math.sin(a + s) * rr, R(2), 0, 7); ctx.fill(); }
  if (skinOf('magnets', L.magnets.indexOf(m)) === 'magnetar') { // neutron-star look: blazing core + rotating twin beams, polarity ring and +/- kept
    neutronBeams(x, y, R(8), col); glow(x, y, R(22), `rgba(${col},A)`, .7); const cg = ctx.createRadialGradient(x, y, 0, x, y, R(8)); cg.addColorStop(0, '#ffffff'); cg.addColorStop(.5, '#e0f2fe'); cg.addColorStop(1, `rgba(${col},.9)`);
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y, R(7), 0, 7); ctx.fill(); ctx.strokeStyle = pol > 0 ? '#ef4444' : '#3b82f6'; ctx.lineWidth = R(2.5); ctx.beginPath(); ctx.arc(x, y, R(11 + Math.sin(t * 8) * .8), 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${R(12)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(pol > 0 ? '+' : '−', x, y - R(15)); ctx.textAlign = 'left'; return; }
  blit(magSprite(pol), x, y);
}
function magSprite(pol) { return baked('mag' + (pol > 0 ? 1 : 0), () => [R(44), R(48)], () => {
  const hs = (dx, dy, lw, col) => { ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(dx, R(2) + dy, R(11), 0, Math.PI); ctx.moveTo(-R(11) + dx, R(2) + dy); ctx.lineTo(-R(11) + dx, -R(4) + dy); ctx.moveTo(R(11) + dx, R(2) + dy); ctx.lineTo(R(11) + dx, -R(4) + dy); ctx.stroke(); };
  ctx.lineCap = 'butt'; hs(SDX * R(2.5), SDY * R(2.5), R(7), pol > 0 ? '#7f1d1d' : '#1e3a8a'); hs(SDX * R(1.2), SDY * R(1.2), R(7), pol > 0 ? '#991b1b' : '#1d4ed8'); hs(0, 0, R(7), pol > 0 ? '#ef4444' : '#3b82f6');
  hs(Math.cos(KEY_A) * R(1.6), Math.sin(KEY_A) * R(1.6), R(1.8), 'rgba(255,255,255,.45)');
  for (const sx of [-1, 1]) { const pg = ctx.createLinearGradient(sx * R(11) - R(3.5), 0, sx * R(11) + R(3.5), 0); pg.addColorStop(0, '#f1f5f9'); pg.addColorStop(1, '#475569'); ctx.fillStyle = '#1e293b'; ctx.fillRect(sx * R(11) - R(3.5) + SDX * R(2), -R(10) + SDY * R(2), R(7), R(6)); ctx.fillStyle = pg; ctx.fillRect(sx * R(11) - R(3.5), -R(10), R(7), R(6)); }
  ctx.fillStyle = '#fff'; ctx.font = `bold ${R(12)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(pol > 0 ? '+' : '−', 0, -R(14)); ctx.textAlign = 'left'; }, true); }
function torusSprite() { return baked('torus' + L.pr, () => [R(L.pr) * 2.2 + R(22), R(L.pr) * 2.2 + R(22)], () => { const r = R(L.pr), rf = r * 1.1, lw = Math.max(2, R(3.6));
  ctx.strokeStyle = 'rgba(0,0,6,.5)'; ctx.lineWidth = lw * 1.5; ctx.beginPath(); ctx.arc(SDX * R(5), SDY * R(5), rf, 0, 7); ctx.stroke();
  const tg = ctx.createLinearGradient(Math.cos(KEY_A) * rf, Math.sin(KEY_A) * rf, -Math.cos(KEY_A) * rf, -Math.sin(KEY_A) * rf); tg.addColorStop(0, '#f1f5f9'); tg.addColorStop(.35, '#94a3b8'); tg.addColorStop(.7, '#334155'); tg.addColorStop(1, '#0f172a');
  ctx.strokeStyle = tg; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, 0, rf, 0, 7); ctx.stroke(); ctx.strokeStyle = 'rgba(103,232,249,.55)'; ctx.lineWidth = Math.max(.8, lw * .25); ctx.beginPath(); ctx.arc(0, 0, rf - lw * .5, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(.8, lw * .3); ctx.beginPath(); ctx.arc(0, 0, rf + lw * .15, KEY_A - .6, KEY_A + .6); ctx.stroke(); }); }
function drawPortal(t) {
  const x = X(L.portal[0]), y = Y(L.portal[1]), r = R(L.pr); glow(x, y, r * 2.4, 'rgba(34,211,238,A)', .35);
  blit(torusSprite(), x, y); // v3.3.0 machined torus ring (baked in 3.3.1)
  ctx.save(); ctx.translate(x, y); for (let k = 0; k < 5; k++) { ctx.rotate(t * (0.8 + k * .3)); ctx.strokeStyle = `rgba(${k % 2 ? '165,243,252' : '34,211,238'},${.8 - k * .12})`; ctx.lineWidth = R(2.4); ctx.beginPath(); ctx.arc(0, 0, r * (1 - k * .16), k, k + 4.2); ctx.stroke(); } ctx.restore();
  glow(x, y, r * .6, 'rgba(236,254,255,A)', .95);
  if (y < 0 || y > H) { const ay = y < 0 ? 70 : H - 30; ctx.fillStyle = '#22d3ee'; ctx.font = `bold ${R(16)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(T(y < 0 ? 'portal.up' : 'portal.down'), x, ay); ctx.textAlign = 'left'; }
}
function drawStar(s, k, t) {
  if (collected.has(k)) return; const x = X(s[0]), y = Y(s[1]), p = 1 + Math.sin(t * 4 + k) * .18; glow(x, y, R(22) * p, 'rgba(253,224,71,A)', .45);
  const bob = Math.sin(t * 2.2 + k) * R(1.5); cshadow(x, y, R(10) * p, R(9) + bob, .55);
  const P5 = Math.PI * 2 / 5, st = Math.floor((((t * .9 + k) % P5 + P5) % P5) / P5 * 16) % 16; blit(starSprite(st), x, y - bob, p);
}
function starSprite(st) { return baked('star' + st, () => [R(28), R(28)], () => { const rot = st / 16 * Math.PI * 2 / 5, [lx, ly] = localLight(rot); ctx.rotate(rot); // faceted gold star (10 facets lit by the key light)
  const ro = R(11.5), ri = R(5.2); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2, tx = Math.cos(a) * ro, ty = Math.sin(a) * ro;
    for (const sd of [-1, 1]) { const ia = a + sd * Math.PI / 5, ix = Math.cos(ia) * ri, iy = Math.sin(ia) * ri, na = a + sd * .55; ctx.fillStyle = facetCol(.62 + .5 * (Math.cos(na) * lx + Math.sin(na) * ly));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tx, ty); ctx.lineTo(ix, iy); ctx.closePath(); ctx.fill(); } }
  ctx.strokeStyle = 'rgba(255,251,235,.55)'; ctx.lineWidth = Math.max(.6, R(.6)); ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? ri : ro, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(lx * R(2.2), ly * R(2.2), R(1.4), 0, 7); ctx.fill(); }, true); }
// v3.1.7: the ship is drawn a bit larger while aiming so it reads clearly at small scales; visual only, the hitbox is unchanged
let shipVis = 1.3; const shipVisT = () => (state === 'aim' ? 1.32 : 1.12);
function drawShuttle() {
  const x = X(ship.x), y = Y(ship.y); shipVis += (shipVisT() - shipVis) * Math.min(1, (drawShuttle.dt || .016) * 6);
  const ang = state === 'fly' && Math.hypot(ship.vx, ship.vy) > 2 ? Math.atan2(ship.vy, ship.vx) : aim ? aimVec().a : ship.ang; ship.ang = ang;
  const dt = drawShuttle.dt || .016; shipFX.sqT += dt;
  // banking from the turn rate (visual only)
  if (shipFX.pa != null && state === 'fly' && dt > 0) { const rate = wrapA(ang - shipFX.pa) / dt; shipFX.bank += (Math.max(-1, Math.min(1, rate * .32)) - shipFX.bank) * Math.min(1, dt * 5); } else shipFX.bank *= Math.max(0, 1 - dt * 4);
  shipFX.spinA += shipFX.spinV * dt; shipFX.spinV *= Math.exp(-dt * 3.2); shipFX.spinA *= Math.exp(-dt * (state === 'fly' ? 2.6 : 8)); // v3.3.0 knock-spin from hits (visual)
  shipFX.pa = ang; shipFX.wheel += dt * (state === 'fly' ? Math.hypot(ship.vx, ship.vy) * .012 : .12);
  if (state === 'result' && shipFX.win) return drawWinFlourish(dt);
  // spaghettification: stretch toward the nearest hole
  let sp = 0, sa = 0; if (L) for (const h of L.holes) { const [hx, hy] = S.holePos(h, ship.t); const d = Math.hypot(hx - ship.x, hy - ship.y); const k = Math.max(0, 1 - (d - h.r * S.KILL) / (h.r * 3.5)); if (k > sp) { sp = k; sa = Math.atan2(hy - ship.y, hx - ship.x); } }
  const st = 1 + sp * sp * 0.95;
  // slow-motion echoes
  if (L && state === 'fly' && (slowT > 0 || tf < 0.75) && trail.length > 16) { for (let e = 4; e >= 1; e--) { const p = trail[Math.max(0, trail.length - 1 - e * 4)]; ctx.globalAlpha = 0.09 * (5 - e); drawHull(X(p.x), Y(p.y), ang, 1, 0, null, true); } ctx.globalAlpha = 1; }
  const idle = state === 'aim' ? Math.sin(animT * 1.3) * .025 : 0; if (L) cshadow(x, y, R(8) * shipVis, R(12) * shipVis, .42); // v3.3.0 the ship hovers above the board
  drawHull(x, y + (state === 'aim' ? Math.sin(animT * 1.9) * R(.35) : 0), ang + idle + shipFX.spinA, st, sa, lightAt(ship.x, ship.y), false);
}
// v3.2.0: win flourish — the ship spirals into the portal, shrinking, with a sparkle ring
function drawWinFlourish(dt) {
  const w = shipFX.win; w.t += dt; const e = Math.min(1, w.t / .75), q = e * e * (3 - 2 * e), [px, py] = L.portal, a0 = Math.atan2(w.y - py, w.x - px), d0 = Math.hypot(w.x - px, w.y - py) * (1 - q), aa = a0 + q * 3.2;
  const x = px + Math.cos(aa) * d0, y = py + Math.sin(aa) * d0;
  if (e < 1) { ctx.globalAlpha = 1 - e * e; drawHull(X(x), Y(y), w.ang + q * 7, 1, 0, { a: Math.atan2(py - y, px - x), c: '165,243,252', k: 1 }, false, R(1) * shipVis * (1 - q * .88)); ctx.globalAlpha = 1;
    if (Math.random() < .6) spark(x, y, ['#67e8f9', '#fde047', '#fff'][Math.floor(Math.random() * 3)], 30 + Math.random() * 60); }
  if (w.t > .55 && w.t < 1.4) { const k = (w.t - .55) / .85; ctx.strokeStyle = `rgba(103,232,249,${1 - k})`; ctx.lineWidth = R(3) * (1 - k); ctx.beginPath(); ctx.arc(X(px), Y(py), R(10 + k * 60), 0, 7); ctx.stroke();
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + k * 2, r = R(14 + k * 50); ctx.fillStyle = `rgba(253,224,71,${1 - k})`; ctx.beginPath(); ctx.arc(X(px) + Math.cos(a) * r, Y(py) + Math.sin(a) * r, R(1.6) * (1 - k * .6), 0, 7); ctx.fill(); } }
}
// v3.2.0: death animation — pulled into the hole (spiral, spaghettified, purple-shifted) or a tumbling break-up for other failures
function drawDeath(dt) {
  const d = shipFX.death; if (!d) return; d.t += dt; if (d.t > 1.1) return; const e = Math.min(1, d.t / (d.hx != null ? .8 : .35)); // v3.3.0: non-hole deaths blow apart (explodeFX) — the hull fades fast under the debris
  if (d.hx != null) { const q = e * e, a0 = Math.atan2(d.y - d.hy, d.x - d.hx), r0 = Math.hypot(d.x - d.hx, d.y - d.hy), aa = a0 + q * 5, r = r0 * (1 - q);
    const x = d.hx + Math.cos(aa) * r, y = d.hy + Math.sin(aa) * r; if (e >= 1) return; ctx.globalAlpha = 1 - q;
    drawHull(X(x), Y(y), aa + 1.57 + q * 2, 1 + q * 3, Math.atan2(d.hy - y, d.hx - x), { a: Math.atan2(d.hy - y, d.hx - x), c: '192,132,252', k: 1 }, false, R(1) * shipVis * (1 - q * .7), d.kind); ctx.globalAlpha = 1;
    if (Math.random() < .5) spark(x, y, 'rgba(192,132,252,.9)', 20 + Math.random() * 40, Math.atan2(d.hy - y, d.hx - x) + (Math.random() - .5)); }
  else { if (e >= 1) return; const x = d.x + d.vx * d.t * .25, y = d.y + d.vy * d.t * .25; ctx.globalAlpha = (1 - e) * .9; drawHull(X(x), Y(y), d.ang + e * 9, 1, 0, { a: -2.3, c: '254,202,202', k: 1 }, false, R(1) * shipVis * (1 - e * .45), d.kind); ctx.globalAlpha = 1; }
}
function shipDev() { return SC * DPR * 1.14 * 1.32; } // device px per world unit at max zoom: one sprite bucket per viewport (no rebuilds in flight)
function drawHull(x, y, ang, st, sa, lt, ghostly, kk, kind) {
  ctx.save(); ctx.translate(x, y);
  if (st > 1.01) { ctx.rotate(sa); ctx.scale(st, 1 / Math.sqrt(st)); ctx.rotate(-sa); }
  ctx.rotate(ang); const k = kk || R(1) * shipVis, kd = kind || save.set.ship, rd = kd === 'roadster', live = !ghostly && !kk && (state === 'fly' || state === 'aim');
  if (shieldOn && !ghostly && !kk) { ctx.strokeStyle = `rgba(103,232,249,${.5 + .3 * Math.sin(animT * 6)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, (rd ? 17 : 16) * k, 0, 7); ctx.stroke(); }
  const fly = state === 'fly', sq = live && shipFX.sqT < .7 ? .2 * Math.exp(-shipFX.sqT * 7) * Math.cos(shipFX.sqT * 22) : 0;
  SHIPS.draw(ctx, kd, { k, dev: shipDev(), t: animT, refl: ang, ghost: ghostly ? '#a5b4fc' : null,
    engine: kk && !ghostly ? (fly ? .45 : .1) : live ? (fly && !braking ? .42 + thrust * 1.65 : state === 'aim' ? .1 : 0) : 0, ignite: live && fly ? Math.max(0, thrust - .15) * 4 : 0,
    braking: live && braking, light: lt ? { a: lt.a - ang, c: lt.c, k: lt.k } : null, hole: live && fly ? proxK : 0, bank: live ? shipFX.bank : 0, squash: sq, jolt: sq * 2,
    wheel: shipFX.wheel, gas: live && fly ? Math.min(1, thrust * 3) : 0 });
  ctx.restore();
}
// v3.2.0: ship models live in ships.js (BHShips): pre-rendered high-res sprites + light per-frame layers
// cold-gas puff (world coords): soft white cloud that expands and fades
function puff(x, y, vx, vy) { const p = pnew(x, y, vx, vy, .55 + Math.random() * .4, 1.6 + Math.random(), '#fff'); p.l0 = .95; p.puff = 1; }
function smoke(x, y, vx, vy, r) { pnew(x, y, vx, vy, .7 + Math.random() * .6, r || 1.4 + Math.random(), '').smoke = 1; }
function ice(x, y, vx, vy) { const p = pnew(x, y, vx, vy, .5 + Math.random() * .6, .5 + Math.random() * .7, ''); p.ice = 1; p.ph = Math.random() * 6; }
function roadsterJets() { const a = ship.ang, ca = Math.cos(a), sa = Math.sin(a), W = (lx, ly) => [ship.x + ca * lx - sa * ly, ship.y + sa * lx + ca * ly];
  if (thrust > 0.02) for (const s of [-.45, .45]) for (let q = 0; q < 2; q++) { const [x, y] = W(-12.4, s); const j = (Math.random() - .5) * .45 + s * .25, v = 70 + Math.random() * 70; puff(x, y, ship.vx * .3 - Math.cos(a + j) * v, ship.vy * .3 - Math.sin(a + j) * v); if (Math.random() < .7) ice(x, y, ship.vx * .3 - Math.cos(a + j * 2) * v * 1.2, ship.vy * .3 - Math.sin(a + j * 2) * v * 1.2); }
  if (braking) for (const s of [-3.05, 3.05]) { const [x, y] = W(13.8, s); const j = (Math.random() - .5) * .6 + s * .05, v = 60 + Math.random() * 50; puff(x, y, ship.vx * .2 + Math.cos(a + j) * v, ship.vy * .2 + Math.sin(a + j) * v); if (Math.random() < .5) ice(x, y, ship.vx * .2 + Math.cos(a + j) * v * 1.3, ship.vy * .2 + Math.sin(a + j) * v * 1.3); } }
// shuttle: exhaust smoke + hot sparks from the bells; nose RCS puffs while braking
function shuttleJets() { const a = ship.ang, ca = Math.cos(a), sa = Math.sin(a), W = (lx, ly) => [ship.x + ca * lx - sa * ly, ship.y + sa * lx + ca * ly], spd = Math.hypot(ship.vx, ship.vy);
  if (!braking) { const [x, y] = W(-13, (Math.random() - .5) * 2.4), n = (qLevel === 0 ? .3 : qLevel === 1 ? .7 : 1.1) * (.5 + thrust * 6); // smoke is fill-rate heavy: scale with quality
    for (let q = 0; q < n; q++) if (Math.random() < .8) { const j = (Math.random() - .5) * .35, v = 30 + Math.random() * 40 + thrust * 160; smoke(x, y, ship.vx * .25 - Math.cos(a + j) * v, ship.vy * .25 - Math.sin(a + j) * v, 1.1 + thrust * 3); }
    if (Math.random() < .5 + thrust * 2) spark(x, y, ['rgba(186,230,253,.9)', 'rgba(167,139,250,.8)', 'rgba(255,255,255,.85)'][Math.floor(Math.random() * 3)], 30 + Math.random() * 40 + spd * .2, a + Math.PI + (Math.random() - .5) * .4); }
  else for (const s of [-1.75, 1.75]) if (Math.random() < .6) { const [x, y] = W(12, s), j = (Math.random() - .5) * .5 + Math.sign(s) * .35, v = 50 + Math.random() * 40; puff(x, y, ship.vx * .2 + Math.cos(a + j) * v, ship.vy * .2 + Math.sin(a + j) * v); } }
let pcv = null;
function drawShipPrev() { const c = $('shipPrev'); if (!c) return; const d = Math.min(3, window.devicePixelRatio || 1), cw = c.clientWidth || 300, ch = c.clientHeight || 150, pw = Math.round(cw * d), ph = Math.round(ch * d);
  if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, pw, ph); SHIPS.preview(x, save.set.ship, pw, ph, animT); }
function drawGhost() {
  if (!ghost || ghost.length < 2) return; ctx.strokeStyle = 'rgba(203,213,225,.22)'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]); ctx.beginPath();
  ghost.forEach((p, i) => { if (i === 0 || p[2]) ctx.moveTo(X(p[0]), Y(p[1])); else ctx.lineTo(X(p[0]), Y(p[1])); }); ctx.stroke(); ctx.setLineDash([]);
  const e = ghost[ghost.length - 1]; ctx.fillStyle = 'rgba(248,113,113,.5)'; ctx.font = `${R(12)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('✕', X(e[0]), Y(e[1]) + R(4)); ctx.textAlign = 'left';
}
function drawTrail() {
  for (let i = 1; i < trail.length; i++) { const a = i / trail.length, p = trail[i - 1], q = trail[i], hue = 265 - (1 - q.tf) * 90;
    ctx.strokeStyle = `hsla(${hue},95%,${62 + (1 - q.tf) * 18}%,${a * .9})`; ctx.lineWidth = R(1 + a * 3 + (1 - q.tf) * 4); ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y)); ctx.lineTo(X(q.x), Y(q.y)); ctx.stroke(); }
}
function drawAim() {
  if (state !== 'aim') return; const x = X(ship.x), y = Y(ship.y);
  if (!aim) { const p = (Math.sin(animT * 4) + 1) / 2; ctx.strokeStyle = `rgba(34,211,238,${.3 + p * .4})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R(18 + p * 6), 0, 7); ctx.stroke(); return; }
  const v = aimVec();
  preview.forEach((p, i) => { const a = 1 - i / preview.length; ctx.fillStyle = `rgba(103,232,249,${.85 * a})`; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), R(1.2 + 2 * a), 0, 7); ctx.fill(); });
  // short cosmic beam from the nose (same short length as the old stub — not a trajectory)
  if (aim.ang == null) { const p = (Math.sin(animT * 6) + 1) / 2; ctx.strokeStyle = `rgba(233,213,255,${.25 + p * .3})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, R(22), 0, 7); ctx.stroke(); }
  const k = v.pct / 100, col = powerCol(k);
  // power ring
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = R(3); ctx.beginPath(); ctx.arc(x, y, R(21 * Math.max(1, shipVis * .92)), 0, 7); ctx.stroke();
  const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${col},.35)`; ctx.lineWidth = R(6); ctx.beginPath(); ctx.arc(x, y, R(21 * Math.max(1, shipVis * .92)), -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke();
  ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = R(2.2); ctx.beginPath(); ctx.arc(x, y, R(21 * Math.max(1, shipVis * .92)), -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke(); ctx.globalCompositeOperation = pc; ctx.lineCap = 'butt';
  const [tx, ty] = readoutPos(x, y, v.a); ctx.fillStyle = `rgb(${col})`; ctx.font = `bold ${Math.max(13, R(15))}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(v.pct + '%', tx, ty);
  ctx.font = `${Math.max(11, R(10))}px sans-serif`; ctx.fillStyle = aim.fine ? '#fde68a' : '#c4b5fd'; ctx.fillText((aim.ang != null ? Math.round((-v.a * 180 / Math.PI + 360) % 360) + '°' : '') + (aim.fine ? T('aim.fine') : ''), tx, ty + Math.max(13, R(12))); ctx.textAlign = 'left';
}
// v3.1.7: power/angle readout: below the ring by default; if that would leave the screen (ship near the bottom edge) or sit on the beam,
// try above / left / right. Returns the baseline of the first line; the block is ~2 lines tall and clamped inside the viewport.
function readoutPos(x, y, a) { const d = R(46 * Math.max(1, shipVis * .92)), lh = Math.max(13, R(12)), hb = Math.max(15, R(15)), half = Math.max(48, R(40)), ca = Math.cos(a), sa = Math.sin(a);
  const C = [[0, 1], [0, -1], [-1, 0], [1, 0]].filter(([dx, dy]) => dx * ca + dy * sa < .55);
  for (const [dx, dy] of C) { const tx = x + dx * (d + half * .6), ty = y + dy * d + (dy < 0 ? -lh : dx ? -lh * .3 : 0);
    if (ty - hb >= 4 && ty + lh + 4 <= H && tx - half >= 2 && tx + half <= W - 2) return [tx, ty]; }
  const [dx, dy] = C[0] || [0, -1]; return [Math.max(half, Math.min(W - half, x + dx * (d + half * .6))), Math.max(hb + 4, Math.min(H - lh - 6, y + dy * d))]; }
function powerCol(k) { // teal -> violet -> gold -> rose
  const st = [[0, [94, 234, 212]], [.45, [167, 139, 250]], [.75, [253, 224, 71]], [1, [251, 113, 133]]]; let i = 0; while (i < st.length - 2 && k > st[i + 1][0]) i++;
  const [k0, c0] = st[i], [k1, c1] = st[i + 1], f = Math.max(0, Math.min(1, (k - k0) / (k1 - k0))); return c0.map((c, j) => Math.round(c + (c1[j] - c) * f)).join(',');
}
let beamParts = [];
// v3.1.7 beam: clean tapered core + soft glow + a few subtle sparkles, all vector paths on the full-DPR gameplay layer.
// It starts exactly at the hull's nose (13 hull units for the shuttle, 14 for the roadster, times the visual scale) along the aim angle.
function noseOffset() { return (save.set.ship === 'roadster' ? 14 : 13) * shipVis; }
function taper(x0, y0, ca, sa, len, hw) { const px = -sa * hw, py = ca * hw, x1 = x0 + ca * len, y1 = y0 + sa * len;
  ctx.beginPath(); ctx.moveTo(x0 + px, y0 + py); ctx.quadraticCurveTo(x0 + ca * len * .5 + px * .7, y0 + sa * len * .5 + py * .7, x1, y1);
  ctx.quadraticCurveTo(x0 + ca * len * .5 - px * .7, y0 + sa * len * .5 - py * .7, x0 - px, y0 - py); ctx.arc(x0, y0, hw, Math.atan2(-py, -px), Math.atan2(py, px), false); ctx.closePath(); }
function drawBeam(v) {
  const k = v.pct / 100, col = powerCol(k), a = v.a, ca = Math.cos(a), sa = Math.sin(a);
  const len = R((L.stub === 2 ? 84 : 46) * (0.55 + v.pct / 220)), no = R(noseOffset()), x0 = X(ship.x) + ca * no, y0 = Y(ship.y) + sa * no, x1 = x0 + ca * len, y1 = y0 + sa * len;
  const hw = R(1.6 + k * 1.3) * (1 + Math.sin(animT * 18) * .04);
  const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  const grad = (a0, a1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(${col},${a0})`); g.addColorStop(.65, `rgba(${col},${a1})`); g.addColorStop(1, `rgba(${col},0)`); return g; };
  ctx.fillStyle = grad(.16, .07); taper(x0, y0, ca, sa, len * 1.04, hw * 3.4); ctx.fill();      // soft outer glow
  ctx.fillStyle = grad(.38, .18); taper(x0, y0, ca, sa, len, hw * 1.9); ctx.fill();             // inner glow
  const cg = ctx.createLinearGradient(x0, y0, x1, y1); cg.addColorStop(0, 'rgba(255,255,255,.95)'); cg.addColorStop(.55, `rgba(${col},.85)`); cg.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = cg; taper(x0, y0, ca, sa, len * .96, hw * .62); ctx.fill();                    // hot core
  glow(x0, y0, hw * 3, 'rgba(255,255,255,A)', .35);                                              // nozzle bloom
  // subtle sparkles drifting along the beam (tiny round dots, low alpha)
  if (beamParts.length < (qLevel === 0 ? 6 : 12) && Math.random() < .5) beamParts.push({ f: Math.random() * .15, o: (Math.random() - .5) * 2, v: .7 + Math.random() * .9, l: 1, s: .5 + Math.random() * .6 });
  const dt = drawShuttle.dt || .016;
  for (let i = beamParts.length - 1; i >= 0; i--) { const b = beamParts[i]; b.f += b.v * dt; b.l -= dt * 1.4; if (b.f > 1 || b.l <= 0) { beamParts.splice(i, 1); continue; }
    const o = b.o * hw * 1.6 * (1 - b.f), bx = x0 + ca * len * b.f - sa * o, by = y0 + sa * len * b.f + ca * o;
    ctx.fillStyle = `rgba(255,255,255,${(.45 * b.l * (1 - b.f)).toFixed(3)})`; ctx.beginPath(); ctx.arc(bx, by, R(b.s), 0, 7); ctx.fill(); }
  ctx.globalCompositeOperation = pc;
  // faint pull band (shows drag, not the path)
  const t0 = noseOffset() * .75, sx0 = ship.x - ca * t0, sy0 = ship.y - sa * t0, bx = sx0 - ca * v.p * 0.45, by = sy0 - sa * v.p * 0.45; const pg = ctx.createLinearGradient(X(sx0), Y(sy0), X(bx), Y(by)); pg.addColorStop(0, `rgba(${col},.35)`); pg.addColorStop(1, `rgba(${col},0)`);
  ctx.strokeStyle = pg; ctx.lineWidth = R(1.6); ctx.setLineDash([R(2), R(5)]); ctx.beginPath(); ctx.moveTo(X(sx0), Y(sy0)); ctx.lineTo(X(bx), Y(by)); ctx.stroke(); ctx.setLineDash([]);
}
// ---------- v3.1.7 playfield boundary: energy barrier exactly on the out-of-bounds limit (sim3: x<-OOB, x>W+OOB, y<-OOB, y>H+OOB) ----------
const OOB = 40; let edgeRipples = [], edgeNearT = 0;
function edgeRect() { return [X(-OOB), Y(-OOB), X(L.W + OOB), Y(L.H + OOB)]; }
let railS = null; function railStrips() { if (railS) return railS; const mk = (w, h, vert) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), g = vert ? x.createLinearGradient(0, 0, 0, h) : x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,6,.5)'); g.addColorStop(1, 'rgba(0,0,6,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); return c; }; return railS = { v: mk(1, 64, true), h: mk(64, 1, false) }; }
function drawBorder() {
  const [x0, y0, x1, y1] = edgeRect(), dt = drawShuttle.dt || .016, pc = ctx.globalCompositeOperation;
  // darker space outside the field
  ctx.fillStyle = 'rgba(3,1,14,.5)'; ctx.beginPath(); ctx.rect(-50, -50, W + 100, H + 100); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.fill('evenodd');
  // v3.3.0: the field edge is a bevelled rail — top/left rails throw a shadow onto the board, the bottom/right inner walls catch the key light
  { const rw = Math.max(3, R(6)), sw = Math.max(8, R(18));
    const st = railStrips(); // pre-rendered gradient strips (no gradient objects per frame)
    if (y0 > -sw && y0 < H) ctx.drawImage(st.v, x0, y0, x1 - x0, sw); if (x0 > -sw && x0 < W) ctx.drawImage(st.h, x0, y0, sw, y1 - y0);
    ctx.fillStyle = '#2e1065'; ctx.fillRect(x0 - rw, y0 - rw, x1 - x0 + rw * 2, rw); ctx.fillRect(x0 - rw, y0, rw, y1 - y0); // top/left rails: inner wall in shade
    ctx.fillStyle = '#4338ca'; ctx.fillRect(x0 - rw, y1, x1 - x0 + rw * 2, rw); ctx.fillRect(x1, y0, rw, y1 - y0); // bottom/right rails: inner wall faces the light
    ctx.fillStyle = 'rgba(199,210,254,.75)'; ctx.fillRect(x0, y1, x1 - x0, Math.max(1, rw * .25)); ctx.fillRect(x1, y0, Math.max(1, rw * .25), y1 - y0); }
  // soft violet haze just outside each visible edge
  const hz = Math.max(10, R(22)); ctx.globalCompositeOperation = 'lighter';
  const band = (gx0, gy0, gx1, gy1, rx, ry, rw, rh) => { const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, 'rgba(139,92,246,.16)'); g.addColorStop(1, 'rgba(139,92,246,0)'); ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh); };
  if (x0 > -hz) band(x0, 0, x0 - hz, 0, x0 - hz, y0, hz, y1 - y0); if (x1 < W + hz) band(x1, 0, x1 + hz, 0, x1, y0, hz, y1 - y0);
  if (y0 > -hz) band(0, y0, 0, y0 - hz, x0, y0 - hz, x1 - x0, hz); if (y1 < H + hz) band(0, y1, 0, y1 + hz, x0, y1, x1 - x0, hz);
  // neon line + slow travelling energy dashes
  const pulse = .5 + .5 * Math.sin(animT * 1.7), lw = Math.max(1, R(1.1));
  ctx.strokeStyle = `rgba(167,139,250,${(.42 + .18 * pulse).toFixed(3)})`; ctx.lineWidth = lw * 2.6; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = `rgba(224,231,255,${(.55 + .2 * pulse).toFixed(3)})`; ctx.lineWidth = lw * .8; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([R(10), R(26)]); ctx.lineDashOffset = -animT * R(22); ctx.strokeStyle = 'rgba(103,232,249,.55)'; ctx.lineWidth = lw * 1.6; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  // proximity: the barrier lights up where the ship approaches it (also shown at the screen edge when the barrier itself is just off-screen)
  if (ship && state === 'fly') { const dl = ship.x + OOB, dr = L.W + OOB - ship.x, du = ship.y + OOB, dd = L.H + OOB - ship.y, m = Math.min(dl, dr, du, dd);
    if (m < 46) { const k = 1 - Math.max(0, m) / 46; let ex = X(ship.x), ey = Y(ship.y), vert = true;
      if (m === dl) ex = x0; else if (m === dr) ex = x1; else { vert = false; ey = m === du ? y0 : y1; }
      ex = Math.max(2, Math.min(W - 2, ex)); ey = Math.max(2, Math.min(H - 2, ey));
      glow(ex, ey, R(34 + 30 * k), 'rgba(129,140,248,A)', .55 * k); const sl = R(40 + 40 * k); ctx.strokeStyle = `rgba(224,231,255,${(.9 * k).toFixed(3)})`; ctx.lineWidth = lw * (1.5 + 2 * k);
      ctx.beginPath(); if (vert) { ctx.moveTo(ex, ey - sl); ctx.lineTo(ex, ey + sl); } else { ctx.moveTo(ex - sl, ey); ctx.lineTo(ex + sl, ey); } ctx.stroke();
      edgeNearT -= dt; if (edgeNearT <= 0 && k > .55) { edgeNearT = .45; edgeRipples.push({ x: ship.x, y: ship.y, t: 0 }); } } }
  // ripples (near-pass pings + a big one when the ship crosses the barrier)
  for (let i = edgeRipples.length - 1; i >= 0; i--) { const e = edgeRipples[i]; e.t += dt; const T0 = e.big ? 1 : .6; if (e.t > T0) { edgeRipples.splice(i, 1); continue; }
    const f = e.t / T0, cx = Math.max(x0, Math.min(x1, X(e.x))), cy = Math.max(y0, Math.min(y1, Y(e.y))), sx = Math.max(2, Math.min(W - 2, cx)), sy = Math.max(2, Math.min(H - 2, cy));
    ctx.strokeStyle = `rgba(165,180,252,${((1 - f) * (e.big ? .9 : .5)).toFixed(3)})`; ctx.lineWidth = lw * (e.big ? 3 : 1.6); ctx.beginPath(); ctx.arc(sx, sy, R((e.big ? 70 : 34) * f + 4), 0, 7); ctx.stroke(); }
  if (edgeRipples.length > 12) edgeRipples.splice(0, edgeRipples.length - 12);
  ctx.globalCompositeOperation = pc;
}
// v3.1.7: the bottom hint card moves up under the HUD while the ship (plus its aim ring/readout) sits behind it, e.g. on short desktop windows
function avoidHint() { const h = $('hint'); if (!ship || !L || h.style.display === 'none') return; if ((avoidHint.n = (avoidHint.n || 0) + 1) % 6) return;
  // v3.1.8: only the ship + aim ring count (the readout repositions itself); the card never moves onto the portal — if both spots are taken it stays at the bottom, faded
  const hh = h.offsetHeight, hw = h.offsetWidth, l = (W - hw) / 2, b0 = H - 24 - hh, sx = X(ship.x), sy = Y(ship.y), rr = Math.max(30, R(34));
  const over = (cx, cy, r, top, bot) => cx + r > l && cx - r < l + hw && cy + r > top && cy - r < bot;
  let y = 0; $('hud').querySelectorAll('.col').forEach(c => y = Math.max(y, c.getBoundingClientRect().bottom)); const t0 = Math.round(y + 10);
  const hitB = over(sx, sy, rr, b0, H - 24), px = X(L.portal[0]), py = Y(L.portal[1]), pr = R(L.pr) + 8;
  const up = hitB && !over(px, py, pr, t0, t0 + hh) && !over(sx, sy, rr, t0, t0 + hh), fade = hitB && !up;
  if (up) h.style.top = t0 + 'px'; h.classList.toggle('up', up); h.classList.toggle('fade', fade); }
function drawFX(dt) {
  for (const p of parts) { if (p.l <= 0) continue; if (p.smoke) { const f = 1 - p.l / p.l0, rr = R(p.r * (1 + f * 3.2)); ctx.globalAlpha = .22 * (1 - f) * Math.min(1, f * 6 + .2); ctx.drawImage(smokeSprite(), X(p.x) - rr, Y(p.y) - rr, rr * 2, rr * 2); }
    else if (p.deb) { const f = 1 - p.l / p.l0, r = R(p.r), x = X(p.x), y = Y(p.y), c = Math.cos(p.rot), sn = Math.sin(p.rot); ctx.globalAlpha = Math.min(1, p.l * 2.2); // lit / unlit face as it tumbles
      ctx.fillStyle = Math.cos(p.rot * 1.7 - KEY_A) > 0 ? p.c : p.c2; ctx.beginPath(); ctx.moveTo(x + c * r, y + sn * r); ctx.lineTo(x - c * r * .6 - sn * r * .7, y - sn * r * .6 + c * r * .7); ctx.lineTo(x - c * r * .4 + sn * r * .8 * (1 - f * .3), y - sn * r * .4 - c * r * .8); ctx.closePath(); ctx.fill(); } }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.l -= dt; if (p.l <= 0) { const last = parts.pop(); if (i < parts.length) parts[i] = last; if (pfree.length < 600) pfree.push(p); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; if (p.smoke) { p.vx *= .985; p.vy *= .985; continue; }
    if (p.deb) { p.rot += p.vr * dt; p.vx *= .985; p.vy *= .985; continue; }
    if (p.streak) { const x = X(p.x), y = Y(p.y); ctx.globalAlpha = Math.min(1, p.l * 3); ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(.8, R(p.r)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - R(p.vx * .03), y - R(p.vy * .03)); ctx.stroke(); continue; }
    if (p.ring) { const f = 1 - p.l / p.l0, e = 1 - (1 - f) * (1 - f); ctx.globalAlpha = (1 - f) * .85; ctx.strokeStyle = `rgb(${p.c})`; ctx.lineWidth = Math.max(.8, R(3.2) * (1 - f)); ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), R(p.ph + (p.r - p.ph) * e), 0, 7); ctx.stroke(); continue; }
    if (p.flash) { const f = 1 - p.l / p.l0; glow(X(p.x), Y(p.y), R(p.r) * (.7 + f * .5), `rgba(${p.c},A)`, (1 - f) * (1 - f)); continue; }
    if (p.ice) { const f = 1 - p.l / p.l0, tw = .55 + .45 * Math.sin(animT * 22 + p.ph), r = R(p.r) * (1.4 - f * .6), x = X(p.x), y = Y(p.y); ctx.globalAlpha = (1 - f) * tw; ctx.fillStyle = '#e0f2fe';
      ctx.beginPath(); ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x + r * .35, y); ctx.lineTo(x, y + r * 1.6); ctx.lineTo(x - r * .35, y); ctx.closePath(); ctx.moveTo(x - r * 1.6, y); ctx.lineTo(x, y + r * .35); ctx.lineTo(x + r * 1.6, y); ctx.lineTo(x, y - r * .35); ctx.closePath(); ctx.fill(); continue; }
    if (p.puff) { const f = 1 - p.l / p.l0, rr = R(p.r * (1 + f * 5)); ctx.globalAlpha = .55 * (1 - f); ctx.drawImage(puffSprite(), X(p.x) - rr, Y(p.y) - rr, rr * 2, rr * 2); continue; }
    ctx.globalAlpha = Math.min(1, p.l * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), R(p.r), 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; if (p.t > 1) { pops.splice(i, 1); continue; } ctx.globalAlpha = 1 - p.t; ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), R(8 + p.t * 46), 0, 7); ctx.stroke(); ctx.fillStyle = '#fde047'; ctx.font = `bold ${R(16)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('+250 ★', X(p.x), Y(p.y - 14 - p.t * 36)); ctx.textAlign = 'left'; }
  ctx.globalAlpha = 1;
}
function drawSlowmo() {
  if (state !== 'fly' || (tf > 0.85 && slowT <= 0)) return; const k = slowT > 0 ? 0.6 : (0.85 - tf) / 0.73;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(99,102,241,0)'); g.addColorStop(1, `rgba(124,58,237,${.5 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// heartbeat haptic near holes
function heartbeat(dt) {
  if (state !== 'fly' || !L.holes.length) return; let kmax = 0;
  for (const h of L.holes) { const [hx, hy] = S.holePos(h, ship.t); const d = Math.hypot(ship.x - hx, ship.y - hy) - h.r * S.KILL; kmax = Math.max(kmax, 1 - d / (h.r * 9)); }
  if (kmax <= 0) { heartT = 0; return; } kmax = Math.min(1, kmax);
  heartT -= dt; if (heartT <= 0) { HAP.heart(kmax); heartT = 1.3 - 0.9 * kmax; }
}

// ---------- loop ----------
const MENU_HOLE = { x: 180, y: 130, m: 1, r: 30 };
function holeK() { // close-pass factor for camera zoom, proximity for audio
  let cp = 0, px = 0; if (!L || !ship) return [0, 0];
  for (const h of L.holes) { const [hx, hy] = S.holePos(h, ship.t); const d = Math.hypot(ship.x - hx, ship.y - hy) - h.r * S.KILL; cp = Math.max(cp, 1 - d / (h.r * 5)); px = Math.max(px, 1 - d / (h.r * 9)); }
  return [Math.max(0, Math.min(1, cp)), Math.max(0, Math.min(1, px))];
}
// radial speed toward the nearest hole (+ approaching), scaled by proximity: drives the doppler-ish engine pitch
function shipDop() { if (!L || !ship || !L.holes.length) return 0; let best = null, bd = 1e9; for (const h of L.holes) { const [hx, hy] = S.holePos(h, ship.t), d = Math.hypot(hx - ship.x, hy - ship.y); if (d < bd) { bd = d; best = [hx, hy]; } }
  const vr = ((best[0] - ship.x) * ship.vx + (best[1] - ship.y) * ship.vy) / Math.max(1, bd); return Math.max(-1, Math.min(1, vr / 400)) * proxK; }
let last = performance.now(), acc = 0, frozen = false;
function frame(now) {
  if (window.BHExp && BHExp.active) { last = now; requestAnimationFrame(frame); return; } // v3.4.0: L51 mode renders itself
  const dt = Math.min(0.05, (now - last) / 1000); last = now; animT += dt; drawShuttle.dt = dt; if ($('settings').classList.contains('on')) drawShipPrev();
  if (L && state === 'fly') {
    if (press && !braking && L.stops && ship.fuel > 0 && now - press.t >= HOLD_MS) { braking = true; hud(); }
    let sdt = dt; if (slowT > 0) { slowT -= dt; sdt = dt * 0.35; }
    acc += sdt; while (acc >= S.STEP && state === 'fly' && !frozen) { tick(); acc -= S.STEP; }
    thrust = Math.max(0, thrust - dt); heartbeat(dt);
    if (save.set.ship === 'roadster') roadsterJets(); else shuttleJets();
    hud();
  } else acc = 0;
  if (L && (state === 'aim' || state === 'fly')) save.stats.play += dt;
  if (aim && state === 'aim') { aimSmooth(dt); if (scanArmed && aim.ang != null) { const v = aimVec(); if (v.p > 3 && (Math.abs(wrapA(v.a - (aim.pa ?? 99))) > 0.002 || Math.abs(v.p - (aim.pp ?? -1)) > 0.5)) { aim.pa = v.a; aim.pp = v.p; preview = computePreview(v.a, v.p); } } }
  if (L && started && state === 'aim') clock += dt;
  if (L && started) hudSet('hTime', 'text', clock.toFixed(1));
  if (L && ship) { const tgt = clampCam(hintPath && hintPath.head ? hintPath.head[1] : ship.y); camWY += (tgt - camWY) * Math.min(1, dt * 4); parX += (((ship.x - 180) / 180) - parX) * .05; }
  shake *= Math.pow(0.02, dt);
  // camera: smooth follow + slight zoom on close passes
  [cpK, proxK] = holeK(); const cp = state === 'fly' ? cpK : 0;
  const tZ = 1 + 0.13 * cp; Z += (tZ - Z) * Math.min(1, dt * (tZ > Z ? 2.2 : 1.5));
  const zf = (Z - 1) / 0.13 * 0.45, baseCY = camWY + 320;
  camCX = L && ship ? 180 + (ship.x - 180) * zf : 180; camCY = L && ship ? baseCY + (ship.y - baseCY) * zf : 320;
  if (L && ship) keepShipInView(dt); else { camOX = 0; camOY = 0; }
  AU.update({ pan: ship && L ? Math.max(-1, Math.min(1, (X(ship.x) - W / 2) / (W / 2))) : 0, dop: state === 'fly' ? shipDop() : 0, fly: state === 'fly', braking: braking && state === 'fly', speed: ship && L ? Math.hypot(ship.vx, ship.vy) : 0, prox: state === 'fly' ? proxK : (L ? 0 : 0.35), tf: state === 'fly' ? (slowT > 0 ? 0.5 : tf) : 1, aiming: state === 'aim' && !!aim });
  // auto quality
  if (save.set.q === 'auto') { fpsT += (now - (frame.p || now)) / 1000; fpsN++; if (fpsT >= 2.5) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0;
    if (fps < 48 && autoQ > 0) { autoQ--; resize(); syncSettings(); } else if (fps > 58.5 && autoQ < 2 && !autoUp && animT > 10) { autoUp = 1; autoQ++; resize(); syncSettings(); } } }
  frame.p = now; avoidHint();
  if (useGL && !GFX.ok) { useGL = false; resize(); }
  const sx = shake > .3 ? (Math.random() - .5) * shake : 0, sy = shake > .3 ? (Math.random() - .5) * shake : 0;
  lenses = [];
  // --- scene layer (gravitationally lensed in WebGL mode) ---
  ctx = useGL ? sctx : octx; ctx.save(); ctx.translate(sx, sy);
  drawBG(animT);
  const inLevel = L && state !== 'menu';
  if (inLevel) { const t = ship.t; L.fields.forEach(f => drawField(f, animT)); L.whites.forEach(w => drawWhite(w, animT)); L.holes.forEach(h => drawHoleScene(h, t)); }
  else drawHoleScene(MENU_HOLE, animT);
  ctx.restore();
  // --- gameplay layer (never distorted, so positions stay readable) ---
  if (useGL) { ctx = octx; ctx.clearRect(0, 0, W, H); }
  ctx.save(); ctx.translate(sx, sy);
  if (inLevel) {
    const t = ship.t;
    drawBorder(); drawShadows();
    L.flares.forEach(f => drawFlare(f, t)); L.magnets.forEach(m => drawMagnet(m, animT));
    L.planets.forEach(drawPlanet); L.asteroids.forEach(drawAsteroid); L.gates.forEach((g, gi) => drawGate(g, animT, gi)); L.worms.forEach((w, i) => drawWorm(w, animT, i));
    L.moons.forEach((m, mi) => drawMoon(m, t, mi)); L.holes.forEach(h => drawHoleTop(h, t));
    drawPortal(animT); L.keys.forEach((k, i) => drawKey(k, i, animT)); L.stars.forEach((s, k) => drawStar(s, k, animT));
    drawGhost(); drawHintPath(); drawTrail(); drawAim(); if (state !== 'fail') drawShuttle(); else drawDeath(dt); if (state === 'aim' && aim && aim.ang != null) drawBeam(aimVec()); drawFX(dt); if (!useGL) drawSlowmo();
  } else {
    drawHoleTop(MENU_HOLE, animT);
    if (!ship) ship = { x: 0, y: 0, vx: 0, vy: 0, t: 0, broken: 0, keys: 0, flip: 1 };
    ship.x = 180 + Math.cos(animT * .7) * 120; ship.y = 130 + Math.sin(animT * .7) * 50; ship.vx = -Math.sin(animT * .7) * 84; ship.vy = Math.cos(animT * .7) * 35; const ps = state; state = 'fly'; drawShuttle(); state = ps;
  }
  ctx.restore();
  if (useGL) {
    const slowK = state === 'fly' ? (slowT > 0 ? 0.75 : Math.max(0, Math.min(1, (0.85 - tf) / 0.6))) : 0;
    const breath = 0.0035 * (0.5 + 0.5 * Math.sin(animT * 0.9)) + (state === 'fly' ? proxK * 0.006 * Math.max(0, Math.sin(animT * (4 + proxK * 6))) : 0);
    GFX.render(sc, { lenses, w: W, h: H, t: animT, breath, slow: slowK, bloom: qLevel === 0 ? 0 : qLevel === 2 ? 0.95 : 0.8, passes: qLevel === 2 ? 2 : 1, ca: slowK * 1.2, vig: 0.32 + slowK * 0.25 });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- menus ----------
const secStars = k => SECTORS[k].ids.reduce((n, id) => n + ((save.best[id] || {}).s || 0), 0);
const totalStars = () => Object.values(save.best).reduce((a, b) => a + b.s, 0);
const SEC_PAGE = 5; let secPage = -1;
function buildSectors() {
  const pages = Math.max(1, Math.ceil(SECTORS.length / SEC_PAGE)); if (secPage < 0) { let last = 0; SECTORS.forEach((s, k) => { if (CAT.sectorOpen(save, k)) last = k; }); secPage = Math.floor(last / SEC_PAGE); }
  secPage = Math.max(0, Math.min(pages - 1, secPage)); $('secList').innerHTML = '';
  for (let i = secPage * SEC_PAGE; i < Math.min(SECTORS.length, (secPage + 1) * SEC_PAGE); i++) { const s = SECTORS[i];
    const d = document.createElement('div'); const open = CAT.sectorOpen(save, i); d.className = 'sector' + (open ? '' : ' lock') + (s.soon ? ' soon' : ''); d.style.borderColor = s.c;
    const st = s.soon ? '' : `<div style="margin-top:4px;color:#fde047;font-size:13px">★ ${secStars(i)}/${s.ids.length * 3}</div>`;
    d.innerHTML = `<b>${open ? '' : s.soon ? '⏳ ' : '🔒 '}${i + 1}. ${I18N.secName(s)}${s.soon ? ` <span class="badge">${T('sec.soon')}</span>` : ''}</b><small>${I18N.secDesc(s)}</small>${st}${open || s.soon ? '' : `<small class="lk">${CAT.lockText(s)}</small>`}`;
    d.onclick = () => { if (open) { curSector = i; buildLevels(); show('levels'); AU.theme(secTheme(i)); } else toast(s.soon ? T('sec.soonToast') : '🔒 ' + CAT.lockText(s), 1300); }; $('secList').appendChild(d);
  }
  { const o = $('xEntry'); if (o) o.remove(); const n = $('xOpenNote'); if (n) n.remove(); if (window.BHExp) { const e = BHExp.entryCard(); $('secList').after(e); const t = document.createElement('small'); t.id = 'xOpenNote'; t.textContent = '🔓 ' + BHExp.tx('open'); e.after(t); } } // v3.4.0 L51 prototype entry
  $('secPager').style.display = pages > 1 ? 'flex' : 'none'; $('sPage').textContent = `${secPage + 1} / ${pages}`;
  $('sDots').innerHTML = pages <= 12 ? Array.from({ length: pages }, (_, k) => `<i class="${k === secPage ? 'on' : ''}" data-p="${k}"></i>`).join('') : '';
  $('sDots').querySelectorAll('i').forEach(e => e.onclick = () => { secPage = +e.dataset.p; buildSectors(); });
}
$('sPrev').onclick = () => { secPage--; buildSectors(); }; $('sNext').onclick = () => { secPage++; buildSectors(); };
{ let sx = null; $('secList').addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true }); $('secList').addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) { secPage += dx < 0 ? 1 : -1; buildSectors(); } }); }
function buildLevels() {
  const s = SECTORS[curSector]; $('secTitle').textContent = `${curSector + 1}. ${I18N.secName(s)}`; $('grid').innerHTML = '';
  for (const i of s.idx) {
    const b = document.createElement('button'); const lock = !isOpen(i); const st = (bestOf(i) || {}).s || 0;
    b.className = 'lv' + (lock ? ' lock' : '') + (LEVELS[i].boss ? ' boss' : ''); b.innerHTML = `${lock ? '🔒' : LEVELS[i].boss ? '☠' : i + 1}<span>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`;
    b.onclick = () => { if (!lock) startLevel(i); }; $('grid').appendChild(b);
  }
  { const o = $('xTileBox'); if (o) o.remove(); if (window.BHExp && curSector === CAT.real[CAT.real.length - 1].k) { const d = document.createElement('div'); d.id = 'xTileBox'; d.className = 'grid'; const b = document.createElement('button'); b.className = 'lv xTile'; b.innerHTML = `51<span>🧪 ${BHExp.tx('name')}</span>`; b.onclick = () => BHExp.start(); d.appendChild(b); $('grid').after(d); } }
}
const secTheme = si => { const s = SECTORS[si] || SECTORS[0]; return AU.THEMES[s.id] ? s.id : AU.THEME_IDS[s.pal % 5]; };
function toMenu() { resetInput(); ensureBG(5); state = 'menu'; AU.theme('menu'); L = null; ship = null; camWY = 0; Z = 1; camCX = 180; camCY = 320; AU.aimEnd(); persist();
  const stn = PR.stars(save), rk = PR.rank(stn);
  $('rank').innerHTML = `<b>${rk.name}</b><div class="bar"><i style="width:${rk.nextAt ? Math.round((stn - rk.at) / (rk.nextAt - rk.at) * 100) : 100}%"></i></div><span>${rk.next ? T('rank.next', { r: rk.next, n: rk.nextAt - stn }) : T('rank.top')}</span>`;
  $('score').textContent = T('menu.score', { s: I18N.num(PR.score(save)), a: Object.keys(save.achv).length, b: PR.ACH.length }); $('hud').style.display = 'none'; $('hint').style.display = 'none'; $('hand').style.display = 'none'; $('pu').style.display = 'none';
  $('totalStars').textContent = T('menu.stars', { s: totalStars(), m: CAT.maxStars, o: LEVELS.filter((_, i) => isOpen(i)).length, n: LEVELS.length });
  $('puInfo').textContent = T('menu.pu', { list: `🚀${save.pu.extra} 📡${save.pu.scan} 🛡${save.pu.shield} ⏳${save.pu.slow}`, n: save.streak % 4 }); show('menu'); }
function syncSettings() { $('tVib').classList.toggle('on', save.set.vib); $('tSnd').classList.toggle('on', save.set.snd); $('rSfx').value = save.set.sfx; $('rMus').value = save.set.mus; syncMus(); document.querySelectorAll('#shipSeg button').forEach(b => b.classList.toggle('on', b.dataset.s === save.set.ship)); if ($('settings').classList.contains('on')) drawShipPrev();
  document.querySelectorAll('#qSeg button').forEach(b => b.classList.toggle('on', b.dataset.q === save.set.q));
  document.querySelectorAll('#factSeg button').forEach(b => b.classList.toggle('on', b.dataset.f === save.set.facts));
  document.querySelectorAll('#aimSeg button').forEach(b => b.classList.toggle('on', b.dataset.a === (save.set.aim === 'direct' ? 'direct' : 'sling'))); applyLang();
  $('qInfo').textContent = T('q.now', { q: QN[qLevel], r: T(useGL ? 'q.gl' : 'q.cv') }); AU.configure(save.set); }
// ---------- achievements / stats ----------
let achQ = [], achBusy = false;
function achCheck(ev) { ev = Object.assign({ type: 'event' }, ev || {}); if (L && li != null && LID(li)) ev.lv = LID(li); const got = PR.check(save, ev); if (got.length) { persist(); achQ.push(...got); if (!achBusy) achNext(); } }
function placeAch() { const e = $('achT'); const inGame = !!L && (state === 'aim' || state === 'fly'); e.classList.toggle('side', inGame); // small side toast below the HUD columns during play
  if (inGame) { let y = 0; $('hud').querySelectorAll('.col').forEach(c => y = Math.max(y, c.getBoundingClientRect().bottom)); e.style.top = Math.round(y + 8) + 'px'; } else e.style.top = '14px'; }
function achNext() { const a = achQ.shift(); if (!a) { achBusy = false; return; } achBusy = true; const e = $('achT'); placeAch(); e.innerHTML = `<span class="ai">${a.i}</span><div><small>${T('ach.unlocked')}</small><b>${a.n}</b><i class="ad">${a.d}</i></div>`; e.classList.add('on'); AU.ach(); HAP.star();
  setTimeout(() => { e.classList.remove('on'); setTimeout(achNext, 380); }, 3200); }
function buildAch() { const n = Object.keys(save.achv).length; $('achCount').textContent = `${n} / ${PR.ACH.length}`;
  const loc = I18N.lang === 'uk' ? 'uk-UA' : I18N.lang === 'es' ? 'es-ES' : 'en-GB';
  $('achList').innerHTML = PR.ACH.map(a => { const t = save.achv[a.id], pr = PR.progress(save, a), at = (save.achvAt || {})[a.id], ix = at != null ? CAT.index[at] : null;
    const bar = pr && pr.g > 1 ? `<span class="ap"><span class="apb"><i style="width:${Math.round(pr.c / pr.g * 100)}%"></i></span>${T('ach.progress', { c: pr.c, g: pr.g })}</span>` : '';
    const when = t ? `<em>${T('ach.earned', { d: new Date(t).toLocaleDateString(loc) })}${ix != null ? ' ' + T('ach.where', { n: ix + 1, l: lvName(ix) }) : ''}</em>` : (bar ? '' : `<em class="lk">${T('ach.locked')}</em>`);
    return `<div class="ach${t ? ' got' : ''}"><span class="ai">${t ? a.i : '🔒'}</span><div><b>${a.n}</b><small>${a.d}</small>${t ? '' : bar}${when}</div></div>`; }).join(''); }
const fmtT = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h ? T('t.h', { h, m }) : m ? T('t.m', { m, s: ss }) : T('t.s', { s: ss }); };
function buildStats() { const st = save.stats, stn = PR.stars(save), rk = PR.rank(stn), done = LEVELS.filter((_, i) => bestOf(i)).length;
  const D = {}; for (const k of ['swallowed', 'moon', 'flare', 'oob', 'stranded', 'trap']) D[k] = T('d.' + k);
  const rows = [[T('st.rank'), rk.name], [T('st.stars'), `${stn} / ${CAT.maxStars}`], [T('st.score'), I18N.num(PR.score(save))], [T('st.done'), `${done} / ${LEVELS.length}`], [T('st.facts'), `${Object.keys(save.facts).length} / ${CAT.idOf.filter(id => FACTS[id]).length}`], [T('st.launches'), st.launches], [T('st.flight'), fmtT(st.flight)], [T('st.play'), fmtT(st.play)],
    [T('st.wl'), `${st.wins} / ${st.fails}`], ...Object.keys(D).filter(k => st.deaths[k]).map(k => ['  · ' + D[k], st.deaths[k]]), [T('st.bonus'), st.bonus], [T('st.bounces'), st.bounces], [T('st.worms'), st.worms], [T('st.flips'), st.flips], [T('st.pu'), st.puUsed], [T('st.dilate'), fmtT(st.dilate)]];
  let h = '<div class="rows">' + rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') + `</div><h3>${T('st.records')}</h3><div class="rows lvb">`;
  for (let i = 0; i < LEVELS.length; i++) { const b = bestOf(i); if (!b) continue; h += `<div><span>${i + 1}. ${lvName(i)}</span><b>${'★'.repeat(b.s)}${'☆'.repeat(3 - b.s)} ${b.sc} · ${b.t ? b.t.toFixed(1) + T('hud.sec') : '—'}</b></div>`; }
  if (!done) h += `<div><span>${T('st.none')}</span></div>`;
  $('statBody').innerHTML = h + '</div>'; }
function buildCodex() { const ids = CAT.idOf.filter(id => FACTS[id]), got = ids.filter(id => save.facts[id]), s3 = got.filter(id => save.facts[id].s3).length;
  $('cxCount').textContent = T('codex.count', { a: got.length, b: ids.length, c: s3 }); let h = '';
  for (const S of CAT.real) { const list = S.ids.filter(id => FACTS[id]); if (!list.length) continue; h += `<div class="cxh">${S.k + 1}. ${I18N.secName(S)}</div>`;
    for (const id of list) { const f = I18N.fact(id), u = save.facts[id];
      h += u ? `<div class="cx got" data-id="${id}">${u.s3 ? '<span class="st3">★★★</span>' : ''}<small>${T('codex.level', { n: f.n })}${f.boss ? ' · ' + T('fact.boss') : ''}</small><b>${f.title}</b><p>${f.text}</p><div class="fsrc">${T('fact.src', { s: f.src })}${u.s3 ? '' : '<br>' + T('fact.starHint')}</div></div>`
        : `<div class="cx lock"><small>${T('codex.level', { n: f.n })}</small><b>🔒 ???</b><small>${T('codex.locked', { n: f.n })}</small></div>`; } }
  if (FACTS['expedition-01'] && window.BHExp) { const f = I18N.fact('expedition-01'), u = save.facts['expedition-01']; h += `<div class="cxh">51. 🧪 ${BHExp.tx('name')}</div>` + (u ? `<div class="cx got" data-id="expedition-01"><small>${T('codex.level', { n: 51 })}</small><b>${f.title}</b><p>${f.text}</p><div class="fsrc">${T('fact.src', { s: f.src })}</div></div>` : `<div class="cx lock"><small>${T('codex.level', { n: 51 })}</small><b>🔒 ???</b><small>${T('codex.locked', { n: 51 })}</small></div>`); }
  $('cxList').innerHTML = h; $('cxList').querySelectorAll('.cx.got').forEach(e => e.onclick = () => e.classList.toggle('open')); }
$('bCodex').onclick = () => { buildCodex(); show('codex'); }; $('bCxBack').onclick = toMenu;
function applyLang() { I18N.apply(); document.querySelectorAll('#langSeg button').forEach(b => b.classList.toggle('on', b.dataset.l === I18N.lang)); }
document.querySelectorAll('#langSeg button').forEach(b => b.onclick = () => { save.set.lang = I18N.set(b.dataset.l); persist(); applyLang(); syncSettings(); });
document.querySelectorAll('#aimSeg button').forEach(b => b.onclick = () => { save.set.aim = b.dataset.a; persist(); syncSettings(); HAP.tick(); });
document.querySelectorAll('#factSeg button').forEach(b => b.onclick = () => { save.set.facts = b.dataset.f; persist(); syncSettings(); });
$('bAch').onclick = () => { buildAch(); show('achs'); }; $('bStats').onclick = () => { buildStats(); show('stats'); };
$('bAchBack').onclick = toMenu; $('bStatBack').onclick = toMenu;
document.querySelectorAll('#qSeg button').forEach(b => b.onclick = () => { save.set.q = b.dataset.q; if (b.dataset.q === 'auto') { autoQ = 1; autoUp = 0; } persist(); resize(); syncSettings(); });
document.addEventListener('pointerdown', () => AU.unlock(), true);
document.getElementById('ui').addEventListener('click', e => { if (e.target.closest('button')) AU.click(); });
$('bPlay').onclick = () => { let i = 0; for (let k = 0; k < LEVELS.length; k++) if (isOpen(k)) i = k; startLevel(i); };
$('bSectors').onclick = () => { secPage = -1; buildSectors(); show('sectors'); };
$('bSettings').onclick = () => { syncSettings(); show('settings'); };
$('tVib').onclick = () => { save.set.vib = !save.set.vib; persist(); syncSettings(); HAP.tick(); };
$('tSnd').onclick = () => { save.set.snd = !save.set.snd; persist(); syncSettings(); };
$('rSfx').oninput = e => { save.set.sfx = +e.target.value; persist(); AU.configure(save.set); }; $('rSfx').onchange = () => AU.star(2);
$('rMus').oninput = e => { save.set.mus = +e.target.value; if (save.set.mus > 0) save.set.musOn = true; persist(); AU.configure(save.set); syncMus(); };
function syncMus() { const on = save.set.musOn !== false; $('tMus').classList.toggle('on', on); $('bMus').classList.toggle('off', !on); $('bMus').textContent = on ? '🎵' : '🔇'; $('bMus').title = T(on ? 'mus.on' : 'mus.off'); }
function toggleMus() { save.set.musOn = save.set.musOn === false; persist(); AU.unlock(); AU.configure(save.set); syncMus(); toast(T(save.set.musOn ? 'mus.on' : 'mus.off'), 900); }
$('tMus').onclick = toggleMus; $('bMus').onclick = e => { e.stopPropagation(); toggleMus(); };
document.querySelectorAll('#shipSeg button').forEach(b => b.onclick = () => { save.set.ship = b.dataset.s; persist(); syncSettings(); AU.unlock(); if (AU.pickShip) AU.pickShip(b.dataset.s); });
$('bSetBack').onclick = toMenu; $('bBack1').onclick = toMenu; $('bBack2').onclick = () => { buildSectors(); show('sectors'); };
$('bRestart').onclick = () => { if (started) { ghost = attempt.slice(); ghostLevel = li; } startLevel(li, true); }; $('bMenu').onclick = toMenu; $('bHintPath').onclick = e => { e.stopPropagation(); useHintPath(); };
$('bNext').onclick = () => startLevel(li + 1); $('bRetry').onclick = () => startLevel(li); $('bRetry2').onclick = e => { e.stopPropagation(); arRestart(); };
$('fail').onclick = e => { if (e.target.closest('#bLv2,#bFailMenu')) return; arRestart(); }; // tap anywhere = restart now
$('bFailMenu').onclick = () => { failTok++; toMenu(); };
$('bLv').onclick = $('bLv2').onclick = () => { failTok++; curSector = CAT.secOf[li]; buildLevels(); show('levels'); AU.theme(secTheme(curSector)); };
AU.configure(save.set); applyLang(); toMenu();
window.BH = { get shipFX() { return shipFX; }, get parts() { return parts; }, get pfree() { return pfree.length; }, PCAP, impactFX: h => impactFX(h), explodeFX: (x, y) => explodeFX(x, y, 0, 0, save.set.ship), get shipsMade() { return SHIPS.made; }, LEVELS, startLevel, launch: (a, p) => launch(a, p), get state() { return state; }, get ship() { return ship; }, get clock() { return clock; }, toMenu, save, persist,
  advance(n, brake, tg) { braking = !!brake && ship.fuel > 0; for (let i = 0; i < n && state === 'fly'; i++) { if (tg != null && i === tg) ship.flip = -ship.flip; tick(); } braking = false; },
  runPlanStep(st) { launch(st.a, st.p); for (let i = 0; i < 2600 && state === 'fly'; i++) { if (st.tg != null && i === st.tg) ship.flip = -ship.flip; braking = st.b != null && i >= st.b && ship.fuel > 0; tick(); } braking = false; },
  show, buildSectors, syncSettings, buildAch, buildStats, achCheck, get gl() { return useGL; }, get quality() { return qLevel; }, get zoom() { return Z; }, CAT, levelId: LID, unlockAll() { LEVELS.forEach((_, i) => save.open[LID(i)] = 1); persist(); }, get braking() { return braking; }, get pressing() { return !!press; }, toScreen(x, y) { return [X(x), Y(y)]; }, stepN(n) { for (let i = 0; i < n && state === 'fly'; i++) tick(); }, freeze(b) { frozen = !!b; }, forceWin() { if (state === 'aim' || state === 'fly') { clock = clock || 2.5; win(); } }, buildCodex, get facts() { return save.facts; }, get trapT() { return trapT; }, get trapHint() { return trapHint; }, get failTok() { return failTok; }, get hintPath() { return hintPath; }, get skin() { return L && L.skin; }, setBraking: v => { braking = !!v; }, get parts() { return parts; }, toggleMus, drawShipPrev, useHintPath, solverPath, get edgeRect() { return L ? edgeRect() : null; }, get dpr() { return DPR; }, get qs() { return QS; }, get shipVis() { return shipVis; }, get noseOffset() { return noseOffset(); }, readoutPos, get canvasPx() { return [cv.width, cv.height, W, H]; }, get aimV() { return aim && aim.ang != null ? aimVec() : null; }, get aimDir() { return save.set.aim; }, setShip(x, y, vx, vy) { ship.x = x; ship.y = y; ship.vx = vx; ship.vy = vy; } };
})();
