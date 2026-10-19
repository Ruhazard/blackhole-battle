/* Blackhole Battle v3.1.1 — stage 2: visuals, sound, progress (gameplay/physics unchanged from v3.0) */
(() => {
'use strict';
const S = window.BHSim;
const LEVELS = window.BH3_LEVELS || window.BH3_SRC;
const CAT = window.BHCat.build(LEVELS), SECTORS = CAT.sectors, LID = i => CAT.idOf[i]; window.BHProg.setCatalog(CAT);
const PU = { extra: { i: '🚀', n: '+1 запуск' }, scan: { i: '📡', n: 'Сканер' }, shield: { i: '🛡', n: 'Щит' }, slow: { i: '⏳', n: 'Сповільнення 3с' } };
const $ = id => document.getElementById(id);
const cv = $('c'), octx = cv.getContext('2d'); let ctx = octx;
const sc = document.createElement('canvas'), sctx = sc.getContext('2d');
const glc = $('gl'), GFX = window.BHGfx;
let useGL = !!(GFX && glc && !/[?&]nogl/.test(location.search) && GFX.init(glc));
const NOOP = () => {}; const AU = window.BHAudio || { unlock: NOOP, configure: NOOP, update: NOOP, aimStart: NOOP, aimPower: NOOP, aimEnd: NOOP, launch: NOOP, bounce: NOOP, star: NOOP, win: NOOP, lose: NOOP, magnet: NOOP, key: NOOP, worm: NOOP, stop: NOOP, crash: NOOP, shield: NOOP, click: NOOP, ach: NOOP };
const PR = window.BHProg;
let W, H, DPR, SC, OX, OY, camWY = 0, Z = 1, camCX = 180, camCY = 320, QS = 1, BGS = 1, qLevel = 1, autoQ = 1, autoUp = 0, fpsT = 0, fpsN = 0;
const X = x => OX + (180 + (x - camCX) * Z) * SC, Y = y => OY + (320 + (y - camCY) * Z) * SC, R = v => v * SC * Z;
let lenses = [], planetCache = {}, fl = { bounces: 0, margin: 1e9 }, cpK = 0, proxK = 0;
const QN = ['низька', 'середня', 'висока'];
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// ---------- save ----------
const KEY = 'bh_v3';
let save; try { save = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { save = null; }
save = Object.assign({ unlocked: 1, best: {}, tut: {}, pu: { extra: 0, scan: 0, shield: 0, slow: 0 }, streak: 0, ach: {}, set: {} }, save || {});
save.set = Object.assign({ vib: true, snd: true, sfx: 80, mus: 60, q: 'auto' }, save.set || {}); PR.ensure(save);
const isOpen = i => CAT.levelOpen(save, i), bestOf = i => save.best[LID(i)];
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
if (CAT.migrate(save)) persist();
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
  DPR = Math.min(dpr, qLevel === 0 ? 1.5 : 2); QS = Math.min(dpr, [1, 1.5, 2][qLevel]);
  cv.width = W * DPR; cv.height = H * DPR; octx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (useGL) { sc.width = Math.round(W * QS); sc.height = Math.round(H * QS); sctx.setTransform(QS, 0, 0, QS, 0, 0); GFX.resize(W, H, QS); glc.style.display = 'block'; BGS = QS; }
  else { glc && (glc.style.display = 'none'); BGS = DPR; }
  SC = Math.min(W / 360, H / 640); OX = (W - 360 * SC) / 2; OY = (H - 640 * SC) / 2; planetCache = {}; buildBG(); }
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
let braking = false, trail = [], attempt = [], ghost = null, parts = [], pops = [], shake = 0, aim = null, preview = [], tf = 1, animT = 0, curSector = 0, thrust = 0;
let active = {}, scanArmed = false, shieldOn = false, slowT = 0, heartT = 0, press = null, aimId = null, launchT = -1e9, flySteps = 0, lastTick = 0, ghostLevel = -1;

function startLevel(i, keepGhost) {
  if (!keepGhost || ghostLevel !== i) { ghost = null; }
  li = i; ensureBG(SECTORS[CAT.secOf[i]].pal); L = S.prep(LEVELS[i]); ship = S.newShip(L); ship.ang = -Math.PI / 2;
  launchesLeft = L.L; collected = new Set(); clock = 0; started = false; resetInput();
  trail = []; attempt = []; parts = []; pops = []; aim = null; preview = []; tf = 1; active = {}; scanArmed = false; shieldOn = false; slowT = 0;
  planetCache = {}; camWY = clampCam(ship.y); Z = 1; camCX = 180; camCY = camWY + 320; fl = { bounces: 0, margin: 1e9 }; AU.aimEnd(); state = 'aim'; show(null); $('hud').style.display = 'flex'; $('hTime').textContent = '0.0';
  $('hLevel').textContent = `${i + 1}. ${L.n}`; $('hTarget').textContent = L.t3 ? `3★ ≤ ${L.t3}с` : '';
  $('chipFuel').style.display = L.stops ? '' : 'none';
  hud(); buildPU();
  const h = $('hint'); h.innerHTML = '💡 ' + L.hint; h.style.display = 'block';
  $('hand').style.display = (i === 0 && !save.tut.aim) ? 'block' : 'none';
}
function clampCam(y) { return L.H <= 640 ? 0 : Math.max(0, Math.min(L.H - 640, y - 380)); }
function hud() {
  $('hL').innerHTML = 'запуски ' + Array.from({ length: L.L + (active.extra ? 1 : 0) }, (_, k) => `<i class="${k < launchesLeft ? '' : 'u'}"></i>`).join('');
  $('hB').textContent = collected.size;
  $('fuelF').style.width = (100 * ship.fuel / Math.max(0.01, S.fuelFor(L))) + '%';
  $('chipFuel').classList.toggle('on', braking);
  const cp = $('chipPol'); if (L.magnets.length) { cp.style.display = ''; cp.innerHTML = ship.flip > 0 ? 'магніти: <b style="color:#f87171">звичайні</b> · тап = змінити' : 'магніти: <b style="color:#60a5fa">інвертовані</b> · тап = змінити'; } else cp.style.display = 'none';
  const fx = []; if (shieldOn) fx.push('🛡 щит'); if (scanArmed) fx.push('📡 сканер'); if (slowT > 0) fx.push('⏳ ' + slowT.toFixed(1) + 'с');
  $('chipFx').style.display = fx.length ? '' : 'none'; $('chipFx').textContent = fx.join(' · ');
}
function buildPU() {
  const box = $('pu'); const owned = Object.keys(PU).filter(k => save.pu[k] > 0 || active[k]);
  if (state !== 'aim' || started || !owned.length) { box.style.display = 'none'; return; }
  box.style.display = 'flex'; box.innerHTML = '<span>Бонуси:</span>' + owned.map(k => `<button data-k="${k}" class="${active[k] ? 'act' : ''}">${PU[k].i} ${save.pu[k]}</button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); usePU(b.dataset.k); });
}
function usePU(k) {
  if (active[k] || save.pu[k] <= 0) return;
  save.pu[k]--; save.stats.puUsed++; persist(); active[k] = 1; AU.click(); achCheck();
  if (k === 'extra') launchesLeft++;
  if (k === 'scan') scanArmed = true;
  if (k === 'shield') shieldOn = true;
  toast(`${PU[k].i} ${PU[k].n} активовано`); HAP.tick(); hud(); buildPU();
}
function toast(t, ms) { const e = $('toast'); e.innerHTML = t; e.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => e.style.display = 'none', ms || 1400); }
function show(id) { document.querySelectorAll('.scr').forEach(e => e.classList.remove('on')); if (id) $(id).classList.add('on'); }

// ---------- input ----------
function wpos(e) { return { x: camCX + ((e.clientX - OX) / SC - 180) / Z, y: camCY + ((e.clientY - OY) / SC - 320) / Z }; }
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const AIM_DEAD = 12, AIM_SLOW = 70, AIM_FINE = 0.35;
// Angle model: the angle follows the drag direction only beyond a dead zone; slow finger motion = fine adjust (35% gain);
// fast motion re-syncs toward the finger direction; the displayed/launched angle is low-pass filtered (~70 ms). Power = drag length only.
function aimMove(p, now) {
  const dt = Math.max(1, now - (aim.lt || now - 16)) / 1000, sp = Math.hypot(p.x - aim.x, p.y - aim.y) / dt; aim.x = p.x; aim.y = p.y; aim.lt = now;
  const dx = aim.sx - aim.x, dy = aim.sy - aim.y, d = Math.hypot(dx, dy); if (d < AIM_DEAD) return;
  const raw = Math.atan2(dy, dx);
  if (aim.tgt == null) { aim.tgt = raw; aim.ang = raw; aim.raw = raw; return; }
  const dRaw = wrapA(raw - aim.raw); aim.raw = raw;
  const fine = sp < AIM_SLOW; aim.fine = fine;
  aim.tgt = wrapA(aim.tgt + dRaw * (fine ? AIM_FINE : 1));
  if (!fine) aim.tgt = wrapA(aim.tgt + wrapA(raw - aim.tgt) * 0.25);
}
function aimSmooth(dt) { if (!aim || aim.tgt == null) return; const e = wrapA(aim.tgt - aim.ang); aim.ang = Math.abs(e) < 0.002 ? aim.tgt : wrapA(aim.ang + e * Math.min(1, dt * 14)); }
function aimVec() { const dx = aim.sx - aim.x, dy = aim.sy - aim.y, d = Math.hypot(dx, dy); const pull = Math.min(d, S.MAX_PULL);
  if (aim.ang != null) return { a: aim.ang, p: pull, pct: Math.round(pull / S.MAX_PULL * 100) };
  return { a: Math.atan2(dy, dx), p: pull, pct: Math.round(pull / S.MAX_PULL * 100) }; }
function launch(a, p) {
  const sp = S.launchSpeed(p); ship.vx = Math.cos(a) * sp; ship.vy = Math.sin(a) * sp;
  resetInput(); launchT = performance.now(); flySteps = 0;
  launchesLeft--; started = true; state = 'fly'; aim = null; thrust = 0.35; ship.scan = scanArmed; preview = []; scanArmed = false;
  if (active.slow && !active.slowUsed) { slowT = 3; active.slowUsed = 1; }
  for (let i = 0; i < 18; i++) spark(ship.x, ship.y, '#22d3ee', 60 + Math.random() * 90, a + Math.PI + (Math.random() - .5) * 1.2);
  $('hint').style.display = 'none'; $('hand').style.display = 'none'; $('pu').style.display = 'none';
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
  const z = SC * Z, p = { x: e.clientX / z, y: e.clientY / z }; aim = { z, sx: p.x, sy: p.y, x: p.x, y: p.y, lastPct: 0 }; // screen-space drag (immune to camera easing) $('hand').style.display = 'none'; AU.aimStart();
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
function spark(x, y, col, sp, ang) { const a = ang ?? Math.random() * 6.28, s = sp ?? 40 + Math.random() * 120; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 0.5 + Math.random() * 0.5, c: col, r: 1 + Math.random() * 2 }); }
function burst(x, y, col, n) { for (let i = 0; i < n; i++) spark(x, y, col); }

// ---------- tick ----------
function tick() {
  clock += S.STEP; flySteps++;
  const ev = S.step(ship, L, { brake: braking && ship.fuel > 0 });
  tf = ev.tf;
  const stt = save.stats; stt.flight += S.STEP; if (tf < 0.6) stt.dilate += S.STEP;
  for (const h of L.holes) { const [hx, hy] = S.holePos(h, ship.t); const m = (Math.hypot(ship.x - hx, ship.y - hy) - h.r * S.KILL) / h.r; if (m < fl.margin) fl.margin = m; }
  if (ev.bounce) { shake = Math.min(12, shake + 6); burst(ship.x, ship.y, '#fbbf24', 8); HAP.bounce(); AU.bounce(); fl.bounces++; stt.bounces++; }
  if (ev.broke >= 0) { const a = L.asteroids[ev.broke]; for (let k = 0; k < 30; k++) spark(a[0] + (Math.random() - .5) * a[2], a[1], '#a8a29e'); shake = 14; toast('💥 Астероїд розбито!', 900); AU.crash(); stt.breaks++; achCheck(); }
  if (ev.key >= 0) { burst(L.keys[ev.key][0], L.keys[ev.key][1], '#fde047', 30); HAP.key(); AU.key(); toast('🔑 Ворота відчинено!', 1000); }
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
    return fail({ swallowed: 'Шатл перетнув горизонт подій.', moon: 'Зіткнення з місяцем!', flare: 'Шатл згорів у сонячному спалаху.', oob: 'Шатл відлетів у відкритий космос.' }[st] || 'Загибель', st);
  }
  if (braking && flySteps > 18 && Math.hypot(ship.vx, ship.vy) < S.STOP_SPEED) {
    ship.vx = 0; ship.vy = 0; braking = false; burst(ship.x, ship.y, '#fb923c', 14); HAP.stop(); AU.stop();
    if (launchesLeft > 0) { press = null; braking = false; aim = null; aimId = null; state = 'aim'; const h = $('hint'); h.innerHTML = '🛑 Зупинка! Цілься знову — <b>ще ' + launchesLeft + '</b>'; h.style.display = 'block'; }
    else fail('Шатл зупинився, а запусків більше немає.', 'stranded');
    hud();
  }
  if (braking && ship.fuel <= 0) braking = false;
}
function deflect(st) {
  toast('🛡 Щит врятував шатл!', 1100); shake = 12; burst(ship.x, ship.y, '#67e8f9', 40); HAP.bounce(); AU.shield(); save.stats.shields++; achCheck();
  let nx = -ship.vx, ny = -ship.vy;
  if (st === 'swallowed') { let best = null; for (const h of L.holes) { const [hx, hy] = S.holePos(h, ship.t); const d = Math.hypot(ship.x - hx, ship.y - hy); if (!best || d < best.d) best = { d, hx, hy, r: h.r }; }
    const dx = ship.x - best.hx, dy = ship.y - best.hy, d = Math.hypot(dx, dy) || 1; ship.x = best.hx + dx / d * best.r * (S.KILL + 1.2); ship.y = best.hy + dy / d * best.r * (S.KILL + 1.2); nx = dx / d * 220; ny = dy / d * 220; }
  else if (st === 'oob') { ship.x = Math.max(5, Math.min(L.W - 5, ship.x)); ship.y = Math.max(5, Math.min(L.H - 5, ship.y)); }
  else { ship.x -= ship.vx * 0.06; ship.y -= ship.vy * 0.06; }
  ship.vx = nx * 0.8; ship.vy = ny * 0.8;
}
function starsFor(t) { return !L.t3 ? 3 : t <= L.t3 ? 3 : t <= L.t2 ? 2 : 1; }
function win() {
  resetInput(); state = 'result'; burst(L.portal[0], L.portal[1], '#22d3ee', 50); $('hud').style.display = 'none'; $('hint').style.display = 'none'; ghost = null;
  const t = clock, st = starsFor(t), timePts = Math.max(0, Math.round(((L.t2 || 20) - t) * 100)), bon = collected.size * 250, unused = launchesLeft * 300;
  const score = st * 1000 + timePts + bon + unused;
  const prev = bestOf(li) || { s: 0, sc: 0 }; const isBest = score > prev.sc; const rk0 = PR.rank(PR.stars(save));
  save.best[LID(li)] = { s: Math.max(prev.s, st), sc: Math.max(prev.sc, score), t: Math.min(prev.t || 1e9, +t.toFixed(2)) };
  save.stats.wins++; AU.win(st);
  { const nx = CAT.nextIndex(li); if (nx != null && CAT.secOf[nx] === CAT.secOf[li]) save.open[LID(nx)] = 1; }
  let streakMsg = '';
  if (st === 3) { save.streak++; if (save.streak % 4 === 0) streakMsg = grant(`Серія ${save.streak}× ★★★`); else streakMsg = `Серія ★★★: ${save.streak % 4}/4 до бонусу`; }
  else { save.streak = 0; streakMsg = 'Серію ★★★ скинуто'; }
  if (L.boss && !save.ach['boss:' + LID(li)]) { save.ach['boss:' + LID(li)] = 1; streakMsg += '<br>' + grant('Бос переможений'); }
  const rk1 = PR.rank(PR.stars(save)); if (rk1.i > rk0.i) streakMsg += `<br>🎖 Новий ранг: <b>${rk1.name}</b>!`;
  achCheck({ type: 'win', bonus: collected.size, margin: fl.margin, bounces: fl.bounces, time: t });
  persist();
  $('rTitle').textContent = st === 3 ? 'Ідеально!' : st === 2 ? 'Чудово!' : 'Портал досягнуто';
  $('rStars').innerHTML = [0, 1, 2].map(k => `<span class="${k < st ? '' : 'e'}">★</span>`).join('');
  $('rRows').innerHTML = `<div><span>⏱ ${t.toFixed(1)}с (3★ ≤ ${L.t3}с, 2★ ≤ ${L.t2}с)</span></div><div><span>Рейтинг ${st}×1000</span><b>${st * 1000}</b></div><div><span>Бонус за час</span><b>${timePts}</b></div><div><span>Бонусні зірки ${collected.size}×250</span><b>${bon}</b></div><div><span>Запуски в запасі ${launchesLeft}×300</span><b>${unused}</b></div>`;
  $('rScore').textContent = score; $('rTotal').textContent = `Загальний рахунок: ${PR.score(save)} · ${rk1.name}`; $('rBest').textContent = isBest ? '🏆 Новий рекорд!' : `Рекорд: ${bestOf(li).sc}`; $('rStreak').innerHTML = streakMsg;
  $('bNext').style.display = CAT.nextIndex(li) != null && isOpen(li + 1) ? '' : 'none';
  setTimeout(() => { if (state === 'result') show('result'); }, 450);
}
function grant(why) {
  if (puTotal() >= 3) return `${why}: сховище бонусів повне (3/3)`;
  const keys = Object.keys(PU); const k = keys[(save.streak + Object.keys(save.ach).length + li) % keys.length]; save.pu[k]++;
  return `🎁 ${why}: отримано ${PU[k].i} ${PU[k].n}!`;
}
function fail(msg, why) {
  resetInput(); state = 'fail'; burst(ship.x, ship.y, '#ef4444', 40); shake = 14; HAP.death(); AU.lose();
  save.stats.fails++; save.stats.deaths[why || 'other'] = (save.stats.deaths[why || 'other'] || 0) + 1; achCheck({ type: 'fail' }); persist(); $('hud').style.display = 'none'; $('hint').style.display = 'none';
  ghost = attempt.slice(); ghostLevel = li;
  $('fText').textContent = msg; setTimeout(() => { if (state === 'fail') show('fail'); }, 500);
}

// ---------- drawing ----------
function glow(x, y, r, col, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
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
  else {
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
function planetSprite(p, i, r) {
  const key = i + '_' + Math.round(r * 10); if (planetCache[key]) return planetCache[key];
  const [c1, c2, rgb] = PCOL[(Math.round(p[0] + p[1]) + i) % PCOL.length]; const d = Math.ceil(r * 2 * DPR) + 2; const rr = rng(Math.round(p[0] * 7 + p[1] * 13 + i));
  const body = document.createElement('canvas'); body.width = body.height = d; const b = body.getContext('2d'); b.scale(DPR, DPR); const cr = r;
  b.save(); b.beginPath(); b.arc(cr + .5, cr + .5, cr, 0, 7); b.clip();
  const g = b.createRadialGradient(cr * .7, cr * .7, cr * .1, cr, cr, cr * 1.05); g.addColorStop(0, c1); g.addColorStop(1, c2); b.fillStyle = g; b.fillRect(0, 0, cr * 2 + 1, cr * 2 + 1);
  for (let k = 0; k < 9; k++) { const yy = rr() * cr * 2, hh = cr * (.06 + rr() * .18); b.fillStyle = `rgba(${rr() < .5 ? '255,255,255' : '0,0,20'},${.06 + rr() * .1})`; b.beginPath(); b.ellipse(cr, yy, cr * 1.3, hh, (rr() - .5) * .25, 0, 7); b.fill(); }
  for (let k = 0; k < 5; k++) { b.fillStyle = 'rgba(0,0,0,.12)'; b.beginPath(); b.arc(rr() * cr * 2, rr() * cr * 2, cr * (.05 + rr() * .1), 0, 7); b.fill(); }
  b.restore();
  const cl = document.createElement('canvas'); cl.width = d * 2; cl.height = d; const c = cl.getContext('2d'); c.scale(DPR, DPR);
  for (let k = 0; k < 22; k++) { const x = rr() * cr * 4, y = cr * (.2 + rr() * 1.6), w = cr * (.3 + rr() * .6); const cg = c.createRadialGradient(x, y, 0, x, y, w); cg.addColorStop(0, 'rgba(255,255,255,.32)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = cg; c.beginPath(); c.ellipse(x, y, w, w * .35, 0, 0, 7); c.fill(); }
  // rings are decorative only: skip them if they would overlap a gameplay object or route
  const clear = r0 => { const R0 = p[2] * 1.9; const near = (x, y, rr) => Math.hypot(x - p[0], (y - p[1]) * 2.2) < R0 + rr;
    return !(L.planets.some(q => q !== p && near(q[0], q[1], q[2])) || L.stars.some(t => near(t[0], t[1], 12)) || L.holes.some(h => near(h.x, h.y, h.r * 3)) || near(L.portal[0], L.portal[1], L.pr) || near(L.ship[0], L.ship[1], 14) || L.moons.some(m => near(m.cx, m.cy, m.a + m.r)) || L.worms.some(w => near(w.a[0], w.a[1], 20) || near(w.b[0], w.b[1], 20))); };
  return planetCache[key] = { body, cl, rgb, ring: (p[2] > 45 || (i + Math.round(p[0])) % 4 === 1) && clear() };
}
function ringArc(x, y, r, from, to) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3);
  [[1.75, 2.6, 'rgba(253,230,138,.28)'], [1.55, 1.6, 'rgba(254,243,199,.4)'], [1.38, 3.2, 'rgba(214,211,209,.22)']].forEach(([k, w, c]) => { ctx.strokeStyle = c; ctx.lineWidth = R(w); ctx.beginPath(); ctx.ellipse(0, 0, r * k, r * k * .24, 0, from, to); ctx.stroke(); });
  ctx.restore();
}
function drawPlanet(p, i) {
  const x = X(p[0]), y = Y(p[1]), r = R(p[2]); const sp = planetSprite(p, i, r); const lt = lightAt(p[0], p[1]);
  glow(x, y, r * 1.45, `rgba(${sp.rgb},A)`, .3);
  if (sp.ring) ringArc(x, y, r, Math.PI, Math.PI * 2);
  ctx.drawImage(sp.body, x - r - .5, y - r - .5, sp.body.width / DPR, sp.body.height / DPR);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  const off = ((animT * r * .06) % (r * 2)); ctx.drawImage(sp.cl, x - r - off, y - r, r * 4, r * 2); ctx.drawImage(sp.cl, x + r * 3 - off, y - r, r * 4, r * 2);
  // terminator shadow (night side away from the light)
  const lx = x + Math.cos(lt.a) * r * .55, ly = y + Math.sin(lt.a) * r * .55; const tg = ctx.createRadialGradient(lx, ly, r * .15, lx, ly, r * 1.75);
  tg.addColorStop(0, 'rgba(0,0,8,0)'); tg.addColorStop(.55, 'rgba(0,0,8,.15)'); tg.addColorStop(.8, 'rgba(0,0,8,.72)'); tg.addColorStop(1, 'rgba(0,0,8,.9)'); ctx.fillStyle = tg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  // atmosphere rim, brighter on the lit side
  const ag = ctx.createLinearGradient(x - Math.cos(lt.a) * r, y - Math.sin(lt.a) * r, x + Math.cos(lt.a) * r, y + Math.sin(lt.a) * r); ag.addColorStop(0, `rgba(${sp.rgb},.08)`); ag.addColorStop(1, `rgba(${sp.rgb},.85)`);
  ctx.strokeStyle = ag; ctx.lineWidth = R(2.2); ctx.beginPath(); ctx.arc(x, y, r * 1.02, 0, 7); ctx.stroke();
  if (sp.ring) ringArc(x, y, r, 0, Math.PI);
}
function drawMoon(m, t) {
  ctx.save(); ctx.translate(X(m.cx), Y(m.cy)); ctx.rotate(m.rot || 0); ctx.strokeStyle = 'rgba(248,113,113,.18)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1, R(m.a)), Math.max(1, R(m.b)), 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  const [mx, my] = S.moonPos(m, t); const x = X(mx), y = Y(my), r = R(m.r); const lt = lightAt(mx, my);
  glow(x, y, r * 2.2, 'rgba(248,113,113,A)', .25);
  const g = ctx.createRadialGradient(x + Math.cos(lt.a) * r * .4, y + Math.sin(lt.a) * r * .4, 0, x, y, r * 1.1); g.addColorStop(0, '#f8fafc'); g.addColorStop(.6, '#94a3b8'); g.addColorStop(1, '#1e293b'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(51,65,85,.55)'; [[.3, -.2, .25], [-.35, .3, .18], [.05, .45, .12]].forEach(c => { ctx.beginPath(); ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, 7); ctx.fill(); });
  const [nx, ny] = S.moonPos(m, t + 0.15); ctx.strokeStyle = 'rgba(248,113,113,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(X(nx), Y(ny)); ctx.stroke();
}
function rectPath(a, i, jag) {
  const w = R(a[2]), h = R(a[3]); const r = rng(i * 97 + 13); const n = Math.max(6, Math.round(a[2] / 10));
  ctx.beginPath(); for (let k = 0; k <= n; k++) ctx.lineTo(-w / 2 + w * k / n, -h / 2 - (jag ? r() * h * .25 : 0)); for (let k = n; k >= 0; k--) ctx.lineTo(-w / 2 + w * k / n, h / 2 + (jag ? r() * h * .25 : 0)); ctx.closePath();
}
function drawAsteroid(a, i) {
  if (a[5] && (ship.broken >> i) & 1) return;
  ctx.save(); ctx.translate(X(a[0]), Y(a[1])); ctx.rotate(a[4]); rectPath(a, i, true);
  const g = ctx.createLinearGradient(0, -R(a[3]), 0, R(a[3])); g.addColorStop(0, a[5] ? '#d6d3d1' : '#a8a29e'); g.addColorStop(.5, '#57534e'); g.addColorStop(1, '#292524');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = a[5] ? 'rgba(250,250,250,.8)' : 'rgba(253,186,116,.5)'; ctx.lineWidth = 1; ctx.stroke();
  if (a[5]) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; const w = R(a[2]); ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(k * w / 6, -R(a[3]) / 2); ctx.lineTo(k * w / 6 + R(5), 0); ctx.lineTo(k * w / 6 - R(3), R(a[3]) / 2); } ctx.stroke(); }
  ctx.restore();
}
function drawGate(g, t) {
  if ((ship.keys >> g[5]) & 1) return;
  ctx.save(); ctx.translate(X(g[0]), Y(g[1])); ctx.rotate(g[4]); const w = R(g[2]), h = R(g[3]);
  ctx.fillStyle = `rgba(250,204,21,${0.35 + 0.15 * Math.sin(t * 4)})`; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2, -h / 2, w, h);
  for (let k = -w / 2 + 6; k < w / 2; k += 12) { ctx.beginPath(); ctx.moveTo(k, -h / 2); ctx.lineTo(k + 6, h / 2); ctx.stroke(); }
  ctx.font = `${R(14)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🔒', 0, R(5)); ctx.restore();
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
  ctx.fillStyle = on ? '#fff7ed' : 'rgba(253,186,116,.7)'; ctx.font = `bold ${R(11)}px sans-serif`; ctx.fillText(on ? '☀ СПАЛАХ' : warn ? '⚠ скоро' : '☀ ' + (f.period - ph).toFixed(1) + 'с', x + R(6), y + R(14));
}
function drawMagnet(m, t) {
  const x = X(m[0]), y = Y(m[1]), pol = (m[4] || 1) * ship.flip, col = pol > 0 ? '248,113,113' : '96,165,250';
  ctx.strokeStyle = `rgba(${col},.3)`; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(x, y, R(m[3]), 0, 7); ctx.stroke(); ctx.setLineDash([]);
  for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; let s = (t * .7 + k / 10) % 1; s = pol > 0 ? 1 - s : s; const rr = R(m[3]) * (1 - s * .85); ctx.fillStyle = `rgba(${col},.9)`; ctx.beginPath(); ctx.arc(x + Math.cos(a + s) * rr, y + Math.sin(a + s) * rr, R(2), 0, 7); ctx.fill(); }
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = R(7); ctx.strokeStyle = pol > 0 ? '#ef4444' : '#3b82f6'; ctx.beginPath(); ctx.arc(0, R(2), R(11), 0, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-R(11), R(2)); ctx.lineTo(-R(11), -R(10)); ctx.moveTo(R(11), R(2)); ctx.lineTo(R(11), -R(10)); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = `bold ${R(12)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(pol > 0 ? '+' : '−', 0, -R(14)); ctx.restore();
}
function drawPortal(t) {
  const x = X(L.portal[0]), y = Y(L.portal[1]), r = R(L.pr); glow(x, y, r * 2.4, 'rgba(34,211,238,A)', .35);
  ctx.save(); ctx.translate(x, y); for (let k = 0; k < 5; k++) { ctx.rotate(t * (0.8 + k * .3)); ctx.strokeStyle = `rgba(${k % 2 ? '165,243,252' : '34,211,238'},${.8 - k * .12})`; ctx.lineWidth = R(2.4); ctx.beginPath(); ctx.arc(0, 0, r * (1 - k * .16), k, k + 4.2); ctx.stroke(); } ctx.restore();
  glow(x, y, r * .6, 'rgba(236,254,255,A)', .95);
  if (y < 0 || y > H) { const ay = y < 0 ? 70 : H - 30; ctx.fillStyle = '#22d3ee'; ctx.font = `bold ${R(16)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(y < 0 ? '▲ портал' : '▼ портал', x, ay); ctx.textAlign = 'left'; }
}
function drawStar(s, k, t) {
  if (collected.has(k)) return; const x = X(s[0]), y = Y(s[1]), p = 1 + Math.sin(t * 4 + k) * .18; glow(x, y, R(22) * p, 'rgba(253,224,71,A)', .45);
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * .9 + k); ctx.scale(p, p); ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = R(i % 2 ? 5 : 11), a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = '#fde047'; ctx.fill(); ctx.restore();
}
function drawShuttle() {
  const x = X(ship.x), y = Y(ship.y);
  const ang = state === 'fly' && Math.hypot(ship.vx, ship.vy) > 2 ? Math.atan2(ship.vy, ship.vx) : aim ? aimVec().a : ship.ang; ship.ang = ang;
  // spaghettification: stretch toward the nearest hole
  let sp = 0, sa = 0; if (L) for (const h of L.holes) { const [hx, hy] = S.holePos(h, ship.t); const d = Math.hypot(hx - ship.x, hy - ship.y); const k = Math.max(0, 1 - (d - h.r * S.KILL) / (h.r * 3.5)); if (k > sp) { sp = k; sa = Math.atan2(hy - ship.y, hx - ship.x); } }
  const st = 1 + sp * sp * 0.95;
  // slow-motion echoes
  if (L && state === 'fly' && (slowT > 0 || tf < 0.75) && trail.length > 16) { for (let e = 4; e >= 1; e--) { const p = trail[Math.max(0, trail.length - 1 - e * 4)]; ctx.globalAlpha = 0.09 * (5 - e); drawHull(X(p.x), Y(p.y), ang, 1, 0, null, true); } ctx.globalAlpha = 1; }
  drawHull(x, y, ang, st, sa, lightAt(ship.x, ship.y), false);
}
function drawHull(x, y, ang, st, sa, lt, ghostly) {
  ctx.save(); ctx.translate(x, y);
  if (st > 1.01) { ctx.rotate(sa); ctx.scale(st, 1 / Math.sqrt(st)); ctx.rotate(-sa); }
  ctx.rotate(ang); const k = R(1);
  const fl0 = state === 'fly' && !braking ? 0.6 + thrust * 2 : state === 'aim' ? 0.25 : 0;
  if (fl0 > 0 && !ghostly) { const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; const len = (14 + Math.random() * 6) * fl0 * k; const g = ctx.createLinearGradient(-8 * k, 0, -8 * k - len, 0); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.3, 'rgba(56,189,248,.9)'); g.addColorStop(1, 'rgba(124,58,237,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-8 * k, -3.5 * k); ctx.quadraticCurveTo(-8 * k - len, 0, -8 * k, 3.5 * k); ctx.fill();
    glow(-9 * k, 0, 9 * k * fl0, 'rgba(56,189,248,A)', .5); ctx.globalCompositeOperation = pc; }
  if (braking && !ghostly) { ctx.fillStyle = 'rgba(251,146,60,.85)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(9 * k, s * 3 * k); ctx.lineTo((16 + Math.random() * 6) * k, s * (6 + Math.random() * 3) * k); ctx.lineTo(9 * k, s * 5 * k); ctx.fill(); } }
  if (shieldOn && !ghostly) { ctx.strokeStyle = `rgba(103,232,249,${.5 + .3 * Math.sin(animT * 6)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 16 * k, 0, 7); ctx.stroke(); }
  ctx.fillStyle = ghostly ? '#a5b4fc' : '#334155'; ctx.beginPath(); ctx.moveTo(1 * k, 0); ctx.lineTo(-7 * k, 10 * k); ctx.lineTo(-9 * k, 10 * k); ctx.lineTo(-6 * k, 0); ctx.lineTo(-9 * k, -10 * k); ctx.lineTo(-7 * k, -10 * k); ctx.closePath(); ctx.fill();
  const body = () => { ctx.beginPath(); ctx.moveTo(13 * k, 0); ctx.quadraticCurveTo(8 * k, -5 * k, -8 * k, -4.5 * k); ctx.lineTo(-9 * k, 4.5 * k); ctx.quadraticCurveTo(8 * k, 5 * k, 13 * k, 0); };
  const g = ctx.createLinearGradient(0, -5 * k, 0, 5 * k); g.addColorStop(0, '#e2e8f0'); g.addColorStop(.6, '#94a3b8'); g.addColorStop(1, '#475569');
  ctx.fillStyle = ghostly ? '#c7d2fe' : g; body(); ctx.fill();
  if (lt && !ghostly) { // directional light from nearest light source
    const la = lt.a - ang, lx = Math.cos(la) * 7 * k, ly = Math.sin(la) * 7 * k; const lg = ctx.createLinearGradient(lx, ly, -lx, -ly);
    lg.addColorStop(0, `rgba(${lt.c},${.75 * lt.k})`); lg.addColorStop(.45, `rgba(${lt.c},${.12 * lt.k})`); lg.addColorStop(.6, 'rgba(2,6,23,.15)'); lg.addColorStop(1, 'rgba(2,6,23,.7)');
    ctx.fillStyle = lg; body(); ctx.fill(); ctx.strokeStyle = lg; ctx.lineWidth = .9 * k; body(); ctx.stroke();
  }
  ctx.fillStyle = '#7c3aed'; ctx.fillRect(-6 * k, -1 * k, 12 * k, 2 * k); ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.ellipse(6 * k, 0, 3.2 * k, 2.2 * k, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(6.8 * k, -.8 * k, 1.1 * k, .6 * k, 0, 0, 7); ctx.fill();
  ctx.restore();
}
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
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = R(3); ctx.beginPath(); ctx.arc(x, y, R(21), 0, 7); ctx.stroke();
  const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${col},.35)`; ctx.lineWidth = R(6); ctx.beginPath(); ctx.arc(x, y, R(21), -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke();
  ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = R(2.2); ctx.beginPath(); ctx.arc(x, y, R(21), -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke(); ctx.globalCompositeOperation = pc; ctx.lineCap = 'butt';
  ctx.fillStyle = `rgb(${col})`; ctx.font = `bold ${R(15)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(v.pct + '%', x, y + R(46));
  ctx.font = `${R(10)}px sans-serif`; ctx.fillStyle = aim.fine ? '#fde68a' : '#c4b5fd'; ctx.fillText((aim.ang != null ? Math.round((-v.a * 180 / Math.PI + 360) % 360) + '°' : '') + (aim.fine ? ' · точно' : ''), x, y + R(58)); ctx.textAlign = 'left';
}
function powerCol(k) { // teal -> violet -> gold -> rose
  const st = [[0, [94, 234, 212]], [.45, [167, 139, 250]], [.75, [253, 224, 71]], [1, [251, 113, 133]]]; let i = 0; while (i < st.length - 2 && k > st[i + 1][0]) i++;
  const [k0, c0] = st[i], [k1, c1] = st[i + 1], f = Math.max(0, Math.min(1, (k - k0) / (k1 - k0))); return c0.map((c, j) => Math.round(c + (c1[j] - c) * f)).join(',');
}
let beamParts = [];
function drawBeam(v) {
  const k = v.pct / 100, col = powerCol(k), a = v.a, ca = Math.cos(a), sa = Math.sin(a);
  const len = (L.stub === 2 ? 64 : 34) * (0.5 + v.pct / 200), x0 = ship.x + ca * 10, y0 = ship.y + sa * 10, x1 = x0 + ca * len, y1 = y0 + sa * len;
  const px = -sa, py = ca, w0 = 5.5 + k * 3, fl = 1 + Math.sin(animT * 22) * .06 + Math.sin(animT * 37) * .04;
  const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  // outer plume (soft, tapered)
  const plume = (w, alpha) => { const g = ctx.createLinearGradient(X(x0), Y(y0), X(x1), Y(y1)); g.addColorStop(0, `rgba(${col},${alpha})`); g.addColorStop(.7, `rgba(${col},${alpha * .45})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X(x0 + px * w), Y(y0 + py * w)); ctx.quadraticCurveTo(X(x0 + ca * len * .55 + px * w * .8), Y(y0 + sa * len * .55 + py * w * .8), X(x1), Y(y1));
    ctx.quadraticCurveTo(X(x0 + ca * len * .55 - px * w * .8), Y(y0 + sa * len * .55 - py * w * .8), X(x0 - px * w), Y(y0 - py * w)); ctx.closePath(); ctx.fill(); };
  plume(w0 * 2.2 * fl, .16); plume(w0 * fl, .45); plume(w0 * .38, .95);
  // hot white core
  const cg = ctx.createLinearGradient(X(x0), Y(y0), X(x1), Y(y1)); cg.addColorStop(0, 'rgba(255,255,255,.95)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = cg; ctx.lineWidth = R(1.4); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x0 + ca * len * .85), Y(y0 + sa * len * .85)); ctx.stroke(); ctx.lineCap = 'butt';
  // tip spark
  const tx = x0 + ca * len * .82, ty = y0 + sa * len * .82; glow(X(tx), Y(ty), R(7 + k * 5), `rgba(${col},A)`, .55);
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); const sp = R(4 + k * 3) * (0.8 + Math.sin(animT * 9) * .2);
  ctx.moveTo(X(tx) - sp, Y(ty)); ctx.lineTo(X(tx) + sp, Y(ty)); ctx.moveTo(X(tx), Y(ty) - sp); ctx.lineTo(X(tx), Y(ty) + sp); ctx.stroke();
  // sparkles streaming along the beam
  const n = qLevel === 0 ? 1 : 2; for (let q = 0; q < n; q++) beamParts.push({ f: Math.random() * .2, o: (Math.random() - .5) * w0 * 1.4, v: .9 + Math.random() * 1.4, l: 1, s: .6 + Math.random() * 1.4 });
  for (let i = beamParts.length - 1; i >= 0; i--) { const b = beamParts[i]; b.f += b.v * 0.016; b.l -= 0.028; b.o *= .985; if (b.f > 1.15 || b.l <= 0) { beamParts.splice(i, 1); continue; }
    const bx = x0 + ca * len * b.f + px * b.o * (1 - b.f * .6), by = y0 + sa * len * b.f + py * b.o * (1 - b.f * .6); ctx.fillStyle = `rgba(${b.f > .6 ? '255,255,255' : col},${b.l * (1.1 - b.f)})`; ctx.beginPath(); ctx.arc(X(bx), Y(by), R(b.s * .7), 0, 7); ctx.fill(); }
  if (beamParts.length > 90) beamParts.splice(0, beamParts.length - 90);
  ctx.globalCompositeOperation = pc;
  // faint pull band (shows drag, not the path)
  const bx = ship.x - ca * v.p * 0.45, by = ship.y - sa * v.p * 0.45; const pg = ctx.createLinearGradient(X(ship.x), Y(ship.y), X(bx), Y(by)); pg.addColorStop(0, `rgba(${col},.35)`); pg.addColorStop(1, `rgba(${col},0)`);
  ctx.strokeStyle = pg; ctx.lineWidth = R(1.6); ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.moveTo(X(ship.x), Y(ship.y)); ctx.lineTo(X(bx), Y(by)); ctx.stroke(); ctx.setLineDash([]);
}
function drawFX(dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.l -= dt; if (p.l <= 0) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; ctx.globalAlpha = Math.min(1, p.l * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), R(p.r), 0, 7); ctx.fill(); }
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
let last = performance.now(), acc = 0, frozen = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; animT += dt;
  if (L && state === 'fly') {
    if (press && !braking && L.stops && ship.fuel > 0 && now - press.t >= HOLD_MS) { braking = true; hud(); }
    let sdt = dt; if (slowT > 0) { slowT -= dt; sdt = dt * 0.35; }
    acc += sdt; while (acc >= S.STEP && state === 'fly' && !frozen) { tick(); acc -= S.STEP; }
    thrust = Math.max(0, thrust - dt); heartbeat(dt);
    if (!braking) { const spd = Math.hypot(ship.vx, ship.vy), n = (qLevel === 0 ? 1 : 2) * (0.4 + spd / 400); const ba = Math.atan2(-ship.vy, -ship.vx);
      for (let q = 0; q < n; q++) if (Math.random() < 0.75) spark(ship.x - Math.cos(ba) * -6, ship.y - Math.sin(ba) * -6, ['rgba(56,189,248,.85)', 'rgba(167,139,250,.8)', 'rgba(255,255,255,.8)'][Math.floor(Math.random() * 3)], 20 + Math.random() * 40, ba + (Math.random() - .5) * .5); }
    hud();
  } else acc = 0;
  if (L && (state === 'aim' || state === 'fly')) save.stats.play += dt;
  if (aim && state === 'aim') { aimSmooth(dt); if (scanArmed && aim.ang != null) { const v = aimVec(); if (v.p > 3 && (Math.abs(wrapA(v.a - (aim.pa ?? 99))) > 0.002 || Math.abs(v.p - (aim.pp ?? -1)) > 0.5)) { aim.pa = v.a; aim.pp = v.p; preview = computePreview(v.a, v.p); } } }
  if (L && started && state === 'aim') clock += dt;
  if (L && started) $('hTime').textContent = clock.toFixed(1);
  if (L && ship) { const tgt = clampCam(ship.y); camWY += (tgt - camWY) * Math.min(1, dt * 4); parX += (((ship.x - 180) / 180) - parX) * .05; }
  shake *= Math.pow(0.02, dt);
  // camera: smooth follow + slight zoom on close passes
  [cpK, proxK] = holeK(); const cp = state === 'fly' ? cpK : 0;
  const tZ = 1 + 0.13 * cp; Z += (tZ - Z) * Math.min(1, dt * (tZ > Z ? 2.2 : 1.5));
  const zf = (Z - 1) / 0.13 * 0.45, baseCY = camWY + 320;
  camCX = L && ship ? 180 + (ship.x - 180) * zf : 180; camCY = L && ship ? baseCY + (ship.y - baseCY) * zf : 320;
  AU.update({ fly: state === 'fly', speed: ship && L ? Math.hypot(ship.vx, ship.vy) : 0, prox: state === 'fly' ? proxK : (L ? 0 : 0.35), tf: state === 'fly' ? (slowT > 0 ? 0.5 : tf) : 1, aiming: state === 'aim' && !!aim });
  // auto quality
  if (save.set.q === 'auto') { fpsT += (now - (frame.p || now)) / 1000; fpsN++; if (fpsT >= 2.5) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0;
    if (fps < 48 && autoQ > 0) { autoQ--; resize(); syncSettings(); } else if (fps > 58.5 && autoQ < 2 && !autoUp && animT > 10) { autoUp = 1; autoQ++; resize(); syncSettings(); } } }
  frame.p = now;
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
    L.flares.forEach(f => drawFlare(f, t)); L.magnets.forEach(m => drawMagnet(m, animT));
    L.planets.forEach(drawPlanet); L.asteroids.forEach(drawAsteroid); L.gates.forEach(g => drawGate(g, animT)); L.worms.forEach((w, i) => drawWorm(w, animT, i));
    L.moons.forEach(m => drawMoon(m, t)); L.holes.forEach(h => drawHoleTop(h, t));
    drawPortal(animT); L.keys.forEach((k, i) => drawKey(k, i, animT)); L.stars.forEach((s, k) => drawStar(s, k, animT));
    drawGhost(); drawTrail(); drawAim(); if (state !== 'fail') drawShuttle(); if (state === 'aim' && aim && aim.ang != null) drawBeam(aimVec()); drawFX(dt); if (!useGL) drawSlowmo();
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
    d.innerHTML = `<b>${open ? '' : s.soon ? '⏳ ' : '🔒 '}${i + 1}. ${s.n}${s.soon ? ' <span class="badge">СКОРО</span>' : ''}</b><small>${s.d}</small>${st}${open || s.soon ? '' : `<small class="lk">${CAT.lockText(s)}</small>`}`;
    d.onclick = () => { if (open) { curSector = i; buildLevels(); show('levels'); } else toast(s.soon ? '⏳ Сектор у розробці — скоро!' : '🔒 ' + CAT.lockText(s), 1300); }; $('secList').appendChild(d);
  }
  $('secPager').style.display = pages > 1 ? 'flex' : 'none'; $('sPage').textContent = `${secPage + 1} / ${pages}`;
  $('sDots').innerHTML = pages <= 12 ? Array.from({ length: pages }, (_, k) => `<i class="${k === secPage ? 'on' : ''}" data-p="${k}"></i>`).join('') : '';
  $('sDots').querySelectorAll('i').forEach(e => e.onclick = () => { secPage = +e.dataset.p; buildSectors(); });
}
$('sPrev').onclick = () => { secPage--; buildSectors(); }; $('sNext').onclick = () => { secPage++; buildSectors(); };
{ let sx = null; $('secList').addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true }); $('secList').addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) { secPage += dx < 0 ? 1 : -1; buildSectors(); } }); }
function buildLevels() {
  const s = SECTORS[curSector]; $('secTitle').textContent = `${curSector + 1}. ${s.n}`; $('grid').innerHTML = '';
  for (const i of s.idx) {
    const b = document.createElement('button'); const lock = !isOpen(i); const st = (bestOf(i) || {}).s || 0;
    b.className = 'lv' + (lock ? ' lock' : '') + (LEVELS[i].boss ? ' boss' : ''); b.innerHTML = `${lock ? '🔒' : LEVELS[i].boss ? '☠' : i + 1}<span>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`;
    b.onclick = () => { if (!lock) startLevel(i); }; $('grid').appendChild(b);
  }
}
function toMenu() { resetInput(); ensureBG(5); state = 'menu'; L = null; ship = null; camWY = 0; Z = 1; camCX = 180; camCY = 320; AU.aimEnd(); persist();
  const stn = PR.stars(save), rk = PR.rank(stn);
  $('rank').innerHTML = `<b>${rk.name}</b><div class="bar"><i style="width:${rk.nextAt ? Math.round((stn - rk.at) / (rk.nextAt - rk.at) * 100) : 100}%"></i></div><span>${rk.next ? `до «${rk.next}»: ${rk.nextAt - stn} ★` : 'найвищий ранг'}</span>`;
  $('score').textContent = `Загальний рахунок: ${PR.score(save).toLocaleString('uk-UA')} · досягнення ${Object.keys(save.achv).length}/${PR.ACH.length}`; $('hud').style.display = 'none'; $('hint').style.display = 'none'; $('hand').style.display = 'none'; $('pu').style.display = 'none';
  $('totalStars').textContent = `★ ${totalStars()}/${CAT.maxStars} · відкрито: ${LEVELS.filter((_, i) => isOpen(i)).length}/${LEVELS.length}`;
  $('puInfo').textContent = `Бонуси: 🚀${save.pu.extra} 📡${save.pu.scan} 🛡${save.pu.shield} ⏳${save.pu.slow} · серія ★★★ ${save.streak % 4}/4`; show('menu'); }
