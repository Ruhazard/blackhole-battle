/* Blackhole Battle — data-driven sector catalog (scales to 50 sectors / 500 levels).
   Real sectors take consecutive levels from BH3_LEVELS in order; level ids are stable: `${sector.id}-${NN}`.
   unlock: { after: sectorId }  -> opens when that sector's last level (boss) is beaten
           { stars: N }         -> opens at N total stars
           {}                   -> open from the start
   soon: true -> shown as a locked "coming soon" sector (no levels yet). Add new levels by appending to the level data and
   flipping a sector from soon to count: N — no code changes needed. */
window.BH_SECTORS = [
  { id: 'kepler', n: 'Пояс Кеплера', d: 'Сила, точність, одна діра, гальмо', c: '#7c3aed', pal: 0, count: 10, unlock: {} },
  { id: 'giant', n: 'Місяці Гіганта', d: 'Рухомі місяці, таймінг, рикошети', c: '#0ea5e9', pal: 1, count: 10, unlock: { after: 'kepler' } },
  { id: 'magnetar', n: 'Магнітар', d: 'Полярні магніти, білі діри, вітер і ліфти', c: '#db2777', pal: 2, count: 10, unlock: { after: 'giant' } },
  { id: 'wormholes', n: 'Кротові нори', d: 'Нори, ворота й ключі, ламані маршрути', c: '#10b981', pal: 3, count: 10, unlock: { after: 'magnetar' } },
  { id: 'horizon', n: 'Горизонт подій', d: 'Усе разом: пульсари й подвійні діри', c: '#ea580c', pal: 4, count: 10, unlock: { after: 'wormholes' } },
  { id: 'orion', n: 'Туманність Оріона', d: 'Скоро: газові хмари, що гальмують шатл', c: '#a855f7', pal: 0, soon: true, unlock: { after: 'horizon' } },
  { id: 'pulsarwind', n: 'Пульсарний вітер', d: 'Скоро: ритмічні гравітаційні хвилі', c: '#22d3ee', pal: 1, soon: true, unlock: { after: 'orion' } },
  { id: 'quasar', n: 'Квазар', d: 'Скоро: струмені плазми й надмасивна діра', c: '#f43f5e', pal: 4, soon: true, unlock: { after: 'pulsarwind' } },
];
window.BHCat = (() => {
  'use strict';
  function build(levels, list) {
    let sectors = (list || window.BH_SECTORS).map(s => Object.assign({}, s));
    const m = /[?&]sectors=(\d+)/.exec(typeof location !== 'undefined' ? location.search : ''); // debug: pad catalog to N sectors
    if (m) for (let k = sectors.length; k < Math.min(50, +m[1]); k++) sectors.push({ id: 'test' + k, n: `Сектор ${k + 1}`, d: 'Скоро', c: '#64748b', pal: k % 5, soon: true, unlock: { after: sectors[k - 1].id } });
    const idOf = [], secOf = [], index = {}; let at = 0;
    sectors.forEach((s, k) => {
      s.k = k; s.idx = []; s.ids = [];
      if (s.soon) return;
      const n = Math.min(s.count || 10, levels.length - at);
      for (let j = 0; j < n; j++) { const id = `${s.id}-${String(j + 1).padStart(2, '0')}`; idOf[at] = id; secOf[at] = k; index[id] = at; s.idx.push(at); s.ids.push(id); at++; }
      if (!n) s.soon = true;
    });
    const byId = {}; sectors.forEach(s => byId[s.id] = s);
    const stars = sv => Object.values(sv.best).reduce((a, b) => a + (b.s || 0), 0);
    function sectorOpen(sv, k) { const s = sectors[k]; if (!s || s.soon) return false; if (s.ids.some(id => sv.open[id] || sv.best[id])) return true;
      const u = s.unlock || {}; if (u.after) { const p = byId[u.after]; if (!p || !p.ids.length || !sv.best[p.ids[p.ids.length - 1]]) return false; }
      if (u.stars && stars(sv) < u.stars) return false; return true; }
    function levelOpen(sv, i) { const id = idOf[i]; if (!id) return false; if (sv.open[id] || sv.best[id]) return true; const s = sectors[secOf[i]]; return s.idx[0] === i && sectorOpen(sv, s.k); }
    function lockText(s) { const I = typeof window !== 'undefined' && window.I18N, T = (k, v, f) => I ? I.t(k, v) : f;
             if (s.soon) return T('sec.soonText', null, 'Скоро'); const u = s.unlock || {}; const t = [];
             if (u.after) { const p = byId[u.after]; const n = I ? I.secName(p) : p.n; t.push(T('sec.lockBoss', { n }, `переможи боса «${n}»`)); }
             if (u.stars) t.push(T('sec.lockStars', { n: u.stars }, `збери ${u.stars} ★`)); return t.length ? T('sec.lock', { t: t.join(', ') }, 'Щоб відкрити: ' + t.join(', ')) : ''; }
    function migrate(sv) { // v1 (index-keyed) -> v2 (id-keyed)
      if (sv.v >= 2) { sv.open = sv.open || {}; return false; }
      const nb = {}; for (const k in sv.best || {}) { const id = /^\d+$/.test(k) ? idOf[+k] : k; if (id) nb[id] = sv.best[k]; } sv.best = nb;
      sv.open = sv.open || {}; for (let i = 0; i < Math.min(sv.unlocked || 1, idOf.length); i++) sv.open[idOf[i]] = 1;
      for (const k of Object.keys(sv.ach || {})) { const mm = /^boss(\d+)$/.exec(k); if (mm) { if (idOf[+mm[1]]) sv.ach['boss:' + idOf[+mm[1]]] = sv.ach[k]; delete sv.ach[k]; } }
      delete sv.unlocked; sv.v = 2; return true;
    }
    return { sectors, idOf, secOf, index, byId, real: sectors.filter(s => !s.soon), maxStars: idOf.length * 3, sectorOpen, levelOpen, lockText, migrate,
      nextIndex: i => (i + 1 < idOf.length ? i + 1 : null) };
  }
  return { build };
})();
if (typeof module !== 'undefined') module.exports = window.BHCat;
