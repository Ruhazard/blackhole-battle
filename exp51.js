/* Blackhole Battle v3.4.1 — Level 51 "Expedition" (prototype mode).
   Separate from levels 1–50: own simulation (sim51.js), own WebGL renderer (gl51.js), this file = mode UI/camera/controls/FX.
   Controls: slingshot launch while docked; left side = floating joystick (wanted nose heading, RCS turns the ship),
   right edge = throttle lever (stays where you leave it); ⇄ magnet polarity; ↺ back to checkpoint; ⏸ pause. */
window.BHExp = (() => {
  'use strict';
  const S51 = window.BHSim51, GL = window.BHGl51, K = S51.K, TAU = Math.PI * 2, $ = id => document.getElementById(id);
  const TX = {
    uk: { name: 'Експедиція', tag: 'Прототип · рівень 51', card: 'Довга подорож: керування одним пальцем, гальмо, паливо, ворота', fuel: 'Паливо', hull: 'Корпус', cp: 'Ворота', spd: 'шв.',
      launch: 'Потягни назад, щоб стартувати (як рогатка)', launchD: 'Потягни туди, куди летіти, і відпусти',
      t0: '👆 Тягни пальцем будь-де: ніс розвертається туди, а що далі тягнеш — то сильніша тяга. Відпустив — летиш за інерцією.',
      t1: '⏹ Тримай ГАЛЬМО — корабель сам скине швидкість (подвійний дотик — повна зупинка). Попереду астероїди: удар швидше ~55 б’є корпус.',
      t0c: '🕹 Ліворуч — джойстик: куди показуєш, туди розвертається ніс. Праворуч — важіль тяги: підніми, щоб розганятися. Корабель важкий — гальмуй заздалегідь, розвернувши ніс назад.',
      t2: '🌍 Гравітаційний маневр: пройди повз чорну діру — вона закрутить тебе вгору. Не зачепи місяці планети!',
      t3: '🧲 Бар’єри пропускають лише свій колір. Тисни ⇄, щоб змінити полярність. ☀ Спалах — дочекайся, поки згасне.',
      t4: '🌀 Кротова нора закине тебе на верхній ряд.',
      t5: '🕳 Велика чорна діра: використай її тяжіння, але тримайся подалі від диска.',
      t6: '🚪 Останній коридор астероїдів, далі портал. Заходь повільно (швидкість < 150).',
      d_hull: 'Корпус зруйновано', d_planet: 'Удар об планету', d_moon: 'Зіткнення з місяцем', d_hole: 'Горизонт подій', d_flare: 'Згорів у спалаху',
      respawn: 'Повернення до воріт…', gate: 'Ворота {n}/{m}', fuelUp: '+паливо', empty: 'Паливо скінчилося — лишилися тільки слабкі маневрові двигуни', fast: 'Занадто швидко для порталу!',
      win: 'Експедицію завершено!', time: 'Час', deaths: 'Втрати', left: 'Паливо в баку', best: 'Рекорд', again: '↻ Ще раз', menu: '☰ Меню', resume: '▶ Далі', restart: '↻ Спочатку', paused: 'Пауза',
      open: 'Тестова збірка 3.4.1: усі рівні 1–51 відкриті', brk: 'ГАЛЬМО', ctl: '🎮 Керування (рівень 51)', ctlF: 'Один палець', ctlC: 'Класичне', ctlNote: 'Один палець: тягни будь-де + кнопка ГАЛЬМО. Класичне: джойстик ліворуч + важіль тяги праворуч.' },
    en: { name: 'Expedition', tag: 'Prototype · level 51', card: 'A long journey: one-finger flight, brake, fuel, gates', fuel: 'Fuel', hull: 'Hull', cp: 'Gates', spd: 'spd',
      launch: 'Pull back to launch (slingshot)', launchD: 'Drag where you want to fly and release',
      t0: '👆 Drag anywhere: the nose turns that way, and the further you drag, the harder it thrusts. Let go to coast.',
      t1: '⏹ Hold BRAKE and the ship kills its speed by itself (double-tap = full stop). Asteroids ahead: hits faster than ~55 damage the hull.',
      t0c: '🕹 Left side is the joystick: the nose turns where you point. Right side is the throttle lever: push it up to accelerate. The ship is heavy, so brake early by turning the nose backwards.',
      t2: '🌍 Gravity assist: skim past the black hole and let it swing you upwards. Avoid the planet’s moons!',
      t3: '🧲 Barriers only let their own colour through. Tap ⇄ to switch polarity. ☀ Flare: wait for it to die down.',
      t4: '🌀 The wormhole throws you up to the top row.',
      t5: '🕳 Giant black hole: use its pull, but keep clear of the disk.',
      t6: '🚪 Last asteroid corridor, then the portal. Enter slowly (speed < 150).',
      d_hull: 'Hull destroyed', d_planet: 'Crashed into the planet', d_moon: 'Hit a moon', d_hole: 'Crossed the event horizon', d_flare: 'Burned in a flare',
      respawn: 'Back to the gate…', gate: 'Gate {n}/{m}', fuelUp: '+fuel', empty: 'Out of fuel: only weak thrusters left', fast: 'Too fast for the portal!',
      win: 'Expedition complete!', time: 'Time', deaths: 'Losses', left: 'Fuel left', best: 'Best', again: '↻ Again', menu: '☰ Menu', resume: '▶ Resume', restart: '↻ Restart', paused: 'Paused',
      open: 'Test build 3.4.1: all levels 1–51 unlocked', brk: 'BRAKE', ctl: '🎮 Controls (level 51)', ctlF: 'One finger', ctlC: 'Classic', ctlNote: 'One finger: drag anywhere + BRAKE button. Classic: joystick on the left + throttle lever on the right.' },
    es: { name: 'Expedición', tag: 'Prototipo · nivel 51', card: 'Un largo viaje: control con un dedo, freno, combustible, puertas', fuel: 'Combustible', hull: 'Casco', cp: 'Puertas', spd: 'vel.',
      launch: 'Tira hacia atrás para despegar (tirachinas)', launchD: 'Arrastra hacia donde quieres volar y suelta',
      t0: '👆 Arrastra en cualquier sitio: el morro gira hacia allí y, cuanto más arrastras, más empuje. Suelta para planear.',
      t1: '⏹ Mantén FRENO y la nave frena sola (doble toque = parada total). Asteroides delante: los golpes a más de ~55 dañan el casco.',
      t0c: '🕹 A la izquierda, el joystick: el morro gira hacia donde apuntas. A la derecha, la palanca de empuje: súbela para acelerar. La nave es pesada: frena con tiempo girando el morro hacia atrás.',
      t2: '🌍 Asistencia gravitatoria: pasa rozando el agujero negro y deja que te lance hacia arriba. ¡Evita las lunas!',
      t3: '🧲 Las barreras solo dejan pasar su propio color. Toca ⇄ para cambiar la polaridad. ☀ Erupción: espera a que se apague.',
      t4: '🌀 El agujero de gusano te lanza a la fila superior.',
      t5: '🕳 Agujero negro gigante: aprovecha su atracción, pero no te acerques al disco.',
      t6: '🚪 Último pasillo de asteroides y luego el portal. Entra despacio (velocidad < 150).',
      d_hull: 'Casco destruido', d_planet: 'Choque con el planeta', d_moon: 'Choque con una luna', d_hole: 'Cruzaste el horizonte de sucesos', d_flare: 'Ardió en una erupción',
      respawn: 'Volviendo a la puerta…', gate: 'Puerta {n}/{m}', fuelUp: '+combustible', empty: 'Sin combustible: solo quedan los propulsores débiles', fast: '¡Demasiado rápido para el portal!',
      win: '¡Expedición completada!', time: 'Tiempo', deaths: 'Pérdidas', left: 'Combustible restante', best: 'Récord', again: '↻ Otra vez', menu: '☰ Menú', resume: '▶ Seguir', restart: '↻ Reiniciar', paused: 'Pausa',
      open: 'Versión de prueba 3.4.1: todos los niveles 1–51 desbloqueados', brk: 'FRENO', ctl: '🎮 Controles (nivel 51)', ctlF: 'Un dedo', ctlC: 'Clásico', ctlNote: 'Un dedo: arrastra en cualquier sitio + botón FRENO. Clásico: joystick a la izquierda + palanca de empuje a la derecha.' } };
  const FACT = { n: 51, src: 'NASA Science — Voyager: Planetary Voyage', url: 'https://science.nasa.gov/mission/voyager/planetary-voyage/',
    uk: ['Гравітаційний маневр', 'Voyager 2 стартував у 1977 році й пролетів повз Юпітер, Сатурн та Уран. Кожна планета викривляла його траєкторію й додавала швидкості. Завдяки цим «гравітаційним маневрам» політ до Нептуна тривав 12 років замість 30. Таке розташування планет трапляється приблизно раз на 175 років.'],
    en: ['Gravity assist', 'Voyager 2 launched in 1977 and flew past Jupiter, Saturn and Uranus. Each flyby bent its path and added speed. These “gravity assists” cut the trip to Neptune from 30 years to 12. The planetary alignment that made this possible occurs about once every 175 years.'],
    es: ['Asistencia gravitatoria', 'La Voyager 2 despegó en 1977 y pasó junto a Júpiter, Saturno y Urano. Cada sobrevuelo curvó su trayectoria y le dio más velocidad. Estas «asistencias gravitatorias» redujeron el viaje a Neptuno de 30 a 12 años. Esa alineación de los planetas se repite aproximadamente cada 175 años.'] };
  if (window.BH_FACTS) window.BH_FACTS['expedition-01'] = FACT;
  const lang = () => { const l = window.I18N && I18N.lang; return TX[l] ? l : 'en'; };
  const tx = (k, v) => { let s = TX[lang()][k] ?? TX.en[k] ?? k; if (v) for (const q in v) s = s.split('{' + q + '}').join(v[q]); return s; };
  const BH = () => window.BH, AU = () => window.BHAudio || null, SV = () => BH().save;
  const kind = () => (SV().set && SV().set.ship) || 'shuttle';
  const vib = ms => { try { if (SV().set.vib !== false && navigator.vibrate) navigator.vibrate(ms); } catch (e) { } };
  const au = (f, ...a) => { try { const A = AU(); if (A && A[f]) A[f](...a); } catch (e) { } };

  // ------------------------------------------------------------------ state
  let root = null, glc, cv, ctx, glOK = false, active = false, paused = false, frozen = false, raf = 0, lastT = 0, acc = 0, rt = 0;
  let M = null, s = null, bodies = [], moonB = [], deadT = 0, auto = null, autoOn = false, tipShown = {}, tipT = 0, toastT = 0, winShown = false;
  let W = 360, H = 640, DPR = 1, gdpr = 1, q = 2, camX = 0, camY = 0, viewW = 430, S = 1;
  const inp = { head: null, turn: 0, thr: 0, flip: false, dir: null, k: 0, brake: false }, keys = {};
  let fin = null, brkHeld = false, brkLatch = false, brkDownT = -9, tipLo = false;
  const classic = () => { try { return SV().set.l51ctl === 'classic'; } catch (e) { return false; } };
  let joy = null, lever = null, aim = null, thrSet = 0, holdHead = null;
  let parts = []; const PMAX = 520;
  const perf = { n: 0, dts: [], rms: [], drawn: 0 };
  let mini = null;

  // ------------------------------------------------------------------ DOM
  const CSS = `#exp{position:fixed;inset:0;z-index:60;display:none;background:#01010a;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#exp.on{display:block}#exp canvas{position:absolute;left:0;top:0;width:100%;height:100%}
#xHud{position:absolute;left:0;top:0;padding:calc(env(safe-area-inset-top) + 8px) 0 0 10px;display:flex;flex-wrap:wrap;gap:6px 10px;max-width:calc(100% - 150px);pointer-events:none;color:#e2e8f0;font-size:12px;font-weight:600;text-shadow:0 1px 2px #000}
#xHud .xb{width:84px}#xHud .xb i{display:block;height:6px;margin-top:3px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}#xHud .xb i b{display:block;height:100%;width:100%;border-radius:3px;transition:width .15s}
#xHud .xv{min-width:54px}#xHud .xv u{display:block;text-decoration:none;font-size:15px;color:#fff;font-variant-numeric:tabular-nums}
.xbtn{position:absolute;width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(15,23,42,.55);color:#fff;font-size:20px;line-height:44px;text-align:center;padding:0;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);touch-action:none}
.xbtn:active{transform:scale(.93)}#xPause{left:10px;top:calc(env(safe-area-inset-top) + 100px);width:50px;height:50px;line-height:48px}#xRe{left:68px;top:calc(env(safe-area-inset-top) + 100px);width:50px;height:50px;line-height:48px;font-size:24px}
#xPol{right:30px;bottom:calc(env(safe-area-inset-bottom) + 130px);width:62px;height:62px;line-height:60px;font-size:26px}
#xBrk{right:14px;bottom:calc(env(safe-area-inset-bottom) + 18px);width:96px;height:96px;line-height:1.1;font-size:30px;background:rgba(127,29,29,.55);border:2px solid rgba(252,165,165,.6);display:flex;flex-direction:column;align-items:center;justify-content:center}
#xBrk span{font-size:11.5px;font-weight:800;letter-spacing:.04em;margin-top:2px}#xBrk.on{background:rgba(220,38,38,.8);border-color:#fecaca;box-shadow:0 0 22px rgba(248,113,113,.7)}#xBrk.latch{box-shadow:0 0 0 4px rgba(254,202,202,.55),0 0 22px rgba(248,113,113,.7)}
#exp.classic #xBrk{right:84px;width:80px;height:80px;font-size:24px}#exp.classic #xPol{right:96px;bottom:calc(env(safe-area-inset-bottom) + 112px);width:56px;height:56px;line-height:54px}
#xCtl{margin:10px 0 4px}#xCtl small{display:block;color:#c4b5fd;margin-bottom:4px}#xCtl button{padding:7px 12px;font-size:13px;background:rgba(255,255,255,.08)}#xCtl button.on{background:rgba(124,58,237,.75)}
#xTip{position:absolute;left:12px;right:12px;top:calc(env(safe-area-inset-top) + 160px);margin:0 auto;max-width:420px;padding:9px 12px;border-radius:14px;background:rgba(15,23,42,.72);border:1px solid rgba(167,139,250,.45);color:#e9e7ff;font-size:13.5px;line-height:1.35;pointer-events:none;opacity:0;transition:opacity .35s;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
#xTip.on{opacity:1}#xTip.lo{top:auto;bottom:calc(env(safe-area-inset-bottom) + 200px)}@media (orientation:landscape){#xTip.lo{bottom:calc(env(safe-area-inset-bottom) + 14px);right:130px;left:130px}}#xToast{position:absolute;left:0;right:0;top:38%;text-align:center;color:#fff;font-size:22px;font-weight:800;text-shadow:0 2px 12px #000,0 0 18px rgba(167,139,250,.8);pointer-events:none;opacity:0;transition:opacity .25s}#xToast.on{opacity:1}
.xp{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.62);padding:16px}.xp.on{display:flex}
.xcard{width:min(360px,94%);max-height:88%;overflow:auto;padding:18px 16px;border-radius:20px;background:linear-gradient(160deg,rgba(49,46,129,.85),rgba(15,23,42,.92));border:1px solid rgba(167,139,250,.5);color:#e2e8f0;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.xcard h2{margin:2px 0 10px;font-size:22px;color:#fff}.xcard .xs{display:flex;justify-content:space-around;margin:8px 0 12px}.xcard .xs b{display:block;font-size:20px;color:#fff}.xcard .xs small{color:#c4b5fd}
.xcard .xf{text-align:left;font-size:13px;line-height:1.4;padding:10px;border-radius:12px;background:rgba(255,255,255,.06);margin:6px 0 12px}.xcard .xf b{color:#fde68a}.xcard .xf a{color:#a5b4fc;font-size:11px}
.xcard button{margin:4px;padding:10px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.3);background:rgba(124,58,237,.55);color:#fff;font-size:15px;font-weight:700}
#xEntry{width:min(330px,94%);margin:10px auto 4px;padding:12px 14px;border-radius:18px;border:1px solid rgba(250,204,21,.6);background:linear-gradient(135deg,rgba(250,204,21,.18),rgba(124,58,237,.12));color:#fff;text-align:left;cursor:pointer;display:block;box-shadow:0 0 18px rgba(250,204,21,.18)}
#xEntry b{font-size:17px;display:block}#xEntry small{color:#fde68a;font-size:12px}#xEntry em{float:right;font-style:normal;font-size:11px;color:#fde68a;border:1px solid rgba(250,204,21,.6);border-radius:8px;padding:1px 6px}
.xTile{position:relative;border-color:rgba(250,204,21,.8)!important;background:linear-gradient(135deg,rgba(250,204,21,.25),rgba(124,58,237,.2))!important}
#xOpenNote{display:block;text-align:center;font-size:11px;color:#86efac;margin:4px auto 0}`;
  let cssDone = false; function css() { if (cssDone) return; cssDone = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  function build() {
    if (root) return; css();
    root = document.createElement('div'); root.id = 'exp';
    root.innerHTML = `<canvas id="xgl"></canvas><canvas id="xc"></canvas>
<div id="xHud"><div class="xb"><span id="xFuelL"></span> <span id="xFuelN"></span><i><b id="xFuel"></b></i></div><div class="xb"><span id="xHullL"></span> <span id="xHullN"></span><i><b id="xHull" style="background:#4ade80"></b></i></div>
<div class="xv"><span id="xCpL"></span><u id="xCp">0/6</u></div><div class="xv"><span>⏱</span><u id="xTime">0:00</u></div><div class="xv"><span id="xSpL"></span><u id="xSp">0</u></div></div>
<button class="xbtn" id="xPause" aria-label="pause">⏸</button><button class="xbtn" id="xRe" aria-label="respawn">↺</button><button class="xbtn" id="xPol" aria-label="polarity">⇄</button><button class="xbtn" id="xBrk" aria-label="brake"><b>⏹</b><span id="xBrkL"></span></button>
<div id="xTip"></div><div id="xToast"></div>
<div class="xp" id="xPP"><div class="xcard"><h2 id="xPT"></h2><button id="xRes"></button><button id="xRst"></button><button id="xExit"></button><div id="xCtl"><small id="xCtlL"></small><button data-c="finger" id="xCtlF"></button><button data-c="classic" id="xCtlC"></button></div></div></div>
<div class="xp" id="xWin"><div class="xcard"><h2 id="xWT"></h2><div class="xs"><div><b id="xWTime"></b><small id="xWTimeL"></small></div><div><b id="xWD"></b><small id="xWDL"></small></div><div><b id="xWF"></b><small id="xWFL"></small></div></div>
<div id="xWBest" style="color:#fde68a;margin-bottom:8px"></div><div class="xf" id="xWFact"></div><button id="xAgain"></button><button id="xWMenu"></button></div></div>`;
    document.body.appendChild(root); glc = $('xgl'); cv = $('xc'); ctx = cv.getContext('2d');
    glOK = !!(GL && !/[?&]nogl/.test(location.search) && GL.init(glc));
    const stop = e => { e.stopPropagation(); };
    for (const id of ['xPause', 'xRe', 'xPol']) { $(id).addEventListener('pointerdown', stop); }
    const B = $('xBrk'), bOff = e => { if (e && e.pointerId != null && B._pid != null && e.pointerId !== B._pid) return; B._pid = null; brkHeld = false; };
    B.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (!active || paused || !s || s.docked || !s.alive) return; try { B.setPointerCapture(e.pointerId); } catch (er) { }
      B._pid = e.pointerId; const tn = performance.now() / 1000; if (brkLatch) brkLatch = false; else if (tn - brkDownT < .4) brkLatch = true; brkDownT = tn; brkHeld = true; vib(12); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) B.addEventListener(ev, bOff); B.addEventListener('contextmenu', e => e.preventDefault());
    for (const b of root.querySelectorAll('#xCtl button')) b.onclick = () => setCtl(b.dataset.c);
    $('xPause').onclick = () => setPause(true); $('xRes').onclick = () => setPause(false); $('xRst').onclick = () => { setPause(false); start(); }; $('xExit').onclick = () => exit();
    $('xRe').onclick = () => { if (s && !s.won && !paused) { if (s.alive && !s.docked) { s.alive = false; s.cause = 'manual'; deadT = 1; } } };
    $('xPol').onclick = () => { inp.flip = true; };
    $('xAgain').onclick = () => start(); $('xWMenu').onclick = () => exit();
    cv.addEventListener('pointerdown', pDown); cv.addEventListener('pointermove', pMove); cv.addEventListener('pointerup', pUp); cv.addEventListener('pointercancel', pUp); cv.addEventListener('lostpointercapture', pUp);
    addEventListener('keydown', e => { if (!active) return; keys[e.code] = 1; if (e.code === 'Space') { inp.flip = true; e.preventDefault(); } if (e.code === 'KeyR') $('xRe').onclick(); if (e.code === 'Escape') setPause(!paused);
      if (s && s.docked && (e.code === 'Enter')) launchNow(s.ang, .45); });
    addEventListener('keyup', e => { keys[e.code] = 0; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && active && !s.won) setPause(true); });
  }
  function labels() {
    $('xFuelL').textContent = tx('fuel'); $('xHullL').textContent = tx('hull'); $('xCpL').textContent = tx('cp'); $('xSpL').textContent = tx('spd');
    $('xBrkL').textContent = tx('brk'); $('xCtlL').textContent = tx('ctl'); $('xCtlF').textContent = tx('ctlF'); $('xCtlC').textContent = tx('ctlC'); syncCtl(); $('xPT').textContent = tx('paused'); $('xRes').textContent = tx('resume'); $('xRst').textContent = tx('restart'); $('xExit').textContent = tx('menu');
    $('xAgain').textContent = tx('again'); $('xWMenu').textContent = tx('menu'); $('xWTimeL').textContent = tx('time'); $('xWDL').textContent = tx('deaths'); $('xWFL').textContent = tx('left');
  }
  function syncCtl() { const c = classic(); if (root) { root.classList.toggle('classic', c); for (const b of root.querySelectorAll('#xCtl button')) b.classList.toggle('on', (b.dataset.c === 'classic') === c); }
    for (const b of document.querySelectorAll('#xCtlSeg button')) b.classList.toggle('on', (b.dataset.c === 'classic') === c); }
  function setCtl(v) { try { SV().set.l51ctl = v === 'classic' ? 'classic' : 'finger'; BH().persist(); } catch (e) { } fin = joy = lever = null; thrSet = 0; excl = null; syncCtl(); }
  // inject the option into the main Settings screen (no game3/index edits needed)
  function settingsRow() { const a = document.getElementById('aimSeg'); if (!a || document.getElementById('xCtlSeg')) return; const host = a.closest('.set') || a.parentNode;
    const d = document.createElement('div'); d.className = 'set wrap'; d.id = 'xCtlRow'; d.innerHTML = '<span id="xCtlRowL"></span><div class="seg" id="xCtlSeg"><button data-c="finger"></button><button data-c="classic"></button></div><div class="small setnote" id="xCtlRowN"></div>';
    host.parentNode.insertBefore(d, host.nextSibling); for (const b of d.querySelectorAll('button')) b.onclick = () => { setCtl(b.dataset.c); try { BH().HAP && BH().HAP.tick(); } catch (e) { } }; ctlLabels(); }
  function ctlLabels() { const r = document.getElementById('xCtlRow'); if (!r) return; $('xCtlRowL').textContent = tx('ctl'); $('xCtlRowN').textContent = tx('ctlNote'); const bs = r.querySelectorAll('button'); bs[0].textContent = tx('ctlF'); bs[1].textContent = tx('ctlC'); syncCtl(); }
  function setPause(b) { if (!active || (s && s.won)) return; paused = !!b; $('xPP').classList.toggle('on', paused); if (paused) { joy = lever = aim = fin = null; brkHeld = brkLatch = false; au('drive', { on: false }); } else lastT = performance.now(); }
  function tip(k) { if (tipShown[k]) return; tipShown[k] = 1; const el = $('xTip'); el.textContent = tx(k); el.classList.remove('lo'); hudT = 0; el.classList.add('on'); tipT = k === 't0' || k === 't1' ? 9 : 6.5; }
  function toast(t, d) { const el = $('xToast'); el.textContent = t; el.classList.add('on'); toastT = d || 1.6; }

  // ------------------------------------------------------------------ input
  // default (3.4.1): ONE finger anywhere = floating stick measured from the touch-down point -> nose direction + thrust by drag length
  //                  (engine only fires within ~30deg of that direction, sim51 gate); BRAKE button (DOM, own pointer) = autopilot velocity kill.
  // classic (setting): left joystick (nose) + right throttle lever, as in 3.4.0. Brake button works in both.
  const JR = 58, LEV = () => ({ x: W - 40, y1: H - 40 - safeB(), h: Math.min(210, H * .3) });
  const FDEAD = 14, FMAX = () => Math.max(80, Math.min(130, Math.min(W, H) * .25));
  let safeBv = 0; const safeB = () => safeBv;
  function pDown(e) {
    if (!active || paused || !s || s.won) return; const x = e.clientX, y = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (er) { }
    if (s.docked && s.alive) { if (!aim) aim = { id: e.pointerId, x0: x, y0: y, x, y }; return; }
    if (!s.alive) return;
    if (!classic()) { if (!fin) { fin = { id: e.pointerId, bx: x, by: y, x, y }; if (brkLatch && !brkHeld) brkLatch = false; } return; }
    const L = LEV();
    if (x >= W * .62) { if (!lever) { lever = { id: e.pointerId, y0: y, v0: thrSet }; if (Math.abs(x - L.x) < 34 && y < L.y1 + 20 && y > L.y1 - L.h - 20) { thrSet = Math.max(0, Math.min(1, (L.y1 - y) / L.h)); lever.v0 = thrSet; } } return; }
    if (!joy) joy = { id: e.pointerId, bx: x, by: y, x, y };
  }
  function pMove(e) { const x = e.clientX, y = e.clientY;
    if (aim && aim.id === e.pointerId) { aim.x = x; aim.y = y; return; }
    if (fin && fin.id === e.pointerId) { fin.x = x; fin.y = y; const dx = x - fin.bx, dy = y - fin.by, d = Math.hypot(dx, dy), R = FMAX() * 1.15; if (d > R) { fin.bx = x - dx / d * R; fin.by = y - dy / d * R; } return; }
    if (lever && lever.id === e.pointerId) { const L = LEV(); thrSet = Math.max(0, Math.min(1, lever.v0 + (lever.y0 - y) / L.h)); return; }
    if (joy && joy.id === e.pointerId) { joy.x = x; joy.y = y; const dx = x - joy.bx, dy = y - joy.by, d = Math.hypot(dx, dy); if (d > JR * 1.5) { joy.bx = x - dx / d * JR * 1.5; joy.by = y - dy / d * JR * 1.5; } } }
  function pUp(e) {
    if (aim && aim.id === e.pointerId) { const a = aim; aim = null; if (!active || paused || !s || !s.docked) return; const dx = a.x - a.x0, dy = a.y - a.y0, d = Math.hypot(dx, dy); if (d < 14) return;
      const sling = (SV().set.aim || 'sling') !== 'direct', ang = sling ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx); launchNow(ang, Math.min(1, d / pullMax())); return; }
    if (fin && fin.id === e.pointerId) fin = null;
    if (lever && lever.id === e.pointerId) lever = null;
    if (joy && joy.id === e.pointerId) joy = null; }
  // finger vector -> {dir, k}; also used by the test API (virtual finger)
  function finVec() { if (!fin) return null; const dx = fin.x - fin.bx, dy = fin.y - fin.by, d = Math.hypot(dx, dy); if (d < FDEAD) return { dir: null, k: 0, d };
    return { dir: Math.atan2(dy, dx), k: Math.min(1, (d - FDEAD) / (FMAX() - FDEAD)), d }; }
  const pullMax = () => Math.min(W, H) * .36;
  function launchNow(ang, k) { if (!s || !s.docked) return; S51.launch(s, ang, k); au('launch', 30 + k * 70); launchT = rt; vib(25); thrSet = 0;
    const ca = Math.cos(ang), sa = Math.sin(ang); for (let i = 0; i < 18; i++) { const j = (Math.random() - .5) * 1.2, v = 30 + Math.random() * 60; pn(s.x - ca * 12, s.y - sa * 12, s.vx * .2 - Math.cos(ang + j) * v, s.vy * .2 - Math.sin(ang + j) * v, .9 + Math.random() * .6, 3 + Math.random() * 3, 0); } }
  let launchT = -9;
  function readInput(dt) {
    let kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    inp.head = null; inp.turn = 0; inp.thr = 0; inp.dir = null; inp.k = 0;
    if (brkLatch && s && (s.docked || !s.alive || Math.hypot(s.vx, s.vy) < .8)) brkLatch = false;
    inp.brake = !!(brkHeld || brkLatch || keys.KeyB || keys.ShiftLeft || keys.ShiftRight); 
    if (classic()) { const tk = -ky; if (tk) thrSet = Math.max(0, Math.min(1, thrSet + tk * dt * 1.1)); inp.turn = kx;
      if (joy) { const dx = joy.x - joy.bx, dy = joy.y - joy.by; if (Math.hypot(dx, dy) > 10) inp.head = Math.atan2(dy, dx); }
      if (kx) inp.head = null; inp.thr = thrSet; return; }
    const f = finVec(); if (f && f.dir != null) { inp.dir = f.dir; inp.k = f.k; }
    if (kx || ky) { inp.dir = Math.atan2(ky, kx); inp.k = 1; } }

  // ------------------------------------------------------------------ particles (world space)
  function pn(x, y, vx, vy, life, r, kind, col) { if (parts.length >= PMAX) parts.shift(); const p = { x, y, vx, vy, l: life, l0: life, r, k: kind, c: col || null }; parts.push(p); return p; }
  // kinds: 0 smoke (grey, grows) · 1 fire (additive orange) · 2 cold gas (white puff) · 3 spark (additive streak) · 4 debris
  function emit(dt) {
    if (!s || !s.alive || s.docked) return; const a = s.ang, ca = Math.cos(a), sa = Math.sin(a), Wp = (lx, ly) => [s.x + ca * lx - sa * ly, s.y + sa * lx + ca * ly], kd = kind();
    const qf = q === 0 ? .45 : q === 1 ? .75 : 1;
    if (s.thr > .03) { const n = s.thr * 60 * dt * qf; for (let i = 0; i < n || Math.random() < n - i; i++) { const [x, y] = Wp(kd === 'roadster' ? -12.6 : -13.5, (Math.random() - .5) * 3), j = (Math.random() - .5) * .35, v = 70 + s.thr * 90 + Math.random() * 40;
      const vx = s.vx - Math.cos(a + j) * v, vy = s.vy - Math.sin(a + j) * v;
      if (kd === 'roadster') pn(x, y, vx, vy, .45 + Math.random() * .35, 2 + Math.random() * 2, 2); else { pn(x, y, vx * .9, vy * .9, .25 + Math.random() * .15, 2.2 + s.thr * 2, 1); if (Math.random() < .55) pn(x, y, s.vx * .6 - Math.cos(a + j) * v * .45, s.vy * .6 - Math.sin(a + j) * v * .45, 1 + Math.random() * .8, 3 + Math.random() * 3, 0); } } }
    // attitude RCS: nose + tail quads fire opposite each other (torque couple)
    if (s.rcs > .14) { const sg = s.rcsSide, n = s.rcs * 40 * dt * qf; for (let i = 0; i < n || Math.random() < n - i; i++) {
      const [nx, ny] = Wp(11, -2.8 * sg), [tx, ty] = Wp(-9.5, 2.8 * sg), v = 50 + Math.random() * 40, ox = -sa * sg, oy = ca * sg;
      pn(nx, ny, s.vx - ox * v, s.vy - oy * v, .35 + Math.random() * .25, 1.3 + Math.random(), 2); pn(tx, ty, s.vx + ox * v, s.vy + oy * v, .35 + Math.random() * .25, 1.3 + Math.random(), 2); } }
    // brake: 'reverse thrusters' (RCS translation) puffs, opposite to the commanded push
    if (s.rcsT > .05) { const n = s.rcsT * 50 * dt * qf, sp = Math.hypot(s.vx, s.vy) || 1, ux = -s.vx / sp, uy = -s.vy / sp; for (let i = 0; i < n || Math.random() < n - i; i++) { const [x, y] = Wp((Math.random() - .5) * 16, (Math.random() - .5) * 8), v = 60 + Math.random() * 40;
      pn(x, y, s.vx - ux * v, s.vy - uy * v, .3 + Math.random() * .2, 1.3 + Math.random(), 2); } }
    // station-keeping puffs against strong gravity (cosmetic, automatic)
    const g = Math.hypot(s.gx, s.gy); if (g > 26 && Math.random() < Math.min(.6, g / 220) * qf) { const ux = s.gx / g, uy = s.gy / g, lat = -sa * ux + ca * uy, sd = lat > 0 ? 1 : -1, [x, y] = Wp((Math.random() - .5) * 14, 4 * sd), v = 40 + Math.random() * 30;
      pn(x, y, s.vx + (-sa * sd) * v, s.vy + (ca * sd) * v, .3 + Math.random() * .2, 1.1 + Math.random(), 2); }
  }
  function burst(x, y, n, kind, sp, col, life) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (.3 + Math.random()); pn(x, y, Math.cos(a) * v, Math.sin(a) * v, (life || .6) * (.6 + Math.random() * .8), kind === 4 ? 1.5 + Math.random() * 2.5 : 1.5 + Math.random() * 2, kind, col); } }
  function stepParts(dt) { for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.l -= dt; if (p.l <= 0) { parts.splice(i, 1); continue; } const d = p.k === 3 ? .985 : p.k === 4 ? .995 : .94; p.vx *= Math.pow(d, dt * 60); p.vy *= Math.pow(d, dt * 60); p.x += p.vx * dt; p.y += p.vy * dt; } }

  // ------------------------------------------------------------------ lifecycle
  function start(opt) {
    build(); labels(); M = S51.build(); s = S51.newShip(M); s.deaths = 0; parts = []; tipShown = {}; deadT = 0; winShown = false; thrSet = 0; joy = lever = aim = fin = null; brkHeld = brkLatch = false; paused = false; frozen = false; acc = 0; rt = 0; launchT = -9;
    autoOn = !!(opt && opt.auto); auto = autoOn ? S51.bot(M) : null; mini = null;
    bodies = M.rocks.map(o => { o.type = o.kind === 'ridge' ? 1 : 0; o.tone = o.kind === 'ridge' ? .35 : (o.seed * 3 % 1) * .6; return o; });
    moonB = []; for (const p of M.planets) { bodies.push({ x: p.x, y: p.y, r: p.r, type: 3, seed: .37, spin: .05, tone: .2 }); for (const m of p.moons) { const b = { x: 0, y: 0, r: m.r, type: 2, seed: .11 + m.d / 1000, spin: .1, tone: .5, p, m }; moonB.push(b); bodies.push(b); } }
    for (const h of M.holes) { h.tilt = h.tilt || .26; h.sgn = h.sgn || (h.x > 2000 ? -1 : 1); }
    camX = s.x + 120; camY = s.y - 40; viewW = 430;
    const sv = SV(); sv.exp = sv.exp || { done: 0, best: 0, runs: 0 }; sv.exp.runs++; try { BH().persist(); } catch (e) { }
    $('xWin').classList.remove('on'); $('xPP').classList.remove('on'); $('xTip').classList.remove('on');
    root.classList.add('on'); active = true; try { BH().show(null); } catch (e) { }
    tip(classic() ? 't0c' : 't0'); lastT = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    if (autoOn) S51.launch(s, -.2, .45);
    return true;
  }
  function exit() { active = false; paused = false; cancelAnimationFrame(raf); au('drive', { on: false }); if (root) root.classList.remove('on');
    try { BH().buildSectors(); BH().show('sectors'); } catch (e) { try { BH().toMenu(); } catch (e2) { } } }
  function simStep() {
    if (autoOn && auto && s.alive && !s.docked) { const a = auto(s); inp.head = null; inp.turn = 0; inp.thr = 0; inp.dir = a.dir; inp.k = a.k; inp.brake = !!a.brake; if (a.flip) inp.flip = true; }
    const ev = S51.step(M, s, inp, []); inp.flip = false;
    for (const e of ev) onEvent(e);
    if (!s.alive) { deadT += S51.STEP; if (deadT > 1.4) respawn(); }
  }
  function respawn() { s = S51.respawn(M, s); deadT = 0; thrSet = 0; joy = lever = fin = null; brkLatch = false; toast(tx('respawn'), 1); if (autoOn) { auto = S51.bot(M, s); const c = s.cp >= 0 ? M.cps[s.cp] : M.start; S51.launch(s, c.a, s.cp >= 0 ? .3 : .45); } }
  function onEvent(e) {
    switch (e.e) {
      case 'die': shake = .9; au('crash'); vib([60, 40, 90]); toast(e.cause === 'manual' ? tx('respawn') : tx('d_' + e.cause), 1.6); burst(e.x, e.y, 40, 3, 160, '255,190,90', .8); burst(e.x, e.y, 26, 4, 70, null, 1.6); burst(e.x, e.y, 22, 0, 40, null, 1.6); joy = lever = fin = null; brkLatch = false; thrSet = 0; break;
      case 'hit': if (e.v > 20) { burst(e.x, e.y, Math.min(16, 3 + e.v / 8 | 0), 3, 60 + e.v, '255,220,170', .4); } if (e.dmg > 0) { shake = Math.max(shake, .35); au('bounce'); vib(30); burst(e.x, e.y, 6, 4, 50, null, 1); } else if (e.v > 25) au('bounce'); break;
      case 'fuel': au('key'); toast(tx('fuelUp'), .9); burst(e.x, e.y, 18, 3, 90, '134,239,172', .6); vib(15); break;
      case 'cp': au('star', Math.min(7, e.i + 1)); toast(tx('gate', { n: e.i + 1, m: M.cps.length }), 1.2); burst(e.x, e.y, 30, 3, 120, '250,204,21', .8); vib(30); tip('t' + (e.i + 1)); break;
      case 'flip': au('magnet', e.pol); vib(10); break;
      case 'zap': au('bounce'); burst(e.x, e.y, 14, 3, 120, e.pol > 0 ? '248,113,113' : '96,165,250', .5); vib(25); break;
      case 'worm': au('worm'); burst(s.x, s.y, 30, 3, 100, '196,181,253', .8); break;
      case 'fast': toast(tx('fast'), 1.4); break;
      case 'empty': toast(tx('empty'), 2.6); break;
      case 'win': au('win', 3); vib([30, 50, 30, 50, 80]); finish(); break;
    }
  }
  function finish() { if (winShown) return; winShown = true; const sv = SV(), t = s.t, ex = sv.exp; const isBest = !ex.best || t < ex.best; ex.done = 1; if (isBest) ex.best = +t.toFixed(2);
    sv.facts = sv.facts || {}; if (!sv.facts['expedition-01']) sv.facts['expedition-01'] = { t: Date.now() }; try { BH().persist(); } catch (e) { }
    au('drive', { on: false }); thrSet = 0;
    setTimeout(() => { if (!active) return; $('xWT').textContent = tx('win'); $('xWTime').textContent = fmt(t); $('xWD').textContent = s.deaths || 0; $('xWF').textContent = Math.round(s.fuel) + '%';
      $('xWBest').textContent = (isBest ? '🏆 ' : '') + tx('best') + ': ' + fmt(ex.best);
      const f = FACT[lang()] || FACT.en; $('xWFact').innerHTML = '<b>📖 ' + f[0] + '</b><br>' + f[1] + '<br><a href="' + FACT.url + '" target="_blank" rel="noopener">' + FACT.src + '</a>';
      $('xWin').classList.add('on'); }, 900); }
  const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') + '.' + Math.floor(t * 10 % 10);
  function loop(now) {
    if (!active) return; raf = requestAnimationFrame(loop); const dt = Math.min(.1, Math.max(0, (now - lastT) / 1000)); lastT = now; if (!manual) advance(dt); }
  let manual = false; // test/recording hook: drive frames with a fixed dt
  function advance(dt) {
    perf.dts.push(dt * 1000); if (perf.dts.length > 240) perf.dts.shift(); perf.n++;
    if (!paused && !frozen) { readInput(dt); acc += dt; let n = 0; while (acc >= S51.STEP && n < 16) { simStep(); acc -= S51.STEP; n++; } if (n >= 16) acc = 0; rt += dt; stepParts(dt); emit(dt); }
    if (tipT > 0 && (tipT -= dt) <= 0) $('xTip').classList.remove('on'); if (toastT > 0 && (toastT -= dt) <= 0) $('xToast').classList.remove('on');
    const r0 = performance.now(); render(dt); const rms = performance.now() - r0; perf.rms.push(rms); if (perf.rms.length > 240) perf.rms.shift();
    autoQ(dt);
    if (!paused && rt - launchT > .7) au('drive', { on: s.alive && !s.docked && !s.won, thr: s.thr, rcs: Math.max(s.rcs, s.rcsT || 0, Math.min(1, Math.hypot(s.gx, s.gy) / 300)), prox: s.prox, pan: Math.max(-1, Math.min(1, (s.x - camX) / (viewW * .5))) });
  }
  // auto quality: drop a tier when the frame interval stays long (GPU-bound phones), never oscillate back up mid-run
  let qT = 0, qN = 0, qS = 0;
  function autoQ(dt) { const pref = SV().set.q; if (pref === 'low') { setQ(0); return; } if (pref === 'high') { setQ(2); return; }
    qT += dt; qN++; qS += dt; if (qT < 2) return; const avg = qS / qN * 1000; qT = qN = qS = 0; if (avg > 21 && q > 0) setQ(q - 1); }
  function setQ(n) { if (n === q) return; q = n; if (glOK) GL.setQuality(n); }

  // ------------------------------------------------------------------ rendering
  let spr = null, hudT = 0, shake = 0, safeT = 0, excl = null, brkCls = '', arrowAt = null;
  function sprites() { if (spr) return spr; const mk = (r, g, b) => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(.35, `rgba(${r},${g},${b},.55)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c; };
    spr = { w: mk(255, 255, 255), s: mk(150, 150, 162), f: mk(255, 150, 60), y: mk(255, 230, 160) }; return spr; }
  function resize() {
    const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2), gd = Math.min(window.devicePixelRatio || 1, q === 2 ? 2 : q === 1 ? 1.5 : 1);
    if (w !== W || h !== H || dpr !== DPR || gd !== gdpr || cv.width !== Math.round(w * dpr)) { W = w; H = h; DPR = dpr; gdpr = gd; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); glc.width = Math.round(W * gdpr); glc.height = Math.round(H * gdpr); mini = null;
      safeBv = Math.max(0, (parseFloat(getComputedStyle($('xBrk')).bottom) || 18) - 18); excl = null; safeT = Math.max(0, (parseFloat(getComputedStyle($('xPause')).top) || 100) - 100); } }
  function camera(dt) {
    const sp = Math.hypot(s.vx, s.vy), base = W > H ? 760 : 430, tw = base + Math.min(1, sp / 200) * 90 + (s.docked ? -30 : 0); viewW += (tw - viewW) * (1 - Math.exp(-dt * 1.2)); S = W / viewW; const vh = H / S;
    const cl = (v, m) => Math.max(-m, Math.min(m, v)); let lx = cl(s.vx * .55, viewW * .26), ly = cl(s.vy * .55, vh * .22);
    if (s.docked) { lx = Math.cos(s.ang) * 90; ly = Math.sin(s.ang) * 60; }
    const k = 1 - Math.exp(-dt * 2.6); camX += (s.x + lx - camX) * k; camY += (s.y + ly - camY) * k;
    const mx = viewW / 2 - 46, my = vh / 2 - 90; camX = Math.max(s.x - mx, Math.min(s.x + mx, camX)); camY = Math.max(s.y - my, Math.min(s.y + my, camY));
    if (M.W > viewW) camX = Math.max(viewW / 2 - 90, Math.min(M.W - viewW / 2 + 90, camX)); camY = Math.max(vh / 2 - 90, Math.min(M.H - vh / 2 + 90, camY)); }
  const X = x => (x - camX) * S + W / 2, Y = y => (y - camY) * S + H / 2;
  function render(dt) {
    resize(); camera(dt); for (const b of moonB) { const r = S51.moonPos(b.p, b.m, s.t); b.x = r[0]; b.y = r[1]; }
    let shx = 0, shy = 0; if (shake > 0) { shake = Math.max(0, shake - dt * 2); shx = (Math.random() - .5) * shake * 10; shy = (Math.random() - .5) * shake * 10; }
    const cx = camX + shx / S, cy = camY + shy / S;
    if (glOK) { const n = GL.render({ w: glc.width, h: glc.height, S: S * gdpr, cx, cy }, bodies, M.holes, M.whites, rt, M.star); if (n === false) glOK = false; else perf.drawn = n; }
    const c = ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(DPR * S, 0, 0, DPR * S, DPR * (W / 2 - cx * S), DPR * (H / 2 - cy * S));
    if (!glOK) fallback(c, cx, cy);
    world(c); drawParts(c);
    c.setTransform(DPR, 0, 0, DPR, 0, 0); drawShip(c); hud(c, dt);
  }
  function fallback(c, cx, cy) { // 2D tier (no WebGL): flat sky, parallax dots, shaded discs
    const vw = W / S, vh = H / S; c.fillStyle = '#04030c'; c.fillRect(cx - vw, cy - vh, vw * 2, vh * 2);
    c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 140; i++) { const px = ((i * 977.3) % 1300) - cx * .3, py = ((i * 613.7) % 1300) - cy * .3, x = cx - vw / 2 + ((px % vw) + vw) % vw, y = cy - vh / 2 + ((py % vh) + vh) % vh; c.fillRect(x, y, 1.2 / S, 1.2 / S); }
    for (const o of bodies) { if (Math.abs(o.x - cx) > vw / 2 + o.r || Math.abs(o.y - cy) > vh / 2 + o.r) continue; const g = c.createRadialGradient(o.x - o.r * .4, o.y - o.r * .4, o.r * .1, o.x, o.y, o.r);
      g.addColorStop(0, o.type === 3 ? '#7dd3fc' : '#a8a29e'); g.addColorStop(1, o.type === 3 ? '#1e3a8a' : '#292524'); c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, o.r, 0, TAU); c.fill(); }
    for (const h of M.holes) { c.strokeStyle = 'rgba(251,146,60,.8)'; c.lineWidth = h.rs * .5; c.beginPath(); c.ellipse(h.x, h.y, h.rs * 3, h.rs * .8, 0, 0, TAU); c.stroke(); c.fillStyle = '#000'; c.beginPath(); c.arc(h.x, h.y, h.rs * 1.25, 0, TAU); c.fill(); }
    for (const h of M.whites) { const g = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r * 3); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(186,230,253,0)'); c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y, h.r * 3, 0, TAU); c.fill(); } }
  function glow(c, x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function world(c) {
    const t = rt, lw = 1 / S, next = s.cp + 1;
    // solar flare curtain: off = faint vents, last 0.8 s = blinking warning, on = searing beam
    for (const f of M.flares) { const ph = S51.flarePhase(f, s.t) * f.per, on = ph < f.on, warn = !on && ph > f.per - .8;
      c.fillStyle = 'rgba(253,186,116,.5)'; for (const yy of [f.y0, f.y1]) { glow(c, f.x, yy, 30, '253,186,116', .7); }
      if (on) { const k = .8 + .2 * Math.sin(t * 40), g = c.createLinearGradient(f.x - f.w, 0, f.x + f.w, 0); g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(.35, `rgba(255,170,60,${.55 * k})`); g.addColorStop(.5, `rgba(255,250,220,${.95 * k})`); g.addColorStop(.65, `rgba(255,170,60,${.55 * k})`); g.addColorStop(1, 'rgba(255,120,30,0)');
        c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(f.x - f.w, f.y0, f.w * 2, f.y1 - f.y0); c.globalCompositeOperation = 'source-over'; }
      else { c.strokeStyle = warn && (t * 8 | 0) % 2 ? 'rgba(253,186,116,.9)' : 'rgba(253,186,116,.22)'; c.lineWidth = (warn ? 3 : 1.5) * lw; c.setLineDash([10 * lw, 8 * lw]); c.strokeRect(f.x - f.w / 2, f.y0, f.w, f.y1 - f.y0); c.setLineDash([]); } }
    // polarity barriers
    for (const b of M.barriers) { const col = b.pol > 0 ? '248,113,113' : '96,165,250', pass = b.pol === s.pol; glow(c, b.x, b.y0, 18, col, .8); glow(c, b.x, b.y1, 18, col, .8);
      if (pass) { c.strokeStyle = `rgba(${col},.28)`; c.lineWidth = 2 * lw; c.setLineDash([6 * lw, 10 * lw]); c.beginPath(); c.moveTo(b.x, b.y0); c.lineTo(b.x, b.y1); c.stroke(); c.setLineDash([]); }
      else { c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(b.x - 9, 0, b.x + 9, 0); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(.5, `rgba(${col},.75)`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(b.x - 9, b.y0, 18, b.y1 - b.y0);
        c.strokeStyle = `rgba(255,255,255,.55)`; c.lineWidth = 1.2 * lw; c.beginPath(); for (let y = b.y0; y < b.y1; y += 16) { const o = Math.sin(y * .07 + t * 9) * 3; c.lineTo(b.x + o, y); } c.stroke(); c.globalCompositeOperation = 'source-over'; } }
    // magnets: core + field rings (inward when attracting the ship, outward when repelling)
    for (const m of M.magnets) { const col = m.pol > 0 ? '248,113,113' : '96,165,250', att = m.pol !== s.pol; glow(c, m.x, m.y, 60, col, .35);
      for (let i = 0; i < 3; i++) { let f = ((t * .5 + i / 3) % 1); if (att) f = 1 - f; c.strokeStyle = `rgba(${col},${.5 * (1 - f)})`; c.lineWidth = 2 * lw; c.beginPath(); c.arc(m.x, m.y, 18 + f * 90, 0, TAU); c.stroke(); }
      c.fillStyle = `rgb(${col})`; c.beginPath(); c.arc(m.x, m.y, 13, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.font = `bold 16px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m.pol > 0 ? '+' : '−', m.x, m.y + 1); }
    // wormhole mouth + exit
    const wm = M.worm; c.save(); c.translate(wm.x, wm.y); for (let i = 0; i < 4; i++) { c.rotate(t * 1.6 + i * 1.57); c.strokeStyle = `rgba(196,181,253,${.75 - i * .12})`; c.lineWidth = 3 * lw; c.beginPath(); c.arc(0, 0, 10 + i * 6, 0, 3.6); c.stroke(); } c.restore(); glow(c, wm.x, wm.y, 40, '139,92,246', .45);
    c.strokeStyle = 'rgba(196,181,253,.35)'; c.lineWidth = 2 * lw; c.setLineDash([4 * lw, 6 * lw]); c.beginPath(); c.arc(wm.ex, wm.ey, 22, 0, TAU); c.stroke(); c.setLineDash([]);
    // fuel canisters
    M.fuel.forEach((u, i) => { if (s.picked.indexOf(i) >= 0) return; glow(c, u.x, u.y, 30, '74,222,128', .35 + .15 * Math.sin(t * 4 + i)); c.save(); c.translate(u.x, u.y); c.rotate(Math.sin(t + i) * .4);
      c.fillStyle = '#14532d'; c.strokeStyle = '#86efac'; c.lineWidth = 1.5 * lw; c.beginPath(); c.roundRect ? c.roundRect(-6, -9, 12, 18, 3) : c.rect(-6, -9, 12, 18); c.fill(); c.stroke(); c.fillStyle = '#86efac'; c.fillRect(-2, -12, 4, 3); c.fillRect(-4, -2, 8, 2.4); c.restore(); });
    // checkpoint gates
    M.cps.forEach((g, i) => { const done = i <= s.cp, nx = i === next, col = done ? '74,222,128' : nx ? '250,204,21' : '125,211,252', R = K.CP_R * .82, a = done ? .35 : nx ? .85 + .15 * Math.sin(t * 5) : .3;
      c.save(); c.translate(g.x, g.y); c.strokeStyle = `rgba(${col},${a})`; c.lineWidth = 3 * lw; c.setLineDash([14 * lw, 9 * lw]); c.lineDashOffset = -t * 20 * lw; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke(); c.setLineDash([]);
      for (let k = 0; k < 2; k++) { c.rotate(Math.PI); c.fillStyle = `rgba(${col},${a})`; c.beginPath(); c.moveTo(R + 6, -5); c.lineTo(R + 16, 0); c.lineTo(R + 6, 5); c.fill(); }
      c.fillStyle = `rgba(${col},${Math.min(1, a + .15)})`; c.font = 'bold 15px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), 0, 0); c.restore(); });
    // final portal
    const P = M.portal; glow(c, P.x, P.y, P.r * 2.4, '34,211,238', .35); c.save(); c.translate(P.x, P.y); for (let i = 0; i < 3; i++) { c.rotate(t * (i % 2 ? -1 : 1) * (.8 + i * .4)); c.strokeStyle = `rgba(${i === 1 ? '74,222,128' : '103,232,249'},.85)`; c.lineWidth = (4 - i) * lw * 1.4; c.beginPath(); c.arc(0, 0, P.r * (1 - i * .18), 0, 4.6); c.stroke(); } c.restore();
    if (next >= M.cps.length) { const d = Math.hypot(s.x - P.x, s.y - P.y), sp = Math.hypot(s.vx, s.vy); if (d < 260) { c.fillStyle = sp < K.PORTAL_V ? 'rgba(134,239,172,.95)' : 'rgba(252,165,165,.95)'; c.font = 'bold 14px system-ui'; c.textAlign = 'center'; c.fillText((sp | 0) + ' / ' + K.PORTAL_V, P.x, P.y - P.r - 14); } }
    // flight aids: velocity (green) and gravity (violet) vectors
    if (s.alive && !s.docked) { const sp = Math.hypot(s.vx, s.vy); if (sp > 8) { c.strokeStyle = 'rgba(134,239,172,.55)'; c.lineWidth = 1.6 * lw; c.setLineDash([5 * lw, 5 * lw]); c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + s.vx * .7, s.y + s.vy * .7); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(134,239,172,.8)'; c.beginPath(); c.arc(s.x + s.vx * .7, s.y + s.vy * .7, 2.6, 0, TAU); c.fill(); }
      const g = Math.hypot(s.gx, s.gy); if (g > 12) { const L = Math.min(60, g * .35); c.strokeStyle = `rgba(192,132,252,${Math.min(.8, g / 120)})`; c.lineWidth = 2 * lw; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + s.gx / g * L, s.y + s.gy / g * L); c.stroke(); }
      if (inp.head != null) { c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1 * lw; c.beginPath(); c.moveTo(s.x + Math.cos(inp.head) * 18, s.y + Math.sin(inp.head) * 18); c.lineTo(s.x + Math.cos(inp.head) * 46, s.y + Math.sin(inp.head) * 46); c.stroke(); } }
  }
  function drawParts(c) { const sp = sprites(); for (const p of parts) { const f = p.l / p.l0, age = 1 - f;
    if (p.k === 0) { const r = p.r * (1 + age * 3); c.globalAlpha = .28 * f; c.drawImage(sp.s, p.x - r, p.y - r, r * 2, r * 2); }
    else if (p.k === 1) { c.globalCompositeOperation = 'lighter'; const r = p.r * (1 + age); c.globalAlpha = .8 * f; c.drawImage(age < .3 ? sp.y : sp.f, p.x - r, p.y - r, r * 2, r * 2); c.globalCompositeOperation = 'source-over'; }
    else if (p.k === 2) { const r = p.r * (1 + age * 2.5); c.globalAlpha = .55 * f; c.drawImage(sp.w, p.x - r, p.y - r, r * 2, r * 2); }
    else if (p.k === 3) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = f; c.strokeStyle = `rgb(${p.c || '255,210,150'})`; c.lineWidth = 1.4 / S; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); c.stroke(); c.globalCompositeOperation = 'source-over'; }
    else { c.globalAlpha = Math.min(1, f * 2); c.fillStyle = '#57534e'; c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); } } c.globalAlpha = 1; }
  const starA = () => Math.atan2(M.star.y, M.star.x);
  function drawShip(c) {
    if (!s.alive) return; const x = X(s.x), y = Y(s.y), k = S * 1.45, kd = kind(), SH = window.BHShips;
    const pc = s.pol > 0 ? '248,113,113' : '96,165,250'; c.strokeStyle = `rgba(${pc},.35)`; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 19 * k, 0, TAU); c.stroke();
    if (s.docked) { const p = .5 + .5 * Math.sin(rt * 4); c.strokeStyle = `rgba(250,204,21,${.35 + .4 * p})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 24 * k + p * 4, 0, TAU); c.stroke(); }
    c.save(); c.translate(x, y); c.rotate(s.ang);
    if (SH && SH.draw) SH.draw(c, kd, { k, dev: DPR * (W / 400) * 1.5, t: rt, engine: s.thr > .02 ? .2 + s.thr * 1.5 : 0, ignite: s.thr > .6 ? (s.thr - .6) * 2 : 0, braking: false,
      light: { a: starA() - s.ang, c: '255,244,225', k: 1 }, hole: s.prox, bank: Math.max(-1, Math.min(1, s.w / K.WMAX)) * .6, gas: kd === 'roadster' ? Math.min(1, s.thr * 1.5) : 0, wheel: 0 });
    else { c.fillStyle = '#e2e8f0'; c.beginPath(); c.moveTo(14 * k, 0); c.lineTo(-10 * k, 8 * k); c.lineTo(-10 * k, -8 * k); c.fill(); }
    c.restore(); }
  function hud(c, dt) {
    const L = LEV(), next = s.cp + 1;
    // docked: slingshot guide
    if (s.docked && s.alive && !s.won) { const x = X(s.x), y = Y(s.y);
      if (aim) { const dx = aim.x - aim.x0, dy = aim.y - aim.y0, d = Math.hypot(dx, dy), sling = (SV().set.aim || 'sling') !== 'direct', a = sling ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx), k = Math.min(1, d / pullMax()), Lx = 40 + k * 110;
        s.ang = a; c.strokeStyle = 'rgba(250,204,21,.9)'; c.lineWidth = 3; c.setLineDash([8, 7]); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * Lx, y + Math.sin(a) * Lx); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(250,204,21,.95)'; c.beginPath(); c.arc(x + Math.cos(a) * Lx, y + Math.sin(a) * Lx, 5, 0, TAU); c.fill(); c.font = 'bold 13px system-ui'; c.textAlign = 'center'; c.fillText(Math.round(k * 100) + '%', x, y - 34);
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(aim.x0, aim.y0, 8, 0, TAU); c.moveTo(aim.x0, aim.y0); c.lineTo(aim.x, aim.y); c.stroke(); }
      else { c.fillStyle = `rgba(255,255,255,${.65 + .3 * Math.sin(rt * 3)})`; c.font = '600 15px system-ui'; c.textAlign = 'center'; c.fillText((SV().set.aim || 'sling') !== 'direct' ? tx('launch') : tx('launchD'), W / 2, H - 120 - safeBv); } }
    if (!s.docked && s.alive) {
      if (classic()) {
      if (joy) { const dx = joy.x - joy.bx, dy = joy.y - joy.by, d = Math.hypot(dx, dy), m = Math.min(d, JR), kx = joy.bx + (d ? dx / d * m : 0), ky = joy.by + (d ? dy / d * m : 0);
        c.fillStyle = 'rgba(15,23,42,.35)'; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(joy.bx, joy.by, JR, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = 'rgba(167,139,250,.85)'; c.beginPath(); c.arc(kx, ky, 22, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke(); }
      else { const gx = Math.min(W * .26, 110), gy = H - 150 - safeBv; c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 2; c.beginPath(); c.arc(gx, gy, JR, 0, TAU); c.stroke(); c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(gx, gy, 20, 0, TAU); c.fill(); }
      // throttle lever
      const top = L.y1 - L.h; c.fillStyle = 'rgba(15,23,42,.5)'; c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect ? c.roundRect(L.x - 15, top - 6, 30, L.h + 12, 15) : c.rect(L.x - 15, top - 6, 30, L.h + 12); c.fill(); c.stroke();
      const fy = L.y1 - L.h * thrSet, g = c.createLinearGradient(0, L.y1, 0, top); g.addColorStop(0, 'rgba(250,204,21,.85)'); g.addColorStop(1, 'rgba(239,68,68,.9)'); c.fillStyle = g; c.fillRect(L.x - 9, fy, 18, L.y1 - fy);
      c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(L.x + 11, L.y1 - L.h * s.thr - 1, 5, 2); // actual (spooled) thrust tick
      c.fillStyle = lever ? '#fff' : '#e2e8f0'; c.beginPath(); c.roundRect ? c.roundRect(L.x - 19, fy - 8, 38, 16, 8) : c.rect(L.x - 19, fy - 8, 38, 16); c.fill();
      c.fillStyle = '#0f172a'; c.font = 'bold 10px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(Math.round(thrSet * 100), L.x, fy + .5); c.textBaseline = 'alphabetic';
      c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '600 10px system-ui'; c.fillText(s.fuel > 0 ? 'THR' : '⛽ 0', L.x, L.y1 + 22);       } else fingerHud(c);
      shipHud(c); }
    const bc = (inp.brake && !s.docked ? 'on' : '') + (brkLatch ? ' latch' : ''); if (bc !== brkCls) { brkCls = bc; const B = $('xBrk'); B.classList.toggle('on', !!inp.brake && !s.docked); B.classList.toggle('latch', brkLatch); }
    minimap(c); edgeArrow(c);
    // DOM HUD (10 Hz)
    hudT -= dt; if (hudT <= 0) { hudT = .1; tipPlace(); const f = Math.max(0, s.fuel), fe = $('xFuel'); fe.style.width = f + '%'; fe.style.background = f < 20 ? '#f87171' : f < 45 ? '#fbbf24' : '#38bdf8'; $('xFuelN').textContent = Math.round(f) + '%';
      $('xHull').style.width = Math.max(0, s.hull) + '%'; $('xHull').style.background = s.hull < 35 ? '#f87171' : '#4ade80'; $('xHullN').textContent = Math.round(s.hull) + '%';
      $('xCp').textContent = Math.max(0, s.cp + 1) + '/' + M.cps.length; $('xTime').textContent = fmt(s.t).slice(0, -2); $('xSp').textContent = Math.round(Math.hypot(s.vx, s.vy));
      $('xPol').style.background = s.pol > 0 ? 'rgba(220,38,38,.6)' : 'rgba(37,99,235,.6)'; }
  }
  // one-finger indicator: floating ring at the touch-down point, deadzone, strength arc + flame preview
  function fingerHud(c) {
    if (!fin) { if (rt - launchT < 6 && !tipShown.__fh) { const gx = W * .5, gy = H * .62, p = (rt * .8) % 1; c.globalAlpha = .55 * (1 - p); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(gx, gy, 16 + p * 40, 0, TAU); c.stroke(); c.globalAlpha = 1; } return; }
    const f = finVec(), R = FMAX(), bx = fin.bx, by = fin.by; tipShown.__fh = 1;
    c.fillStyle = 'rgba(15,23,42,.22)'; c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.5; c.beginPath(); c.arc(bx, by, R, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(bx, by, FDEAD, 0, TAU); c.stroke();
    if (f.dir != null) { const ca = Math.cos(f.dir), sa = Math.sin(f.dir), g = gateNow(f.dir), on = s.fuel > 0 ? f.k * g : 0, L = Math.min(f.d, R);
      c.strokeStyle = 'rgba(167,139,250,.75)'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx + ca * FDEAD, by + sa * FDEAD); c.lineTo(bx + ca * L, by + sa * L); c.stroke();
      c.strokeStyle = on > .02 ? 'rgba(251,146,60,.95)' : 'rgba(148,163,184,.8)'; c.lineWidth = 5; c.beginPath(); c.arc(bx, by, R, f.dir - f.k * .9, f.dir + f.k * .9); c.stroke();
      // flame preview: points back from the ring centre; solid when the engine is really burning, ghost while the nose is still turning
      const fl = 10 + 34 * f.k, fx = bx - ca * 4, fy = by - sa * 4; c.save(); c.translate(fx, fy); c.rotate(f.dir + Math.PI); c.globalAlpha = on > .02 ? .9 : .35;
      const gr = c.createLinearGradient(0, 0, fl, 0); gr.addColorStop(0, '#fde68a'); gr.addColorStop(.5, '#fb923c'); gr.addColorStop(1, 'rgba(239,68,68,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(0, -7); c.quadraticCurveTo(fl * .6, -5, fl, 0); c.quadraticCurveTo(fl * .6, 5, 0, 7); c.fill(); c.restore(); c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,255,255,.9)'; c.font = 'bold 11px system-ui'; c.textAlign = 'center'; c.fillText(s.fuel > 0 ? Math.round(f.k * 100) + '%' : '⛽ 0', bx, by - R - 8); }
    c.fillStyle = f.dir != null ? 'rgba(196,181,253,.95)' : 'rgba(255,255,255,.6)'; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(fin.x, fin.y, 15, 0, TAU); c.fill(); c.stroke(); }
  const gateNow = a => { const K = S51.K, e = Math.abs(S51.wrap(a - s.ang)); return Math.max(0, Math.min(1, (K.GATE_HI - e) / (K.GATE_HI - K.GATE_LO))); };
  // around the ship: target heading chevron + turn arc (where the nose is going), brake marker + velocity vector
  function shipHud(c) {
    const x = X(s.x), y = Y(s.y), r = Math.max(26, 30 * S);
    if (inp.dir != null && !inp.brake) { const g = gateNow(inp.dir), d = S51.wrap(inp.dir - s.ang);
      c.strokeStyle = 'rgba(167,139,250,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, d > 0 ? s.ang : inp.dir, d > 0 ? inp.dir : s.ang); c.stroke();
      c.save(); c.translate(x + Math.cos(inp.dir) * (r + 6), y + Math.sin(inp.dir) * (r + 6)); c.rotate(inp.dir); c.fillStyle = g > .5 ? 'rgba(251,146,60,.95)' : 'rgba(196,181,253,.9)'; c.beginPath(); c.moveTo(7, 0); c.lineTo(-4, 6); c.lineTo(-1, 0); c.lineTo(-4, -6); c.fill(); c.restore(); }
    const sp = Math.hypot(s.vx, s.vy);
    if (inp.brake) { c.strokeStyle = `rgba(248,113,113,${.55 + .3 * Math.sin(rt * 10)})`; c.lineWidth = 2.5; c.setLineDash([5, 5]); c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.stroke(); c.setLineDash([]);
      if (sp > 2) { const L = Math.min(70, sp * .5) * Math.max(.6, S); c.strokeStyle = 'rgba(254,202,202,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + s.vx / sp * L, y + s.vy / sp * L); c.stroke(); }
      c.fillStyle = 'rgba(254,202,202,.95)'; c.font = 'bold 11px system-ui'; c.textAlign = 'center'; c.fillText(sp < 1.5 ? '⏹ 0' : '⏹ ' + Math.round(sp), x, y - r - 10); } }
  // screen rects the edge arrow and tip must avoid (buttons, minimap)
  function exclRects() { if (excl) return excl; excl = []; for (const id of ['xPause', 'xRe', 'xPol', 'xBrk']) { const e = $(id); if (!e) continue; const b = e.getBoundingClientRect(); if (b.width) excl.push({ x0: b.left, y0: b.top, x1: b.right, y1: b.bottom }); }
    const mw = Math.min(124, W * .3), mh = M.H * mw / M.W; excl.push({ x0: W - mw - 10, y0: safeT + 10, x1: W - 10, y1: safeT + 10 + mh }); return excl; }
  // the tip box must never sit on the ship: flip it between top and bottom slots
  function tipPlace() { const el = $('xTip'); if (!el.classList.contains('on')) return; const x = X(s.x), y = Y(s.y), b = el.getBoundingClientRect(), P = 36;
    const hit = x > b.left - P && x < b.right + P && y > b.top - P && y < b.bottom + P; if (hit) { el.classList.toggle('lo'); tipLo = el.classList.contains('lo'); } }
  function minimap(c) {
    const mw = Math.min(124, W * .3), sc = mw / M.W, mh = M.H * sc, x0 = W - mw - 10, y0 = safeT + 10;
    if (!mini) { mini = document.createElement('canvas'); mini.width = Math.round(mw * DPR); mini.height = Math.round(mh * DPR); const m = mini.getContext('2d'); m.scale(DPR * sc, DPR * sc);
      m.fillStyle = 'rgba(2,6,23,.62)'; m.fillRect(0, 0, M.W, M.H); m.fillStyle = 'rgba(168,162,158,.75)'; for (const o of M.rocks) { m.beginPath(); m.arc(o.x0, o.y0, Math.max(o.r, 14), 0, TAU); m.fill(); }
      for (const p of M.planets) { m.fillStyle = '#38bdf8'; m.beginPath(); m.arc(p.x, p.y, p.r * 1.3, 0, TAU); m.fill(); }
      for (const h of M.holes) { m.fillStyle = '#fb923c'; m.beginPath(); m.arc(h.x, h.y, h.rs * 3, 0, TAU); m.fill(); m.fillStyle = '#000'; m.beginPath(); m.arc(h.x, h.y, h.rs * 1.8, 0, TAU); m.fill(); }
      for (const h of M.whites) { m.fillStyle = '#e0f2fe'; m.beginPath(); m.arc(h.x, h.y, 40, 0, TAU); m.fill(); }
      for (const b of M.barriers) { m.fillStyle = b.pol > 0 ? '#f87171' : '#60a5fa'; m.fillRect(b.x - 10, b.y0, 20, b.y1 - b.y0); }
      for (const f of M.flares) { m.fillStyle = '#fdba74'; m.fillRect(f.x - 14, f.y0, 28, f.y1 - f.y0); }
      m.fillStyle = '#a78bfa'; m.beginPath(); m.arc(M.worm.x, M.worm.y, 40, 0, TAU); m.fill(); m.fillStyle = '#22d3ee'; m.beginPath(); m.arc(M.portal.x, M.portal.y, 60, 0, TAU); m.fill(); }
    c.drawImage(mini, x0, y0, mw, mh); c.strokeStyle = 'rgba(167,139,250,.6)'; c.lineWidth = 1; c.strokeRect(x0 + .5, y0 + .5, mw - 1, mh - 1);
    M.fuel.forEach((u, i) => { if (s.picked.indexOf(i) < 0) { c.fillStyle = '#4ade80'; c.fillRect(x0 + u.x * sc - 1.5, y0 + u.y * sc - 1.5, 3, 3); } });
    M.cps.forEach((g, i) => { c.fillStyle = i <= s.cp ? '#4ade80' : i === s.cp + 1 ? (rt * 3 | 0) % 2 ? '#facc15' : '#fff' : 'rgba(125,211,252,.7)'; c.beginPath(); c.arc(x0 + g.x * sc, y0 + g.y * sc, 2.6, 0, TAU); c.fill(); });
    const vh = H / S; c.strokeStyle = 'rgba(255,255,255,.45)'; c.strokeRect(x0 + (camX - viewW / 2) * sc, y0 + (camY - vh / 2) * sc, viewW * sc, vh * sc);
    c.save(); c.translate(x0 + s.x * sc, y0 + s.y * sc); c.rotate(s.ang); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(5, 0); c.lineTo(-3.5, 3); c.lineTo(-3.5, -3); c.fill(); c.restore(); }
  function edgeArrow(c) {
    if (!s.alive || s.won) return; const G = S51.nextGoal(M, s), gx = X(G.x), gy = Y(G.y), mL = 26, mT = safeT + 104, mB = H - 40 - safeBv, mR = W - 26;
    if (gx > mL && gx < mR && gy > mT && gy < mB) { arrowAt = null; return; } const cx = W / 2, cy = (mT + mB) / 2, dx = gx - cx, dy = gy - cy;
    const k = Math.min(dx ? ((dx > 0 ? mR : mL) - cx) / dx : 1e9, dy ? ((dy > 0 ? mB : mT) - cy) / dy : 1e9), a = Math.atan2(dy, dx), d = Math.hypot(G.x - s.x, G.y - s.y); let ax = cx + dx * k, ay = cy + dy * k;
    const side = Math.abs(ax - mL) < 1 || Math.abs(ax - mR) < 1, R = exclRects(), P = 22;
    const free = (x, y) => x >= mL && x <= mR && y >= mT && y <= mB && !R.some(r => x > r.x0 - P && x < r.x1 + P && y > r.y0 - P && y < r.y1 + P);
    ax = Math.max(mL, Math.min(mR, ax)); ay = Math.max(mT, Math.min(mB, ay));
    if (!free(ax, ay)) { let f = null; for (let t = 6; t < 900 && !f; t += 6) for (const sg of [1, -1]) { const x = side ? ax : ax + sg * t, y = side ? ay + sg * t : ay; if (free(x, y)) { f = [x, y]; break; } }
      if (f) { ax = f[0]; ay = f[1]; } }
    arrowAt = { x: ax, y: ay };
    const col = s.cp + 1 >= M.cps.length ? '34,211,238' : '250,204,21'; c.save(); c.translate(ax, ay); c.rotate(a); c.fillStyle = `rgba(${col},.92)`; c.beginPath(); c.moveTo(12, 0); c.lineTo(-8, 9); c.lineTo(-4, 0); c.lineTo(-8, -9); c.fill(); c.restore();
    c.fillStyle = `rgba(${col},.95)`; c.font = 'bold 11px system-ui'; c.textAlign = 'center'; c.fillText((d / 100).toFixed(1) + ' km', ax - Math.cos(a) * 42, ay - Math.sin(a) * 22 + 4); }

  // ------------------------------------------------------------------ menu entry + test API
  function entryCard() { css(); const el = document.createElement('div'); el.id = 'xEntry'; const ex = (SV().exp || {});
    el.innerHTML = `<em>🧪 51</em><b>🚀 ${tx('name')}</b><small>${tx('tag')} · ${tx('card')}${ex.best ? ' · 🏆 ' + fmt(ex.best) : ''}</small>`; el.onclick = () => start(); return el; }
  function hook() { css(); settingsRow(); document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#langSeg,#bSettings')) setTimeout(() => { settingsRow(); ctlLabels(); syncCtl(); if (root) labels(); }, 0); }, true); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  return {
    start, exit, entryCard, tx, FACT, get active() { return active; }, get ship() { return s; }, get map() { return M; }, get paused() { return paused; }, get gl() { return glOK; }, get quality() { return q; }, setQuality: n => setQ(n),
    get input() { return inp; }, manual: b => { manual = !!b; lastT = performance.now(); }, advance: (dt, n) => { for (let i = 0; i < (n || 1); i++) advance(dt); }, get throttle() { return thrSet; }, setThrottle: v => { thrSet = Math.max(0, Math.min(1, v)); }, launch: (a, k) => launchNow(a, k), freeze: b => { frozen = !!b; }, autopilot: b => { autoOn = !!b; auto = autoOn ? S51.bot(M, s) : null; },
    finger: (dx, dy) => { if (dx == null) { fin = null; return; } const bx = W / 2, by = H * .6; fin = { id: -7, bx, by, x: bx + dx, y: by + dy }; }, brake: b => { brkHeld = !!b; }, get brakeLatch() { return brkLatch; }, get fingerVec() { return finVec(); },
    get arrow() { return arrowAt; }, get excl() { return exclRects(); },
    get controls() { return classic() ? 'classic' : 'finger'; }, setControls: v => setCtl(v),
    stepN(n) { for (let i = 0; i < n && active && !s.won; i++) { if (!autoOn) readInput(S51.STEP); simStep(); } }, get cam() { return { x: camX, y: camY, w: viewW, S }; }, toScreen: (x, y) => [X(x), Y(y)],
    perf() { const a = perf.dts.slice().sort((x, y) => x - y), r = perf.rms.slice().sort((x, y) => x - y), avg = v => v.reduce((p, x) => p + x, 0) / Math.max(1, v.length);
      return { frames: perf.n, dtAvg: avg(a), dtP95: a[Math.floor(a.length * .95)] || 0, renderAvg: avg(r), renderP95: r[Math.floor(r.length * .95)] || 0, drawn: perf.drawn, q, gl: glOK, parts: parts.length }; } };
})();
