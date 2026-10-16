/* Blackhole Battle v2 — space gravity puzzle */
(() => {
'use strict';
const S = window.BHSim;
const LEVELS = window.BH_LEVELS || window.BH_SRC;
const SECTORS = [{ n: 'Пояс Оріона', d: 'Навчання: запуск, дуга, гальмо, відскок, вітер, магніт', c: '#7c3aed' },
                 { n: 'Туманність Краба', d: 'Місяці, подвійні діри, ламані траєкторії', c: '#db2777' },
                 { n: 'Горизонт подій', d: 'Важкі комбінації, 2–3 запуски', c: '#ea580c' }];
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let W, H, DPR, SC, OX, OY;
const X = x => OX + x * SC, Y = y => OY + y * SC, R = v => v * SC;

// ---------- seeded rng ----------
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// ---------- background ----------
let bg = null, layers = [], twinkles = [];
function buildBG() {
  const r = rng(7);
  bg = document.createElement('canvas'); bg.width = W * DPR; bg.height = H * DPR;
  const b = bg.getContext('2d'); b.scale(DPR, DPR);
  const g = b.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05030f'); g.addColorStop(.5, '#0a0520'); g.addColorStop(1, '#03020a');
  b.fillStyle = g; b.fillRect(0, 0, W, H);
  const neb = [['124,58,237', .22], ['219,39,119', .14], ['14,165,233', .12], ['234,88,12', .08]];
  for (let i = 0; i < 9; i++) {
    const [c, a] = neb[i % 4]; const x = r() * W, y = r() * H, rad = (0.25 + r() * 0.45) * Math.max(W, H);
    const ng = b.createRadialGradient(x, y, 0, x, y, rad); ng.addColorStop(0, `rgba(${c},${a})`); ng.addColorStop(1, `rgba(${c},0)`);
    b.fillStyle = ng; b.fillRect(0, 0, W, H);
  }
  layers = [0.6, 1, 1.6].map((sz, li) => {
    const L = document.createElement('canvas'); L.width = (W + 80) * DPR; L.height = (H + 80) * DPR;
    const c = L.getContext('2d'); c.scale(DPR, DPR);
    const n = [260, 110, 40][li];
    for (let i = 0; i < n; i++) {
      const x = r() * (W + 80), y = r() * (H + 80), a = 0.3 + r() * 0.7;
      const hue = r() < .2 ? '200,220,255' : r() < .3 ? '255,220,200' : '255,255,255';
      c.fillStyle = `rgba(${hue},${a})`; c.beginPath(); c.arc(x, y, sz * (0.5 + r()), 0, 7); c.fill();
      if (li === 2) { const sg = c.createRadialGradient(x, y, 0, x, y, 6); sg.addColorStop(0, `rgba(${hue},.35)`); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(x - 6, y - 6, 12, 12); }
    }
    return L;
  });
  twinkles = Array.from({ length: 45 }, () => ({ x: r() * W, y: r() * H, p: r() * 6.28, s: 0.6 + r() * 1.4, f: 1 + r() * 3 }));
}
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  SC = Math.min(W / 360, H / 640); OX = (W - 360 * SC) / 2; OY = (H - 640 * SC) / 2;
  buildBG();
}
addEventListener('resize', resize); resize();
let camX = 0, camY = 0;
function drawBG(t) {
  ctx.drawImage(bg, 0, 0, W, H);
  layers.forEach((L, i) => { const k = [6, 14, 26][i]; ctx.drawImage(L, -40 - camX * k, -40 - camY * k, W + 80, H + 80); });
  for (const s of twinkles) { const a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.f + s.p)); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, 7); ctx.fill(); }
}

// ---------- save ----------
const KEY = 'bh_v2';
let save; try { save = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { save = null; }
if (!save) save = { unlocked: 1, best: {}, tut: {} };
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };

// ---------- game state ----------
let state = 'menu', li = 0, L = null, ship = null, launchesLeft = 0, collected = new Set(), clock = 0, started = false;
let braking = false, trail = [], parts = [], pops = [], shake = 0, aim = null, preview = [], tf = 1, animT = 0, curSector = 0, thrust = 0;