function syncSettings() { $('tVib').classList.toggle('on', save.set.vib); $('tSnd').classList.toggle('on', save.set.snd); $('rSfx').value = save.set.sfx; $('rMus').value = save.set.mus;
  document.querySelectorAll('#qSeg button').forEach(b => b.classList.toggle('on', b.dataset.q === save.set.q));
  $('qInfo').textContent = `Зараз: ${QN[qLevel]} · ${useGL ? 'WebGL (лінзування, світіння)' : 'Canvas (спрощено)'}`; AU.configure(save.set); }
// ---------- achievements / stats ----------
let achQ = [], achBusy = false;
function achCheck(ev) { const got = PR.check(save, ev); if (got.length) { persist(); achQ.push(...got); if (!achBusy) achNext(); } }
function achNext() { const a = achQ.shift(); if (!a) { achBusy = false; return; } achBusy = true; const e = $('achT'); e.style.top = (L && state !== 'menu') ? '130px' : '14px'; e.innerHTML = `<span class="ai">${a.i}</span><div><small>Досягнення відкрито</small><b>${a.n}</b></div>`; e.classList.add('on'); AU.ach(); HAP.star();
  setTimeout(() => { e.classList.remove('on'); setTimeout(achNext, 380); }, 2300); }
function buildAch() { const n = Object.keys(save.achv).length; $('achCount').textContent = `${n} / ${PR.ACH.length}`;
  $('achList').innerHTML = PR.ACH.map(a => { const t = save.achv[a.id]; return `<div class="ach${t ? ' got' : ''}"><span class="ai">${t ? a.i : '🔒'}</span><div><b>${a.n}</b><small>${a.d}</small>${t ? `<em>${new Date(t).toLocaleDateString('uk-UA')}</em>` : ''}</div></div>`; }).join(''); }
