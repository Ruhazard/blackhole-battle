/* Blackhole Battle v3.1 — stage 2: visuals, sound, progress (gameplay/physics unchanged from v3.0) */
(() => {
'use strict';
const S = window.BHSim;
const LEVELS = window.BH3_LEVELS || window.BH3_SRC;
const SECTORS = [
  { n: 'Пояс Кеплера', d: 'Сила, точність, одна діра, гальмо', c: '#7c3aed' },
  { n: 'Місяці Гіганта', d: 'Рухомі місяці, таймінг, рикошети', c: '#0ea5e9' },
  { n: 'Магнітар', d: 'Полярні магніти, білі діри, вітер і ліфти', c: '#db2777' },
  { n: 'Кротові нори', d: 'Нори, ворота й ключі, ламані маршрути', c: '#10b981' },
  { n: 'Горизонт подій', d: 'Усе разом: пульсари й подвійні діри', c: '#ea580c' }];
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
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
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
function buildBG() {
  const r = rng(7);
  bg = document.createElement('canvas'); bg.width = W * BGS; bg.height = H * BGS;
  const b = bg.getContext('2d'); b.scale(BGS, BGS);
  const g = b.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05030f'); g.addColorStop(.5, '#0a0520'); g.addColorStop(1, '#03020a');
  b.fillStyle = g; b.fillRect(0, 0, W, H);
  const neb = [['124,58,237', .24], ['219,39,119', .15], ['14,165,233', .13], ['234,88,12', .09]];
  for (let i = 0; i < 11; i++) { const [c, a] = neb[i % 4]; const x = r() * W, y = r() * H, rad = (0.2 + r() * 0.45) * Math.max(W, H);
    const ng = b.createRadialGradient(x, y, 0, x, y, rad); ng.addColorStop(0, `rgba(${c},${a})`); ng.addColorStop(.5, `rgba(${c},${a * .35})`); ng.addColorStop(1, `rgba(${c},0)`); b.fillStyle = ng; b.fillRect(0, 0, W, H); }
  // dust lanes
  b.globalCompositeOperation = 'multiply'; for (let i = 0; i < 5; i++) { const x = r() * W, y = r() * H, rad = (0.1 + r() * 0.25) * W; const dg = b.createRadialGradient(x, y, 0, x, y, rad); dg.addColorStop(0, 'rgba(10,6,20,.55)'); dg.addColorStop(1, 'rgba(10,6,20,0)'); b.fillStyle = dg; b.fillRect(0, 0, W, H); } b.globalCompositeOperation = 'source-over';
  layers = [0.6, 1, 1.6].map((sz, li) => {
    const L = document.createElement('canvas'); L.width = (W + 80) * BGS; L.height = (H + 80) * BGS; const c = L.getContext('2d'); c.scale(BGS, BGS);
    for (let i = 0; i < [280, 120, 42][li]; i++) { const x = r() * (W + 80), y = r() * (H + 80), a = 0.3 + r() * 0.7, tint = ['255,255,255', '199,210,254', '254,243,199', '191,219,254'][Math.floor(r() * 4)]; c.fillStyle = `rgba(${tint},${a})`; c.beginPath(); c.arc(x, y, sz * (0.5 + r()), 0, 7); c.fill();
      if (li === 2 && r() < .35) { c.strokeStyle = `rgba(${tint},${a * .35})`; c.lineWidth = .6; c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x + 5, y); c.moveTo(x, y - 5); c.lineTo(x, y + 5); c.stroke(); } }
    return L;
  });
  twinkles = Array.from({ length: 45 }, () => ({ x: r() * W, y: r() * H, p: r() * 6.28, s: 0.6 + r() * 1.4, f: 1 + r() * 3 }));
}
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
  ctx.drawImage(bg, 0, 0, W, H);
  layers.forEach((L, i) => { const k = [6, 14, 26][i]; const oy = ((camWY * SC * [0.05, 0.1, 0.2][i]) % (H)); ctx.drawImage(L, -40 - parX * k, -40 - parY * k - oy, W + 80, H + 80); ctx.drawImage(L, -40 - parX * k, -40 - parY * k - oy + H, W + 80, H + 80); });
  for (const s of twinkles) { const a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.f + s.p)); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, 7); ctx.fill(); }
}