function startLevel(i) {
  li = i; L = S.prep(LEVELS[i]);
  ship = { x: L.ship[0], y: L.ship[1], vx: 0, vy: -1, t: 0, fuel: S.fuelFor(L) };
  $('hTime').textContent = '0.0';
  launchesLeft = L.L; collected = new Set(); clock = 0; started = false; braking = false;
  trail = []; parts = []; pops = []; aim = null; preview = []; tf = 1;
  state = 'aim'; show(null); $('hud').style.display = 'flex';
  $('hLevel').textContent = `${i + 1}. ${L.n}`;
  $('hTarget').textContent = L.t3 ? `3★ ≤ ${L.t3}с` : '';
  $('chipFuel').style.display = L.stops ? '' : 'none';
  hud();
  const h = $('hint'); h.innerHTML = '💡 ' + L.hint; h.style.display = 'block';
  $('hand').style.display = (i === 0 && !save.tut.aim) ? 'block' : 'none';
}
function hud() {
  $('hL').innerHTML = 'запуски ' + Array.from({ length: L.L }, (_, k) => `<i class="${k < launchesLeft ? '' : 'u'}"></i>`).join('');
  $('hB').textContent = collected.size;
  $('fuelF').style.width = (100 * ship.fuel / S.fuelFor(L)) + '%';
  $('chipFuel').classList.toggle('on', braking);
}
function show(id) { document.querySelectorAll('.scr').forEach(e => e.classList.remove('on')); if (id) $(id).classList.add('on'); }

// ---------- input ----------
function wpos(e) { return { x: (e.clientX - OX) / SC, y: (e.clientY - OY) / SC }; }
function aimVec() {
  const dx = aim.sx - aim.x, dy = aim.sy - aim.y, d = Math.hypot(dx, dy);
  const pull = Math.min(d, S.MAX_PULL); return { a: Math.atan2(dy, dx), p: pull, pct: Math.round(pull / S.MAX_PULL * 100) };
}
function launch(a, p) {
  const sp = S.launchSpeed(p); ship.vx = Math.cos(a) * sp; ship.vy = Math.sin(a) * sp;
  launchesLeft--; started = true; state = 'fly'; aim = null; preview = []; thrust = 0.35;
  for (let i = 0; i < 18; i++) spark(ship.x, ship.y, '#22d3ee', 60 + Math.random() * 90, a + Math.PI + (Math.random() - .5) * 1.2);
  $('hint').style.display = 'none'; $('hand').style.display = 'none';
  if (li === 0) { save.tut.aim = 1; persist(); }
  hud();
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (state === 'fly') { if (ship.fuel > 0 && L.stops) { braking = true; hud(); } return; }
  if (state !== 'aim') return;
  const p = wpos(e); aim = { sx: p.x, sy: p.y, x: p.x, y: p.y }; $('hand').style.display = 'none';
});
cv.addEventListener('pointermove', e => {
  if (state !== 'aim' || !aim) return; const p = wpos(e); aim.x = p.x; aim.y = p.y;
  const v = aimVec(); preview = v.p > 3 ? computePreview(v.a, v.p) : [];
});
const up = () => {
  if (state === 'fly') { braking = false; hud(); return; }
  if (state !== 'aim' || !aim) return;
  const v = aimVec(); if (v.p < 6) { aim = null; preview = []; return; }
  launch(v.a, v.p);
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

function computePreview(a, p) {
  const sp = S.launchSpeed(p); const o = { x: ship.x, y: ship.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: ship.t, fuel: 0 };
  const pts = [];
  for (let i = 0; i < 300; i++) { S.step(o, L, false); if (i % 5 === 0) pts.push([o.x, o.y]); if (S.status(o, L)) { pts.push([o.x, o.y]); break; } }
  return pts;
}

// ---------- effects ----------
function spark(x, y, col, sp, ang) {
  const a = ang ?? Math.random() * 6.28, s = sp ?? 40 + Math.random() * 120;
  parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 0.5 + Math.random() * 0.5, m: 1, c: col, r: 1 + Math.random() * 2 });
}
function burst(x, y, col, n) { for (let i = 0; i < n; i++) spark(x, y, col); }