const fmtT = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h ? `${h} год ${m} хв` : m ? `${m} хв ${ss} с` : `${ss} с`; };
function buildStats() { const st = save.stats, stn = PR.stars(save), rk = PR.rank(stn), done = LEVELS.filter((_, i) => bestOf(i)).length;
  const D = { swallowed: 'горизонт подій', moon: 'місяці', flare: 'спалахи', oob: 'відкритий космос', stranded: 'зупинка без запусків' };
  const rows = [['Ранг', rk.name], ['Зірки', `${stn} / ${CAT.maxStars}`], ['Загальний рахунок', PR.score(save).toLocaleString('uk-UA')], ['Пройдено рівнів', `${done} / ${LEVELS.length}`], ['Запуски', st.launches], ['Час у польоті', fmtT(st.flight)], ['Час у грі', fmtT(st.play)],
    ['Перемоги / втрати', `${st.wins} / ${st.fails}`], ...Object.keys(D).filter(k => st.deaths[k]).map(k => ['  · ' + D[k], st.deaths[k]]), ['Бонусні зірки', st.bonus], ['Рикошети', st.bounces], ['Кротові нори', st.worms], ['Перемикання магнітів', st.flips], ['Використано бонусів', st.puUsed], ['Сповільнений час', fmtT(st.dilate)]];
  let h = '<div class="rows">' + rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') + '</div><h3>Рекорди рівнів</h3><div class="rows lvb">';
  for (let i = 0; i < LEVELS.length; i++) { const b = bestOf(i); if (!b) continue; h += `<div><span>${i + 1}. ${LEVELS[i].n}</span><b>${'★'.repeat(b.s)}${'☆'.repeat(3 - b.s)} ${b.sc} · ${b.t ? b.t.toFixed(1) + 'с' : '—'}</b></div>`; }
  if (!done) h += '<div><span>Ще немає пройдених рівнів</span></div>';
  $('statBody').innerHTML = h + '</div>'; }
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
$('rMus').oninput = e => { save.set.mus = +e.target.value; persist(); AU.configure(save.set); };
$('bSetBack').onclick = toMenu; $('bBack1').onclick = toMenu; $('bBack2').onclick = () => { buildSectors(); show('sectors'); };
$('bRestart').onclick = () => { if (started) { ghost = attempt.slice(); ghostLevel = li; } startLevel(li, true); }; $('bMenu').onclick = toMenu;
$('bNext').onclick = () => startLevel(li + 1); $('bRetry').onclick = () => startLevel(li); $('bRetry2').onclick = () => startLevel(li, true);
$('bLv').onclick = $('bLv2').onclick = () => { curSector = CAT.secOf[li]; buildLevels(); show('levels'); };
AU.configure(save.set); toMenu();
window.BH = { LEVELS, startLevel, launch: (a, p) => launch(a, p), get state() { return state; }, get ship() { return ship; }, get clock() { return clock; }, toMenu, save, persist,
  advance(n, brake, tg) { braking = !!brake && ship.fuel > 0; for (let i = 0; i < n && state === 'fly'; i++) { if (tg != null && i === tg) ship.flip = -ship.flip; tick(); } braking = false; },
  runPlanStep(st) { launch(st.a, st.p); for (let i = 0; i < 2600 && state === 'fly'; i++) { if (st.tg != null && i === st.tg) ship.flip = -ship.flip; braking = st.b != null && i >= st.b && ship.fuel > 0; tick(); } braking = false; },
  show, buildSectors, syncSettings, buildAch, buildStats, achCheck, get gl() { return useGL; }, get quality() { return qLevel; }, get zoom() { return Z; }, CAT, levelId: LID, unlockAll() { LEVELS.forEach((_, i) => save.open[LID(i)] = 1); persist(); }, get braking() { return braking; }, get pressing() { return !!press; }, toScreen(x, y) { return [X(x), Y(y)]; }, stepN(n) { for (let i = 0; i < n && state === 'fly'; i++) tick(); }, freeze(b) { frozen = !!b; }, setShip(x, y, vx, vy) { ship.x = x; ship.y = y; ship.vx = vx; ship.vy = vy; } };
})();