// ---------- state ----------
let state = 'menu', li = 0, L = null, ship = null, launchesLeft = 0, collected = new Set(), clock = 0, started = false;
let braking = false, trail = [], attempt = [], ghost = null, parts = [], pops = [], shake = 0, aim = null, preview = [], tf = 1, animT = 0, curSector = 0, thrust = 0;
let active = {}, scanArmed = false, shieldOn = false, slowT = 0, heartT = 0, pressT = -1, lastTick = 0, ghostLevel = -1;

function startLevel(i, keepGhost) {
  if (!keepGhost || ghostLevel !== i) { ghost = null; }
  li = i; L = S.prep(LEVELS[i]); ship = S.newShip(L); ship.ang = -Math.PI / 2;
  launchesLeft = L.L; collected = new Set(); clock = 0; started = false; braking = false; pressT = -1;
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
function aimVec() { const dx = aim.sx - aim.x, dy = aim.sy - aim.y, d = Math.hypot(dx, dy); const pull = Math.min(d, S.MAX_PULL); return { a: Math.atan2(dy, dx), p: pull, pct: Math.round(pull / S.MAX_PULL * 100) }; }
function launch(a, p) {
  const sp = S.launchSpeed(p); ship.vx = Math.cos(a) * sp; ship.vy = Math.sin(a) * sp;
  launchesLeft--; started = true; state = 'fly'; aim = null; thrust = 0.35; ship.scan = scanArmed; preview = []; scanArmed = false;
  if (active.slow && !active.slowUsed) { slowT = 3; active.slowUsed = 1; }
  for (let i = 0; i < 18; i++) spark(ship.x, ship.y, '#22d3ee', 60 + Math.random() * 90, a + Math.PI + (Math.random() - .5) * 1.2);
  $('hint').style.display = 'none'; $('hand').style.display = 'none'; $('pu').style.display = 'none';
  if (li === 0) { save.tut.aim = 1; persist(); }
  HAP.launch(); AU.launch(p / S.MAX_PULL * 100); save.stats.launches++; hud();
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (state === 'fly') { pressT = performance.now(); return; }
  if (state !== 'aim') return;
  const p = wpos(e); aim = { sx: p.x, sy: p.y, x: p.x, y: p.y, lastPct: 0 }; $('hand').style.display = 'none'; AU.aimStart();
});
cv.addEventListener('pointermove', e => {
  if (state !== 'aim' || !aim) return; const p = wpos(e); aim.x = p.x; aim.y = p.y;
  const v = aimVec(); AU.aimPower(v.pct); const step = Math.floor(v.pct / 10); if (step !== aim.lastPct) { aim.lastPct = step; HAP.tick(); }
  preview = (scanArmed && v.p > 3) ? computePreview(v.a, v.p) : [];
});
const up = () => {
  if (state === 'fly') {
    const held = pressT >= 0 ? performance.now() - pressT : 0; pressT = -1;
    if (!braking && held < 160 && L.magnets.length) { ship.flip = -ship.flip; HAP.magnet(); AU.magnet(ship.flip); save.stats.flips++; achCheck(); burst(ship.x, ship.y, ship.flip > 0 ? '#f87171' : '#60a5fa', 12); }
    braking = false; hud(); return;
  }
  if (state !== 'aim' || !aim) return;
  const v = aimVec(); if (v.p < 6) { aim = null; preview = []; AU.aimEnd(); return; }
  launch(v.a, v.p);
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
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
  clock += S.STEP;
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
  if (braking && Math.hypot(ship.vx, ship.vy) < S.STOP_SPEED) {
    ship.vx = 0; ship.vy = 0; braking = false; burst(ship.x, ship.y, '#fb923c', 14); HAP.stop(); AU.stop();
    if (launchesLeft > 0) { state = 'aim'; const h = $('hint'); h.innerHTML = '🛑 Зупинка! Цілься знову — <b>ще ' + launchesLeft + '</b>'; h.style.display = 'block'; }
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
  state = 'result'; burst(L.portal[0], L.portal[1], '#22d3ee', 50); $('hud').style.display = 'none'; $('hint').style.display = 'none'; ghost = null;
  const t = clock, st = starsFor(t), timePts = Math.max(0, Math.round(((L.t2 || 20) - t) * 100)), bon = collected.size * 250, unused = launchesLeft * 300;
  const score = st * 1000 + timePts + bon + unused;
  const prev = save.best[li] || { s: 0, sc: 0 }; const isBest = score > prev.sc; const rk0 = PR.rank(PR.stars(save));
  save.best[li] = { s: Math.max(prev.s, st), sc: Math.max(prev.sc, score), t: Math.min(prev.t || 1e9, +t.toFixed(2)) };
  save.stats.wins++; AU.win(st);
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, li + 2));
  let streakMsg = '';
  if (st === 3) { save.streak++; if (save.streak % 4 === 0) streakMsg = grant(`Серія ${save.streak}× ★★★`); else streakMsg = `Серія ★★★: ${save.streak % 4}/4 до бонусу`; }
  else { save.streak = 0; streakMsg = 'Серію ★★★ скинуто'; }
  if (L.boss && !save.ach['boss' + li]) { save.ach['boss' + li] = 1; streakMsg += '<br>' + grant('Бос переможений'); }
  const rk1 = PR.rank(PR.stars(save)); if (rk1.i > rk0.i) streakMsg += `<br>🎖 Новий ранг: <b>${rk1.name}</b>!`;
  achCheck({ type: 'win', bonus: collected.size, margin: fl.margin, bounces: fl.bounces, time: t });
  persist();
  $('rTitle').textContent = st === 3 ? 'Ідеально!' : st === 2 ? 'Чудово!' : 'Портал досягнуто';
  $('rStars').innerHTML = [0, 1, 2].map(k => `<span class="${k < st ? '' : 'e'}">★</span>`).join('');
  $('rRows').innerHTML = `<div><span>⏱ ${t.toFixed(1)}с (3★ ≤ ${L.t3}с, 2★ ≤ ${L.t2}с)</span></div><div><span>Рейтинг ${st}×1000</span><b>${st * 1000}</b></div><div><span>Бонус за час</span><b>${timePts}</b></div><div><span>Бонусні зірки ${collected.size}×250</span><b>${bon}</b></div><div><span>Запуски в запасі ${launchesLeft}×300</span><b>${unused}</b></div>`;
  $('rScore').textContent = score; $('rTotal').textContent = `Загальний рахунок: ${PR.score(save)} · ${rk1.name}`; $('rBest').textContent = isBest ? '🏆 Новий рекорд!' : `Рекорд: ${save.best[li].sc}`; $('rStreak').innerHTML = streakMsg;
  $('bNext').style.display = li + 1 < LEVELS.length ? '' : 'none';
  setTimeout(() => { if (state === 'result') show('result'); }, 450);
}
function grant(why) {
  if (puTotal() >= 3) return `${why}: сховище бонусів повне (3/3)`;
  const keys = Object.keys(PU); const k = keys[(save.streak + Object.keys(save.ach).length + li) % keys.length]; save.pu[k]++;
  return `🎁 ${why}: отримано ${PU[k].i} ${PU[k].n}!`;
}
function fail(msg, why) {
  state = 'fail'; burst(ship.x, ship.y, '#ef4444', 40); shake = 14; HAP.death(); AU.lose();
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
  // short direction stub from nose
  const len = (L.stub === 2 ? 64 : 34) * (0.5 + v.pct / 200); const nx = ship.x + Math.cos(v.a) * 14, ny = ship.y + Math.sin(v.a) * 14, ex = nx + Math.cos(v.a) * len, ey = ny + Math.sin(v.a) * len;
  ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = R(2.5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X(nx), Y(ny)); ctx.lineTo(X(ex), Y(ey)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(ex), Y(ey)); ctx.lineTo(X(ex - Math.cos(v.a - .45) * 9), Y(ey - Math.sin(v.a - .45) * 9)); ctx.moveTo(X(ex), Y(ey)); ctx.lineTo(X(ex - Math.cos(v.a + .45) * 9), Y(ey - Math.sin(v.a + .45) * 9)); ctx.stroke(); ctx.lineCap = 'butt';
  const bx = ship.x - Math.cos(v.a) * v.p * 0.6, by = ship.y - Math.sin(v.a) * v.p * 0.6;
  ctx.strokeStyle = 'rgba(233,213,255,.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(X(bx), Y(by)); ctx.stroke(); ctx.setLineDash([]);
  const col = v.pct > 85 ? '#f43f5e' : v.pct > 50 ? '#fbbf24' : '#34d399';
  ctx.strokeStyle = col; ctx.lineWidth = R(3); ctx.beginPath(); ctx.arc(x, y, R(26), -Math.PI / 2, -Math.PI / 2 + v.pct / 100 * 6.283); ctx.stroke();
  ctx.fillStyle = col; ctx.font = `bold ${R(15)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(v.pct + '%', x, y + R(46));
  ctx.font = `${R(10)}px sans-serif`; ctx.fillStyle = '#c4b5fd'; ctx.fillText(Math.round((-v.a * 180 / Math.PI + 360) % 360) + '°', x, y + R(58)); ctx.textAlign = 'left';
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
    if (pressT >= 0 && !braking && L.stops && ship.fuel > 0 && now - pressT >= 160) { braking = true; hud(); }
    let sdt = dt; if (slowT > 0) { slowT -= dt; sdt = dt * 0.35; }
    acc += sdt; while (acc >= S.STEP && state === 'fly' && !frozen) { tick(); acc -= S.STEP; }
    thrust = Math.max(0, thrust - dt); heartbeat(dt);
    if (!braking) { const spd = Math.hypot(ship.vx, ship.vy), n = (qLevel === 0 ? 1 : 2) * (0.4 + spd / 400); const ba = Math.atan2(-ship.vy, -ship.vx);
      for (let q = 0; q < n; q++) if (Math.random() < 0.75) spark(ship.x - Math.cos(ba) * -6, ship.y - Math.sin(ba) * -6, ['rgba(56,189,248,.85)', 'rgba(167,139,250,.8)', 'rgba(255,255,255,.8)'][Math.floor(Math.random() * 3)], 20 + Math.random() * 40, ba + (Math.random() - .5) * .5); }
    hud();
  } else acc = 0;
  if (L && (state === 'aim' || state === 'fly')) save.stats.play += dt;
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
    drawGhost(); drawTrail(); drawAim(); if (state !== 'fail') drawShuttle(); drawFX(dt); if (!useGL) drawSlowmo();
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
const secStars = s => { let n = 0; for (let i = s * 10; i < s * 10 + 10; i++) n += (save.best[i] || {}).s || 0; return n; };
const totalStars = () => Object.values(save.best).reduce((a, b) => a + b.s, 0);
function buildSectors() {
  $('secList').innerHTML = ''; SECTORS.forEach((s, i) => {
    const d = document.createElement('div'); const lock = save.unlocked < i * 10 + 1; d.className = 'sector' + (lock ? ' lock' : ''); d.style.borderColor = s.c;
    d.innerHTML = `<b>${lock ? '🔒 ' : ''}${i + 1}. ${s.n}</b><small>${s.d}</small><div style="margin-top:4px;color:#fde047;font-size:13px">★ ${secStars(i)}/30</div>`;
    d.onclick = () => { if (!lock) { curSector = i; buildLevels(); show('levels'); } }; $('secList').appendChild(d);
  });
}
function buildLevels() {
  $('secTitle').textContent = `${curSector + 1}. ${SECTORS[curSector].n}`; $('grid').innerHTML = '';
  for (let i = curSector * 10; i < curSector * 10 + 10 && i < LEVELS.length; i++) {
    const b = document.createElement('button'); const lock = i + 1 > save.unlocked; const st = (save.best[i] || {}).s || 0;
    b.className = 'lv' + (lock ? ' lock' : '') + (LEVELS[i].boss ? ' boss' : ''); b.innerHTML = `${lock ? '🔒' : LEVELS[i].boss ? '☠' : i + 1}<span>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`;
    b.onclick = () => { if (!lock) startLevel(i); }; $('grid').appendChild(b);
  }
}
function toMenu() { state = 'menu'; L = null; ship = null; camWY = 0; Z = 1; camCX = 180; camCY = 320; AU.aimEnd(); persist();
  const stn = PR.stars(save), rk = PR.rank(stn);
  $('rank').innerHTML = `<b>${rk.name}</b><div class="bar"><i style="width:${rk.nextAt ? Math.round((stn - rk.at) / (rk.nextAt - rk.at) * 100) : 100}%"></i></div><span>${rk.next ? `до «${rk.next}»: ${rk.nextAt - stn} ★` : 'найвищий ранг'}</span>`;
  $('score').textContent = `Загальний рахунок: ${PR.score(save).toLocaleString('uk-UA')} · досягнення ${Object.keys(save.achv).length}/${PR.ACH.length}`; $('hud').style.display = 'none'; $('hint').style.display = 'none'; $('hand').style.display = 'none'; $('pu').style.display = 'none';
  $('totalStars').textContent = `★ ${totalStars()}/150 · відкрито: ${save.unlocked}/${LEVELS.length}`;
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
function buildStats() { const st = save.stats, stn = PR.stars(save), rk = PR.rank(stn), done = Object.keys(save.best).length;
  const D = { swallowed: 'горизонт подій', moon: 'місяці', flare: 'спалахи', oob: 'відкритий космос', stranded: 'зупинка без запусків' };
  const rows = [['Ранг', rk.name], ['Зірки', `${stn} / 150`], ['Загальний рахунок', PR.score(save).toLocaleString('uk-UA')], ['Пройдено рівнів', `${done} / ${LEVELS.length}`], ['Запуски', st.launches], ['Час у польоті', fmtT(st.flight)], ['Час у грі', fmtT(st.play)],
    ['Перемоги / втрати', `${st.wins} / ${st.fails}`], ...Object.keys(D).filter(k => st.deaths[k]).map(k => ['  · ' + D[k], st.deaths[k]]), ['Бонусні зірки', st.bonus], ['Рикошети', st.bounces], ['Кротові нори', st.worms], ['Перемикання магнітів', st.flips], ['Використано бонусів', st.puUsed], ['Сповільнений час', fmtT(st.dilate)]];
  let h = '<div class="rows">' + rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') + '</div><h3>Рекорди рівнів</h3><div class="rows lvb">';
  for (let i = 0; i < LEVELS.length; i++) { const b = save.best[i]; if (!b) continue; h += `<div><span>${i + 1}. ${LEVELS[i].n}</span><b>${'★'.repeat(b.s)}${'☆'.repeat(3 - b.s)} ${b.sc} · ${b.t ? b.t.toFixed(1) + 'с' : '—'}</b></div>`; }
  if (!done) h += '<div><span>Ще немає пройдених рівнів</span></div>';
  $('statBody').innerHTML = h + '</div>'; }
$('bAch').onclick = () => { buildAch(); show('achs'); }; $('bStats').onclick = () => { buildStats(); show('stats'); };
$('bAchBack').onclick = toMenu; $('bStatBack').onclick = toMenu;
document.querySelectorAll('#qSeg button').forEach(b => b.onclick = () => { save.set.q = b.dataset.q; if (b.dataset.q === 'auto') { autoQ = 1; autoUp = 0; } persist(); resize(); syncSettings(); });
document.addEventListener('pointerdown', () => AU.unlock(), true);
document.getElementById('ui').addEventListener('click', e => { if (e.target.closest('button')) AU.click(); });
$('bPlay').onclick = () => startLevel(Math.min(save.unlocked, LEVELS.length) - 1);
$('bSectors').onclick = () => { buildSectors(); show('sectors'); };
$('bSettings').onclick = () => { syncSettings(); show('settings'); };
$('tVib').onclick = () => { save.set.vib = !save.set.vib; persist(); syncSettings(); HAP.tick(); };
$('tSnd').onclick = () => { save.set.snd = !save.set.snd; persist(); syncSettings(); };
$('rSfx').oninput = e => { save.set.sfx = +e.target.value; persist(); AU.configure(save.set); }; $('rSfx').onchange = () => AU.star(2);
$('rMus').oninput = e => { save.set.mus = +e.target.value; persist(); AU.configure(save.set); };
$('bSetBack').onclick = toMenu; $('bBack1').onclick = toMenu; $('bBack2').onclick = () => { buildSectors(); show('sectors'); };
$('bRestart').onclick = () => { if (started) { ghost = attempt.slice(); ghostLevel = li; } startLevel(li, true); }; $('bMenu').onclick = toMenu;
$('bNext').onclick = () => startLevel(li + 1); $('bRetry').onclick = () => startLevel(li); $('bRetry2').onclick = () => startLevel(li, true);
$('bLv').onclick = $('bLv2').onclick = () => { curSector = Math.floor(li / 10); buildLevels(); show('levels'); };
AU.configure(save.set); toMenu();
window.BH = { LEVELS, startLevel, launch: (a, p) => launch(a, p), get state() { return state; }, get ship() { return ship; }, get clock() { return clock; }, toMenu, save, persist,
  advance(n, brake, tg) { braking = !!brake && ship.fuel > 0; for (let i = 0; i < n && state === 'fly'; i++) { if (tg != null && i === tg) ship.flip = -ship.flip; tick(); } braking = false; },
  runPlanStep(st) { launch(st.a, st.p); for (let i = 0; i < 2600 && state === 'fly'; i++) { if (st.tg != null && i === st.tg) ship.flip = -ship.flip; braking = st.b != null && i >= st.b && ship.fuel > 0; tick(); } braking = false; },
  show, buildSectors, syncSettings, buildAch, buildStats, achCheck, get gl() { return useGL; }, get quality() { return qLevel; }, get zoom() { return Z; }, freeze(b) { frozen = !!b; }, setShip(x, y, vx, vy) { ship.x = x; ship.y = y; ship.vx = vx; ship.vy = vy; } };
})();