// ---------- simulation tick ----------
function tick() {
  clock += S.STEP;
  const r = S.step(ship, L, braking && ship.fuel > 0);
  tf = r.tf;
  if (r.bounce) { shake = Math.min(12, shake + 7); burst(ship.x, ship.y, '#fbbf24', 10); }
  if (braking && ship.fuel <= 0) { braking = false; }
  const lt = trail[trail.length - 1];
  if (!lt || Math.hypot(ship.x - lt.x, ship.y - lt.y) > 2.5) { trail.push({ x: ship.x, y: ship.y, tf }); if (trail.length > 160) trail.shift(); }
  L.stars.forEach((s, k) => {
    if (!collected.has(k) && Math.hypot(ship.x - s[0], ship.y - s[1]) < 22) {
      collected.add(k); burst(s[0], s[1], '#fde047', 26); pops.push({ x: s[0], y: s[1], t: 0 });
      const b = $('bonus'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); hud();
    }
  });
  const st = S.status(ship, L);
  if (st === 'win') return win();
  if (st) return fail(st === 'swallowed' ? 'Шатл поглинула чорна діра!' : 'Шатл відлетів у відкритий космос.');
  if (braking && Math.hypot(ship.vx, ship.vy) < S.STOP_SPEED) {
    ship.vx = 0; ship.vy = 0; braking = false; burst(ship.x, ship.y, '#fb923c', 14);
    if (launchesLeft > 0) { state = 'aim'; const h = $('hint'); h.innerHTML = '🛑 Зупинка! Цілься знову — <b>ще ' + launchesLeft + '</b> запуск(и)'; h.style.display = 'block'; }
    else fail('Шатл зупинився, а запусків більше немає.');
    hud();
  }
}
function starsFor(t) { return !L.t3 ? 3 : t <= L.t3 ? 3 : t <= L.t2 ? 2 : 1; }
function win() {
  state = 'result'; burst(L.portal[0], L.portal[1], '#22d3ee', 50); $('hud').style.display = 'none'; $('hint').style.display = 'none';
  const t = clock, st = starsFor(t), timePts = Math.max(0, Math.round(((L.t2 || 20) - t) * 100)), bon = collected.size * 250, unused = launchesLeft * 300;
  const score = st * 1000 + timePts + bon + unused;
  const prev = save.best[li] || { s: 0, sc: 0 }; const isBest = score > prev.sc;
  save.best[li] = { s: Math.max(prev.s, st), sc: Math.max(prev.sc, score) };
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, li + 2)); persist();
  $('rTitle').textContent = st === 3 ? 'Ідеально!' : st === 2 ? 'Чудово!' : 'Портал досягнуто';
  $('rStars').innerHTML = [0, 1, 2].map(k => `<span class="${k < st ? '' : 'e'}">★</span>`).join('');
  $('rRows').innerHTML = `<div><span>⏱ Час ${t.toFixed(1)}с (3★ ≤ ${L.t3}с, 2★ ≤ ${L.t2}с)</span></div>
    <div><span>Зірки рейтингу ${st}×1000</span><b>${st * 1000}</b></div><div><span>Бонус за час</span><b>${timePts}</b></div>
    <div><span>Бонусні зірки ${collected.size}×250</span><b>${bon}</b></div><div><span>Невикористані запуски ${launchesLeft}×300</span><b>${unused}</b></div>`;
  $('rScore').textContent = score; $('rBest').textContent = isBest ? '🏆 Новий рекорд!' : `Рекорд: ${save.best[li].sc}`;
  $('bNext').style.display = li + 1 < LEVELS.length ? '' : 'none';
  setTimeout(() => { if (state === 'result') show('result'); }, 450);
}
function fail(msg) {
  state = 'fail'; burst(ship.x, ship.y, '#ef4444', 40); shake = 14; $('hud').style.display = 'none'; $('hint').style.display = 'none';
  $('fText').textContent = msg; setTimeout(() => { if (state === 'fail') show('fail'); }, 500);
}

