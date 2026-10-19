/* Blackhole Battle v3.1 — local progress: ranks, achievements, stats (no gameplay effect) */
window.BHProg = (() => {
  'use strict';
  const RANKS = [[0, 'Кадет'], [6, 'Пілот-стажер'], [15, 'Пілот'], [28, 'Штурман'], [42, 'Навігатор'], [58, 'Капітан'], [76, 'Командор'], [96, 'Адмірал'], [120, 'Майстер гравітації'], [145, 'Володар горизонту']];
  const SECN = ['Пояс Кеплера', 'Місяці Гіганта', 'Магнітар', 'Кротові нори', 'Горизонт подій'];
  const stars = s => Object.values(s.best).reduce((a, b) => a + (b.s || 0), 0);
  const score = s => Object.values(s.best).reduce((a, b) => a + (b.sc || 0), 0);
  const T = (k, v) => window.I18N ? I18N.t(k, v) : k;
  let cat = null; // set by the game: level/sector catalog (id-keyed saves)
  const secStars = (s, k) => cat.real[k] ? cat.real[k].ids.reduce((n, id) => n + ((s.best[id] || {}).s || 0), 0) : 0;
  const bossBeaten = (s, k) => { const S = cat && cat.real[k]; return !!(S && s.best[S.ids[S.ids.length - 1]]); };
  function rank(st) { let i = 0; while (i + 1 < RANKS.length && st >= RANKS[i + 1][0]) i++; const nx = RANKS[i + 1]; return { i, name: T('rank.' + i), at: RANKS[i][0], next: nx ? T('rank.' + (i + 1)) : null, nextAt: nx ? nx[0] : null }; }
  // ev: {type:'win'|'fail'|'event', ...}
  const ACH = [
    { id: 'first', i: '🚀', n: 'Перший старт', d: 'Пройди будь-який рівень', t: s => s.stats.wins >= 1 },
    { id: 'perfect', i: '⭐', n: 'Ідеальна траєкторія', d: 'Отримай ★★★ на рівні', t: s => Object.values(s.best).some(b => b.s === 3) },
    ...SECN.map((n0, k) => ({ id: 'sec' + (k + 1), i: ['🪐', '🌙', '🧲', '🌀', '🕳'][k], get n() { return T('a.sec.n', { k: k + 1, n: cat && cat.real[k] && window.I18N ? I18N.secName(cat.real[k]) : n0 }); }, get d() { return T('a.sec.d', { k: k + 1 }); }, t: s => bossBeaten(s, k) })),
    { id: 'sector30', i: '🌟', n: 'Зоряний сектор', d: 'Збери 30/30 ★ в одному секторі', t: s => cat.real.some((S, k) => secStars(s, k) >= S.ids.length * 3) },
    { id: 'collector', i: '💫', n: 'Збирач', d: 'Збери всі 3 бонусні зірки за один політ', t: (s, e) => e.type === 'win' && e.bonus >= 3 },
    { id: 'streak', i: '🔥', n: 'Серія', d: '4 рівні поспіль на ★★★', t: s => s.streak >= 4 },
    { id: 'nearmiss', i: '😰', n: 'На волосині', d: 'Пройди повз горизонт подій впритул і дійди до порталу', t: (s, e) => e.type === 'win' && e.margin != null && e.margin < 0.45 },
    { id: 'billiard', i: '🎱', n: 'Більярдист', d: '3 рикошети за один рівень — і перемога', t: (s, e) => e.type === 'win' && e.bounces >= 3 },
    { id: 'worm', i: '🌀', n: 'Крізь простір', d: 'Пролети крізь кротову нору', t: s => s.stats.worms >= 1 },
    { id: 'polar', i: '🧲', n: 'Полярник', d: 'Переключи магніти 15 разів', t: s => s.stats.flips >= 15 },
    { id: 'breaker', i: '💥', n: 'Розбивака', d: 'Розбий крихкий астероїд', t: s => s.stats.breaks >= 1 },
    { id: 'saved', i: '🛡', n: 'Вчасно', d: 'Щит урятував шатл', t: s => s.stats.shields >= 1 },
    { id: 'tech', i: '🧰', n: 'Технар', d: 'Використай 5 бонусів', t: s => s.stats.puUsed >= 5 },
    { id: 'lightning', i: '⚡', n: 'Блискавка', d: 'Пройди рівень швидше ніж за 2 с', t: (s, e) => e.type === 'win' && e.time < 2 },
    { id: 'veteran', i: '🎖', n: 'Ветеран', d: 'Зроби 100 запусків', t: s => s.stats.launches >= 100 },
    { id: 'fearless', i: '💀', n: 'Безстрашний', d: 'Втрать 25 шатлів', t: s => s.stats.fails >= 25 },
    { id: 'dilation', i: '⏳', n: 'Час — гума', d: 'Проведи 20 с у сильному сповільненні часу', t: s => s.stats.dilate >= 20 },
    { id: 'half', i: '🌗', n: 'Половина неба', d: 'Збери 75 ★', t: s => stars(s) >= 75 },
    { id: 'master', i: '👑', n: 'Володар горизонту', d: 'Збери всі 150 ★', t: s => stars(s) >= 150 },
    { id: 'scholar', i: '📖', n: 'Науковець', d: 'Відкрий 25 фактів у Кодексі', t: s => Object.keys(s.facts || {}).length >= 25 },
  ];
  for (const a of ACH) if (!a.id.startsWith('sec') || a.id === 'sector30') { const n0 = a.n, d0 = a.d; Object.defineProperty(a, 'n', { get: () => window.I18N ? T('a.' + a.id + '.n') : n0 }); Object.defineProperty(a, 'd', { get: () => window.I18N ? T('a.' + a.id + '.d') : d0 }); }
  function ensure(s) {
    s.achv = s.achv || {};
    s.stats = Object.assign({ launches: 0, flight: 0, play: 0, wins: 0, fails: 0, deaths: {}, bonus: 0, bounces: 0, worms: 0, flips: 0, breaks: 0, puUsed: 0, shields: 0, dilate: 0, restarts: 0 }, s.stats || {});
    return s;
  }
  function check(s, ev) { const out = []; for (const a of ACH) if (!s.achv[a.id]) { let ok = false; try { ok = a.t(s, ev || { type: 'event' }); } catch (e) {} if (ok) { s.achv[a.id] = Date.now(); out.push(a); } } return out; }
  return { RANKS, ACH, rank, stars, score, secStars, ensure, check, setCatalog(c) { cat = c; } };
})();