// ---------- drawing ----------
function glowCircle(x, y, r, col, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
function drawHole(h, t) {
  const x = X(h[0]), y = Y(h[1]), r = R(h[3]);
  // lensing: magnified, mirrored sky inside an Einstein ring
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, 7); ctx.clip();
  ctx.translate(x, y); ctx.rotate(Math.PI); ctx.scale(1.35, 1.35); ctx.translate(-x, -y); ctx.globalAlpha = 0.9;
  ctx.drawImage(bg, 0, 0, W, H); layers.forEach(Lr => ctx.drawImage(Lr, -40, -40, W + 80, H + 80));
  ctx.restore();
  const dk = ctx.createRadialGradient(x, y, r, x, y, r * 3.4); dk.addColorStop(0, 'rgba(0,0,0,.85)'); dk.addColorStop(.35, 'rgba(20,0,40,.35)'); dk.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = dk; ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, 7); ctx.fill();
  // gravity ripples
  for (let i = 0; i < 3; i++) { const ph = (t * 0.45 + i / 3) % 1; ctx.strokeStyle = `rgba(196,181,253,${0.28 * ph})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * (7 - ph * 6), 0, 7); ctx.stroke(); }
  // back half of disk
  const disk = (front) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.ellipse(0, 0, r * (2.6 - k * .3), r * (0.62 - k * .07), 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      ctx.strokeStyle = ['rgba(251,146,60,.55)', 'rgba(253,224,71,.7)', 'rgba(255,247,237,.85)', 'rgba(244,114,182,.5)'][k];
      ctx.lineWidth = R(3.2 - k * 0.6); ctx.shadowColor = '#f97316'; ctx.shadowBlur = 14; ctx.stroke();
    }
    // orbiting hot clumps
    for (let k = 0; k < 6; k++) { const a = t * (2.4 + k * .2) + k; const s = Math.sin(a); if ((s > 0) !== front) continue; ctx.fillStyle = 'rgba(255,237,213,.9)'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 2.2, s * r * .52, R(1.6), 0, 7); ctx.fill(); }
    ctx.restore();
  };
  disk(false);
  ctx.save(); ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 30; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,237,213,.9)'; ctx.lineWidth = R(1.4); ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(253,186,116,.45)'; ctx.lineWidth = R(3); ctx.beginPath(); ctx.ellipse(x, y - r * .1, r * 1.25, r * 1.32, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  disk(true);
}
const PLANET_COLS = [['#60a5fa', '#1e3a8a'], ['#f472b6', '#831843'], ['#34d399', '#064e3b'], ['#fbbf24', '#78350f'], ['#a78bfa', '#3b0764'], ['#fb7185', '#7f1d1d']];
function drawPlanet(p, i) {
  const x = X(p[0]), y = Y(p[1]), r = R(p[2]); const [c1, c2] = PLANET_COLS[(Math.round(p[0] + p[1]) + i) % PLANET_COLS.length];
  glowCircle(x, y, r * 1.5, 'rgba(147,197,253,A)', .25);
  const g = ctx.createRadialGradient(x - r * .4, y - r * .4, r * .1, x, y, r); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip(); ctx.globalAlpha = .18; ctx.fillStyle = '#fff';
  for (let k = -2; k <= 2; k++) ctx.fillRect(x - r, y + k * r * .35, r * 2, r * .1); ctx.globalAlpha = 1;
  const sh = ctx.createRadialGradient(x + r * .5, y + r * .5, 0, x + r * .3, y + r * .3, r * 1.3); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  if (p[2] > 45) { ctx.strokeStyle = 'rgba(253,230,138,.45)'; ctx.lineWidth = R(3); ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * .35, -0.3, 0, 7); ctx.stroke(); }
}
function drawMoon(m, t) {
  ctx.strokeStyle = 'rgba(203,213,225,.12)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(X(m[0]), Y(m[1]), R(m[2]), 0, 7); ctx.stroke(); ctx.setLineDash([]);
  const [mx, my] = S.moonPos(m, t); const x = X(mx), y = Y(my), r = R(m[3]);
  const g = ctx.createRadialGradient(x - r * .4, y - r * .4, 0, x, y, r); g.addColorStop(0, '#f1f5f9'); g.addColorStop(1, '#475569');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(51,65,85,.6)'; [[.3, -.2, .25], [-.35, .3, .18], [.1, .45, .14]].forEach(c => { ctx.beginPath(); ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, 7); ctx.fill(); });
}
function drawAsteroid(a, i) {
  ctx.save(); ctx.translate(X(a[0]), Y(a[1])); ctx.rotate(a[4]);
  const w = R(a[2]), h = R(a[3]); const r = rng(i * 97 + 13);
  ctx.beginPath(); const n = Math.max(8, Math.round(a[2] / 10));
  for (let k = 0; k <= n; k++) ctx.lineTo(-w / 2 + w * k / n, -h / 2 - r() * h * .25);
  for (let k = n; k >= 0; k--) ctx.lineTo(-w / 2 + w * k / n, h / 2 + r() * h * .25);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, 0, h); g.addColorStop(0, '#a8a29e'); g.addColorStop(.5, '#57534e'); g.addColorStop(1, '#292524');
  ctx.fillStyle = g; ctx.shadowColor = 'rgba(251,146,60,.35)'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(253,186,116,.5)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(28,25,23,.6)'; for (let k = 0; k < n / 2; k++) { ctx.beginPath(); ctx.arc(-w / 2 + r() * w, (r() - .5) * h * .6, R(1.5 + r() * 2), 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawStation(s, t) {
  const x = X(s[0]), y = Y(s[1]);
  for (let i = 0; i < 2; i++) { const ph = (t * .6 + i / 2) % 1; ctx.strokeStyle = `rgba(94,234,212,${.3 * (1 - ph)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, R(20 + ph * 60), 0, 7); ctx.stroke(); }
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * .5);
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = R(4); ctx.beginPath(); ctx.arc(0, 0, R(22), 0, 7); ctx.stroke();
  ctx.lineWidth = R(2); for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(R(8), 0); ctx.lineTo(R(22), 0); ctx.stroke(); ctx.fillStyle = k % 2 ? '#22d3ee' : '#f43f5e'; ctx.beginPath(); ctx.arc(R(22), 0, R(2.2), 0, 7); ctx.fill(); }
  ctx.fillStyle = '#1e40af'; ctx.fillRect(-R(26), -R(3), R(8), R(6)); ctx.fillRect(R(18), -R(3), R(8), R(6));
  ctx.restore(); glowCircle(x, y, R(14), 'rgba(94,234,212,A)', .7);
  ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(x, y, R(8), 0, 7); ctx.fill();
}
function drawWind(w, t) {
  const x = X(w[0]), y = Y(w[1]), ww = R(w[2]), hh = R(w[3]);
  const g = ctx.createLinearGradient(x, 0, x + ww, 0); g.addColorStop(0, 'rgba(250,204,21,.04)'); g.addColorStop(.5, 'rgba(250,204,21,.09)'); g.addColorStop(1, 'rgba(250,204,21,.04)');
  ctx.fillStyle = g; ctx.fillRect(x, y, ww, hh);
  ctx.strokeStyle = 'rgba(250,204,21,.18)'; ctx.setLineDash([6, 6]); ctx.strokeRect(x, y, ww, hh); ctx.setLineDash([]);
  const r = rng(Math.round(w[1]) + 3); const dir = Math.sign(w[4]) || 1;
  for (let k = 0; k < 34; k++) {
    const sp = .25 + r() * .35, px = ((r() + t * sp * dir) % 1 + 1) % 1, py = r();
    const xx = x + px * ww, yy = y + py * hh; ctx.strokeStyle = `rgba(253,224,71,${.25 + r() * .45})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - dir * R(10 + r() * 10), yy); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(253,224,71,.55)'; ctx.font = `bold ${R(14)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(dir > 0 ? '➜ ➜ ➜' : '⬅ ⬅ ⬅', x + ww / 2, y + hh / 2 + R(5)); ctx.textAlign = 'left';
}
function drawMagnet(m, t) {
  const x = X(m[0]), y = Y(m[1]);
  ctx.strokeStyle = 'rgba(248,113,113,.22)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(x, y, R(m[3]), 0, 7); ctx.stroke(); ctx.setLineDash([]);
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * 6.28; ctx.strokeStyle = 'rgba(248,113,113,.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); for (let s = 0; s <= 1; s += .1) { const rr = R(m[3]) * (1 - s * .85), aa = a + s * 0.9; s ? ctx.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr) : ctx.moveTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); } ctx.stroke();
    const s = 1 - ((t * .7 + k / 10) % 1), rr = R(m[3]) * (1 - s * .85), aa = a + s * .9;
    ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.arc(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr, R(2), 0, 7); ctx.fill();
  }
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = R(7); ctx.lineCap = 'butt';
  ctx.strokeStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, R(2), R(11), 0, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-R(11), R(2)); ctx.lineTo(-R(11), -R(8)); ctx.moveTo(R(11), R(2)); ctx.lineTo(R(11), -R(8)); ctx.stroke();
  ctx.strokeStyle = '#e5e7eb'; ctx.beginPath(); ctx.moveTo(-R(11), -R(8)); ctx.lineTo(-R(11), -R(14)); ctx.moveTo(R(11), -R(8)); ctx.lineTo(R(11), -R(14)); ctx.stroke();
  ctx.restore();
}
function drawPortal(t) {
  const x = X(L.portal[0]), y = Y(L.portal[1]), r = R(22);
  glowCircle(x, y, r * 2.4, 'rgba(34,211,238,A)', .35);
  ctx.save(); ctx.translate(x, y);
  for (let k = 0; k < 5; k++) { ctx.rotate(t * (0.8 + k * .3)); ctx.strokeStyle = `rgba(${k % 2 ? '165,243,252' : '34,211,238'},${.8 - k * .12})`; ctx.lineWidth = R(2.4); ctx.beginPath(); ctx.arc(0, 0, r * (1 - k * .16), k, k + 4.2); ctx.stroke(); }
  ctx.restore(); glowCircle(x, y, r * .6, 'rgba(236,254,255,A)', .95);
}
function drawStar(s, k, t) {
  if (collected.has(k)) return;
  const x = X(s[0]), y = Y(s[1]), p = 1 + Math.sin(t * 4 + k) * .18;
  glowCircle(x, y, R(24) * p, 'rgba(253,224,71,A)', .45);
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * .9 + k); ctx.scale(p, p);
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = R(i % 2 ? 5 : 12), a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
  ctx.fillStyle = '#fde047'; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 16; ctx.fill(); ctx.strokeStyle = '#fff7cc'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
}
function drawShuttle(t) {
  const x = X(ship.x), y = Y(ship.y);
  let ang = state === 'fly' && Math.hypot(ship.vx, ship.vy) > 2 ? Math.atan2(ship.vy, ship.vx) : aim ? aimVec().a : ship.ang ?? -Math.PI / 2;
  ship.ang = ang;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); const k = R(1);
  // flame
  const fl = state === 'fly' && !braking ? 0.6 + thrust * 2 : state === 'aim' ? 0.25 : 0;
  if (fl > 0) {
    const len = (14 + Math.random() * 6) * fl * k;
    const g = ctx.createLinearGradient(-8 * k, 0, -8 * k - len, 0); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.3, 'rgba(56,189,248,.9)'); g.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-8 * k, -3.5 * k); ctx.quadraticCurveTo(-8 * k - len, 0, -8 * k, 3.5 * k); ctx.fill();
  }
  if (braking) { ctx.fillStyle = 'rgba(251,146,60,.85)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(9 * k, s * 3 * k); ctx.lineTo((16 + Math.random() * 6) * k, s * (6 + Math.random() * 3) * k); ctx.lineTo(9 * k, s * 5 * k); ctx.fill(); } }
  ctx.shadowColor = '#a5b4fc'; ctx.shadowBlur = 12;
  // wings
  ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.moveTo(1 * k, 0); ctx.lineTo(-7 * k, 10 * k); ctx.lineTo(-9 * k, 10 * k); ctx.lineTo(-6 * k, 0); ctx.lineTo(-9 * k, -10 * k); ctx.lineTo(-7 * k, -10 * k); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f43f5e'; ctx.fillRect(-9 * k, 8.5 * k, 3 * k, 1.5 * k); ctx.fillRect(-9 * k, -10 * k, 3 * k, 1.5 * k);
  // body
  const g = ctx.createLinearGradient(0, -5 * k, 0, 5 * k); g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#cbd5e1'); g.addColorStop(1, '#64748b');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(13 * k, 0); ctx.quadraticCurveTo(8 * k, -5 * k, -8 * k, -4.5 * k); ctx.lineTo(-9 * k, 4.5 * k); ctx.quadraticCurveTo(8 * k, 5 * k, 13 * k, 0); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#7c3aed'; ctx.fillRect(-6 * k, -1 * k, 12 * k, 2 * k);
  ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.ellipse(6 * k, 0, 3.2 * k, 2.2 * k, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(6.8 * k, -.8 * k, 1.2 * k, .7 * k, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function drawTrail() {
  for (let i = 1; i < trail.length; i++) {
    const a = i / trail.length, p = trail[i - 1], q = trail[i], hue = 265 - (1 - q.tf) * 90;
    ctx.strokeStyle = `hsla(${hue},95%,${62 + (1 - q.tf) * 18}%,${a * .9})`; ctx.lineWidth = R(1 + a * 3 + (1 - q.tf) * 4);
    ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y)); ctx.lineTo(X(q.x), Y(q.y)); ctx.stroke();
  }
}
function drawAim() {
  if (state !== 'aim') return;
  const x = X(ship.x), y = Y(ship.y);
  if (!aim) { const p = (Math.sin(animT * 4) + 1) / 2; ctx.strokeStyle = `rgba(34,211,238,${.3 + p * .4})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R(18 + p * 6), 0, 7); ctx.stroke(); return; }
  const v = aimVec();
  preview.forEach((p, i) => { const a = 1 - i / preview.length; ctx.fillStyle = `rgba(196,181,253,${.85 * a})`; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), R(1.2 + 2 * a), 0, 7); ctx.fill(); });
  const bx = ship.x - Math.cos(v.a) * v.p, by = ship.y - Math.sin(v.a) * v.p;
  ctx.strokeStyle = 'rgba(233,213,255,.75)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(X(bx), Y(by)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#e9d5ff'; ctx.beginPath(); ctx.arc(X(bx), Y(by), R(5), 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(X(aim.sx), Y(aim.sy), R(10), 0, 7); ctx.stroke();
  const col = v.pct > 85 ? '#f43f5e' : v.pct > 50 ? '#fbbf24' : '#34d399';
  ctx.strokeStyle = col; ctx.lineWidth = R(3); ctx.beginPath(); ctx.arc(x, y, R(26), -Math.PI / 2, -Math.PI / 2 + v.pct / 100 * 6.283); ctx.stroke();
  ctx.fillStyle = col; ctx.font = `bold ${R(15)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(v.pct + '%', x, y + R(46));
  ctx.font = `${R(10)}px sans-serif`; ctx.fillStyle = '#c4b5fd'; ctx.fillText(Math.round((-v.a * 180 / Math.PI + 360) % 360) + '°', x, y + R(58)); ctx.textAlign = 'left';
}
function drawFX(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.l -= dt; if (p.l <= 0) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97;
    ctx.globalAlpha = Math.min(1, p.l * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), R(p.r), 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; if (p.t > 1) { pops.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - p.t; ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), R(8 + p.t * 46), 0, 7); ctx.stroke();
    ctx.fillStyle = '#fde047'; ctx.font = `bold ${R(18)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('+250 ★', X(p.x), Y(p.y - 14 - p.t * 36)); ctx.textAlign = 'left'; }
  ctx.globalAlpha = 1;
}
function drawSlowmo() {
  if (state !== 'fly' || tf > 0.85) return;
  const k = (0.85 - tf) / 0.73;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
  g.addColorStop(0, 'rgba(99,102,241,0)'); g.addColorStop(1, `rgba(124,58,237,${.5 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(221,214,254,${.4 + .6 * k})`; ctx.font = `bold ${R(14)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(`⏳ час ×${tf.toFixed(2)}`, W / 2, Y(625)); ctx.textAlign = 'left';
}

// ---------- loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; animT += dt;
  if (L && state === 'fly') {
    acc += dt; while (acc >= S.STEP && state === 'fly') { tick(); acc -= S.STEP; }
    thrust = Math.max(0, thrust - dt);
    if (Math.random() < 0.6 && !braking) spark(ship.x, ship.y, 'rgba(56,189,248,.8)', 20 + Math.random() * 30, Math.atan2(-ship.vy, -ship.vx) + (Math.random() - .5) * .5);
    hud();
  } else acc = 0;
  if (L && started && state === 'aim') clock += dt;
  if (L && started) $('hTime').textContent = clock.toFixed(1);
  if (ship) { camX += (((ship.x - 180) / 180) - camX) * .05; camY += (((ship.y - 320) / 320) - camY) * .05; }
  shake *= Math.pow(0.02, dt);
  ctx.save(); if (shake > .3) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  drawBG(animT);
  if (L && state !== 'menu') {
    const t = ship.t;
    L.winds.forEach(w => drawWind(w, animT)); L.magnets.forEach(m => drawMagnet(m, animT));
    L.planets.forEach(drawPlanet); L.asteroids.forEach(drawAsteroid); L.stations.forEach(s => drawStation(s, animT));
    L.moons.forEach(m => drawMoon(m, t)); L.holes.forEach(h => drawHole(h, animT));
    drawPortal(animT); L.stars.forEach((s, k) => drawStar(s, k, animT));
    drawTrail(); drawAim(); if (state !== 'fail') drawShuttle(animT); drawFX(dt); drawSlowmo();
  } else {
    // menu scene
    drawHole([180, 250, 1, 34], animT);
    const fake = { x: 180 + Math.cos(animT * .7) * 120, y: 250 + Math.sin(animT * .7) * 50 };
    if (!ship) { ship = { x: 0, y: 0, vx: 0, vy: 0, t: 0, fuel: 0 }; }
    ship.x = fake.x; ship.y = fake.y; ship.vx = -Math.sin(animT * .7) * 84; ship.vy = Math.cos(animT * .7) * 35; const ps = state; state = 'fly'; drawShuttle(animT); state = ps;
  }
  ctx.restore();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- menus ----------
function sectorStars(s) { let n = 0; for (let i = s * 10; i < s * 10 + 10; i++) n += (save.best[i] || {}).s || 0; return n; }
function totalStars() { let n = 0; for (const k in save.best) n += save.best[k].s; return n; }
function buildSectors() {
  $('secList').innerHTML = ''; SECTORS.forEach((s, i) => {
    const d = document.createElement('div'); const lock = save.unlocked < i * 10 + 1;
    d.className = 'sector' + (lock ? ' lock' : ''); d.style.borderColor = s.c;
    d.innerHTML = `<b>${lock ? '🔒 ' : ''}Сектор ${i + 1}: ${s.n}</b><small>${s.d}</small><div style="margin-top:6px;color:#fde047">★ ${sectorStars(i)}/30</div>`;
    d.onclick = () => { if (!lock) { curSector = i; buildLevels(); show('levels'); } }; $('secList').appendChild(d);
  });
}
function buildLevels() {
  $('secTitle').textContent = `Сектор ${curSector + 1}: ${SECTORS[curSector].n}`; $('grid').innerHTML = '';
  for (let i = curSector * 10; i < curSector * 10 + 10 && i < LEVELS.length; i++) {
    const b = document.createElement('button'); const lock = i + 1 > save.unlocked; const st = (save.best[i] || {}).s || 0;
    b.className = 'lv' + (lock ? ' lock' : ''); b.innerHTML = `${lock ? '🔒' : i + 1}<span>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`;
    b.onclick = () => { if (!lock) startLevel(i); }; $('grid').appendChild(b);
  }
}
function toMenu() { state = 'menu'; L = null; ship = null; $('hud').style.display = 'none'; $('hint').style.display = 'none'; $('hand').style.display = 'none'; $('totalStars').textContent = `★ ${totalStars()}/90 · відкрито рівнів: ${save.unlocked}/${LEVELS.length}`; show('menu'); }
$('bPlay').onclick = () => startLevel(Math.min(save.unlocked, LEVELS.length) - 1);
$('bSectors').onclick = () => { buildSectors(); show('sectors'); };
$('bBack1').onclick = toMenu; $('bBack2').onclick = () => { buildSectors(); show('sectors'); };
$('bRestart').onclick = () => startLevel(li); $('bMenu').onclick = toMenu;
$('bNext').onclick = () => startLevel(li + 1); $('bRetry').onclick = $('bRetry2').onclick = () => startLevel(li);
$('bLv').onclick = $('bLv2').onclick = () => { curSector = Math.floor(li / 10); buildLevels(); show('levels'); };
toMenu();

window.BH = { advance(n, brake) { braking = !!brake && ship.fuel > 0; for (let i = 0; i < n && state === 'fly'; i++) tick(); }, get launchesLeft() { return launchesLeft; }, LEVELS, startLevel, launch: (a, p) => launch(a, p), setBrake: b => { braking = b && ship.fuel > 0; }, get state() { return state; }, get ship() { return ship; }, get clock() { return clock; }, toMenu };
})();
