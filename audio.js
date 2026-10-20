/* Blackhole Battle v3.1.9 — procedural WebAudio sound (no samples; everything synthesized at runtime) */
window.BHAudio = (() => {
  'use strict';
  let ac = null, comp, master, musBus, sfxBus, musPre, musDuck, sfxPre, echoIn, noiseBuf = null;
  let set = { snd: true, sfx: 80, mus: 60, musOn: true, ship: 'shuttle' }; let eng = null, lastSet = { aim: null, launch: null, brake: null, fly: null, win: null };
  const shipKind = () => set.ship === 'roadster' ? 'roadster' : 'shuttle';
  // live-source accounting (debug/e2e): every oscillator / buffer source made by O()/noise() counts until its 'ended' fires
  let liveSrc = 0, madeSrc = 0, offline = false, inMus = 0; const track = s => { if (offline || inMus) return s; liveSrc++; madeSrc++; s.addEventListener('ended', () => { liveSrc--; try { s.disconnect(); } catch (e) {} }); return s; };
  let tension = null, hum = null, rumble = null, prox = 0, tfNow = 1, aiming = false;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const now = () => ac.currentTime;

  function makeIR(sec, decay) {
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function noise() {
    if (!noiseBuf) { const n = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return track(s);
  }
  function G(v) { const g = ac.createGain(); g.gain.value = v == null ? 1 : v; return g; }
  function F(type, f, q) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
  function O(type, f) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; return track(o); }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

  function build() {
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = G(0); comp.connect(master); master.connect(ac.destination);
    musBus = G(0); sfxBus = G(0); musBus.connect(comp); sfxBus.connect(comp);
    // music chain: musPre -> dry + big reverb -> musDuck -> musBus
    musDuck = G(1); musDuck.connect(musBus); musPre = G(1); musPre.connect(musDuck);
    const revM = ac.createConvolver(); revM.buffer = makeIR(4.5, 2.6); const revMG = G(0.55); musPre.connect(revM); revM.connect(revMG); revMG.connect(musDuck);
    // sfx chain: sfxPre -> dry + short room; echo bus for bounces/chimes
    sfxPre = G(1); sfxPre.connect(sfxBus);
    const revS = ac.createConvolver(); revS.buffer = makeIR(1.8, 3); const revSG = G(0.22); sfxPre.connect(revS); revS.connect(revSG); revSG.connect(sfxBus);
    echoIn = G(1); const dl = ac.createDelay(1.5); dl.delayTime.value = 0.21; const fb = G(0.38); const eLp = F('lowpass', 2600); echoIn.connect(dl); dl.connect(eLp); eLp.connect(fb); fb.connect(dl); eLp.connect(sfxBus); echoIn.connect(sfxPre);
    M(startMusic)(); startLoops(); apply();
  }
  // ---------- music (v3.1.5): generative, per-sector themes ----------
  // A pure Composer (no WebAudio; testable in node) emits note events chord by chord; the renderer below turns them into synth voices.
  const MODES = { ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10] };
  // inst: layers that rotate in/out; start: layers on at the beginning; mel: instrument that carries melody phrases; tone: timbre tweaks
  const THEMES = {
    menu:      { root: 50, mode: 'lydian',     bpm: 56, inst: ['pad', 'choir', 'bell', 'strings', 'mel'], start: ['pad', 'bell'], mel: 'bell',  tone: { pad: 'triangle', lp: 900,  bright: .8 } },
    kepler:    { root: 45, mode: 'dorian',     bpm: 72, inst: ['pad', 'pluck', 'arp', 'bell', 'strings', 'mel'], start: ['pad', 'pluck'], mel: 'pluck', tone: { pad: 'sawtooth', lp: 750, bright: 1 } },
    giant:     { root: 43, mode: 'ionian',     bpm: 64, inst: ['pad', 'bell', 'arp', 'choir', 'strings', 'mel'], start: ['strings', 'bell'], mel: 'bell', tone: { pad: 'triangle', lp: 1100, bright: 1.1 } },
    magnetar:  { root: 41, mode: 'aeolian',    bpm: 80, inst: ['pluck', 'arp', 'pad', 'strings', 'bell', 'mel'], start: ['arp', 'pad'], mel: 'pluck', tone: { pad: 'sawtooth', lp: 650, bright: .9 } },
    wormholes: { root: 48, mode: 'mixolydian', bpm: 68, inst: ['pad', 'bell', 'pluck', 'choir', 'arp', 'mel'], start: ['pad', 'choir'], mel: 'choir', tone: { pad: 'triangle', lp: 1000, bright: 1 } },
    horizon:   { root: 40, mode: 'phrygian',   bpm: 54, inst: ['strings', 'choir', 'pad', 'bell', 'mel'], start: ['strings', 'pad'], mel: 'choir', tone: { pad: 'sawtooth', lp: 600, bright: .75 } },
  };
  const THEME_IDS = ['kepler', 'giant', 'magnetar', 'wormholes', 'horizon'];
  const NEXT = { 0: [3, 4, 5, 1, 2, 5, 3], 1: [4, 6, 3, 0], 2: [5, 3, 0, 1], 3: [0, 4, 1, 5, 6], 4: [0, 5, 3, 2], 5: [3, 1, 4, 0, 2], 6: [0, 2, 5, 3] };
  function Composer(name, rnd) {
    const th = THEMES[name] || THEMES.menu; rnd = rnd || Math.random;
    const sc = MODES[th.mode], beat = 60 / th.bpm, bar = beat * 4;
    const pitch = d => th.root + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const pick = a => a[Math.floor(rnd() * a.length)];
    const okDeg = d => pitch(d + 4) - pitch(d) === 7;                         // perfect fifth: skip diminished chords
    let deg = 0, prev = [], clock = 0, nextLay = 18 + rnd() * 16, phraseCool = 1, phraseN = 0, motif = newMotif(), lastChangeAt = 0;
    const lay = {}; th.inst.forEach(k => lay[k] = { on: th.start.includes(k), off: -99 });
    function newMotif() { const n = 4 + Math.floor(rnd() * 3), m = []; let s = 0; for (let i = 0; i < n; i++) { m.push({ s, d: pick([.5, .5, 1, 1, 1.5, 2]) }); s += pick([-2, -1, -1, 1, 1, 2, 3, 0]); } return m; }
    function mutate(m) { m = m.map(o => ({ ...o })); const i = Math.floor(rnd() * m.length); if (rnd() < .5) m[i].s += pick([-1, 1, 2, -2]); else m[i].d = pick([.5, 1, 1.5, 2]); return m; }
    function vary(m) { let v = m.map(o => ({ ...o })); const op = rnd();
      if (op < .2) v = v.map(o => ({ ...o, s: -o.s }));                                         // inversion
      else if (op < .35) { const s = v.map(o => o.s).reverse(); v = v.map((o, i) => ({ ...o, s: s[i] })); } // retrograde pitches
      else if (op < .5) v = v.map(o => ({ ...o, d: o.d * 2 }));                                 // augmentation
      else if (op < .62) v = v.slice(0, Math.max(2, v.length - 2));                              // truncation
      else if (op < .74) { const i = 1 + Math.floor(rnd() * (v.length - 1)); v.splice(i, 0, { s: (v[i - 1].s + v[Math.min(i, v.length - 1)].s) >> 1, d: .5 }); } // passing note
      if (rnd() < .3) v[Math.floor(rnd() * v.length)].rest = 1;                                 // breathe inside the phrase
      return v; }
    const layersOn = () => th.inst.filter(k => lay[k].on);
    function rotate() { const on = layersOn(), offL = th.inst.filter(k => !lay[k].on);
      const add = on.length <= 1 || (on.length < 3 && rnd() < .6) || !on.length;
      const melBack = lay.mel && !lay.mel.on && clock - lay.mel.off > 50 && on.length < 4; // melody never stays away for long
      const k = melBack ? 'mel' : add ? pick(offL) : pick(on.filter(x => x !== 'mel' || rnd() < .5));
      if (!k) return; if (lay[k].on) { lay[k].on = false; lay[k].off = clock; } else lay[k].on = true; lastChangeAt = clock; }
    function next() {
      if (clock >= nextLay) { rotate(); if (rnd() < .35) rotate(); nextLay = clock + 20 + rnd() * 20; }
      let c = NEXT[deg].filter(d => okDeg(d) && !prev.slice(-2).includes(d)); if (!c.length) c = [0]; deg = pick(c); prev.push(deg); if (prev.length > 8) prev.shift();
      const bars = rnd() < .4 ? 2 : 1, dur = bars * bar, r = rnd(), hush = r < .06, rest = !hush && r < .2;
      const degs = [deg, rnd() < .15 ? deg + 1 : deg + 2, deg + 4]; if (rnd() < .3) degs.push(deg + 6);
      const ev = [], E = (inst, t, m, d, v, mel) => { if (t < dur) ev.push(mel ? { inst, t, m, d, v, mel: 1 } : { inst, t, m, d, v }); };
      const live = k => lay[k] && (lay[k].on || clock - lay[k].off < 8);                        // fading-out layers keep playing briefly
      if (hush) { if (rnd() < .6) degs.slice(0, 3).forEach(d => E('pad', 0, pitch(d) + 12, dur + 1, .25)); }
      else {
        if (live('pad')) degs.forEach(d => E('pad', 0, pitch(d) + 12, dur + 1.5, .7 + rnd() * .3));
        if (live('strings')) { E('strings', 0, pitch(deg) - 12, dur + 1, .9); E('strings', beat * (rnd() < .5 ? 0 : 1), pitch(deg + 4) - 12, dur, .6); }
        if (live('choir')) [deg + 2, deg + 4, deg + 7].forEach(d => E('choir', rnd() * beat, pitch(d) + 12, dur * .9, .7));
        if (!rest) {
          if (live('arp')) { const tones = []; degs.forEach(d => { tones.push(pitch(d) + 12, pitch(d) + 24); }); tones.sort((a, b) => a - b);
            const pat = pick(['up', 'down', 'updown', 'rand']), half = rnd() < .4; let i = 0;
            for (let t = half ? dur / 2 : 0; t < dur - .01; t += beat / 2, i++) { if (rnd() < .22) continue; const n = tones.length;
              const j = pat === 'up' ? i % n : pat === 'down' ? n - 1 - i % n : pat === 'updown' ? (i % (2 * n - 2) < n ? i % (2 * n - 2) : 2 * n - 2 - i % (2 * n - 2)) : Math.floor(rnd() * n);
              E('arp', t, tones[j], beat * .9, .5 + rnd() * .3); } }
          if (live('pluck')) { const rh = pick([[0, 1.5, 2.5], [0, 2], [0, .75, 1.5, 3], [1, 2.5], [0, 3]]);
            for (let b = 0; b < bars; b++) rh.forEach(x => { if (rnd() < .85) E('pluck', (b * 4 + x) * beat, pitch(pick(degs)) + pick([12, 24]), beat * 1.5, .6 + rnd() * .3); }); }
          if (live('bell')) { const n = 1 + (rnd() < .4); for (let k = 0; k < n; k++) E('bell', Math.floor(rnd() * bars * 4) * beat, pitch(pick(degs)) + pick([24, 36]), 3.5, .55 + rnd() * .3); }
          if (live('mel') && --phraseCool <= 0) {
            phraseN++; if (phraseN % 3 === 0) motif = mutate(motif); if (phraseN % 14 === 0) motif = newMotif();
            const v = vary(motif), oct = th.mel === 'choir' ? 12 : 24; let t = pick([0, beat, beat * 2]);
            const base = deg + pick([0, 2, 4]);
            for (const o of v) { if (!o.rest) E(th.mel, t, pitch(base + o.s) + oct, o.d * beat * 1.2, .75, 1); t += o.d * beat; }
            phraseCool = 1 + Math.floor(rnd() * 3); }
        }
      }
      const out = { t0: clock, dur, deg, degs, bars, hush, rest, layers: layersOn(), root: pitch(deg), ev };
      clock += dur; return out;
    }
    return { next, th, get clock() { return clock; } };
  }
  // ---------- renderer ----------
  let songs = [], song = null, themeName = null, thick, thickFilt, thickGain, sub, timer = null, detNow = 0, lastRoot = 45;
  const LAYER_FADE = 2.4;                                                              // time constant: ~7 s audible fade in/out
  function newSong(name) {
    const comp = Composer(name), out = G(0.0001); out.connect(musPre);
    const tone = comp.th.tone, lg = {};
    for (const k of comp.th.inst) { const g = G(comp.th.start.includes(k) ? 1 : 0.0001); g.connect(out); lg[k] = g; }
    const padLP = F('lowpass', tone.lp, 0.6); padLP.connect(lg.pad || out);
    return { name, comp, out, lg, padLP, tone, nextT: now() + 0.15, born: now(), dead: false };
  }
  function theme(name) {
    if (!ac) { themeName = name; return; } if (name === themeName && song) return; themeName = name; const t = now();
    for (const s of songs) if (!s.dead) { s.out.gain.cancelScheduledValues(t); s.out.gain.setTargetAtTime(0.0001, t, 1.1); s.dead = true; s.dieAt = t + 7; }
    const back = songs.find(s => s.dead && s.name === name);                     // switching back quickly: revive the fading song (no restart)
    if (back) { back.dead = false; back.nextT = Math.max(back.nextT, t + 0.1); song = back; } else { song = newSong(name); songs.push(song); }
    song.out.gain.cancelScheduledValues(t); song.out.gain.setTargetAtTime(1, t, 1.3);
    const dying = songs.filter(s => s.dead).sort((x, y) => x.dieAt - y.dieAt);   // rapid hopping: keep at most 2 fading songs
    while (dying.length > 2) { const s = dying.shift(); s.out.gain.setTargetAtTime(0.0001, t, 0.25); s.dieAt = Math.min(s.dieAt, t + 1.5); }
  }
  function M(f) { return function () { inMus++; try { return f.apply(null, arguments); } finally { inMus--; } }; } // music nodes are not part of the SFX live-node accounting
  function startMusic() {
    thickFilt = F('lowpass', 220, 1); thickGain = G(0.0001); thickFilt.connect(thickGain); thickGain.connect(musPre);
    thick = [O('sawtooth', mtof(lastRoot - 12)), O('sawtooth', mtof(lastRoot - 12) * 1.005)]; thick.forEach(o => { o.connect(thickFilt); o.start(); });
    sub = O('sine', mtof(lastRoot - 24)); const sg = G(0.5); sub.connect(sg); sg.connect(thickFilt); sub.start();
    theme(themeName || 'menu'); timer = setInterval(M(sched), 100);
  }
  const musAudible = () => set.snd && set.musOn !== false && set.mus > 0;
  function sched() { if (offline) return;
    if (!ac || ac.state !== 'running') return; const t = now();
    songs = songs.filter(s => { if (s.dead && t > s.dieAt) { try { s.out.disconnect(); } catch (e) {} return false; } return true; });
    for (const s of songs) {
      while (s.nextT < t + 0.5) { const ch = s.comp.next();
        if (!s.dead && musAudible()) { // silent music costs nothing: skip voice creation entirely
          for (const k in s.lg) s.lg[k].gain.setTargetAtTime(ch.layers.includes(k) ? 1 : 0.0001, s.nextT, LAYER_FADE);
          for (const e of ch.ev) voice(s, e.inst, s.nextT + e.t, e.m, e.d, e.v, e.mel);
          if (s === song) { lastRoot = ch.root; const ft = s.nextT; thick[0].frequency.setTargetAtTime(mtof(ch.root - 12), ft, 1.2); thick[1].frequency.setTargetAtTime(mtof(ch.root - 12) * 1.005, ft, 1.2); sub.frequency.setTargetAtTime(mtof(ch.root - 24), ft, 1.2); }
        }
        s.nextT += ch.dur; }
    }
  }
  function osc(type, m, t, dest, det) { const o = O(type, mtof(m)); o.detune.value = detNow + (det || 0); o.connect(dest); o.start(t); return o; }
  function voice(s, inst, t, m, d, v, mel) {
    const tone = s.tone, dest = (mel ? s.lg.mel : s.lg[inst]) || s.out;
    if (inst === 'pad') { const g = G(0); g.connect(s.padLP); const a = 1.6 + Math.random(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.032 * v, t + a); g.gain.setTargetAtTime(0.0001, t + Math.max(a, d - 1.5), 0.9);
      [-8, 7].forEach(dt => osc(tone.pad, m, t, g, dt).stop(t + d + 4)); }
    else if (inst === 'strings') { const f = F('lowpass', 520 * tone.bright, 0.7), g = G(0); f.connect(g); g.connect(dest); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 2.2); g.gain.setTargetAtTime(0.0001, t + Math.max(2.2, d - 1), 1);
      const lfo = O('sine', 4.6 + Math.random()), lg = G(7); lfo.connect(lg); lfo.start(t); lfo.stop(t + d + 5);
      [-6, 6].forEach(dt => { const o = osc('sawtooth', m, t, f, dt); lg.connect(o.detune); o.stop(t + d + 5); }); }
    else if (inst === 'choir') { const g = G(0), f1 = F('bandpass', 700, 4), f2 = F('bandpass', 1150, 5), lp = F('lowpass', 2200); f1.connect(lp); f2.connect(lp); lp.connect(g); g.connect(dest);
      const a = d < 2 ? 0.25 : 1.3; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + a); g.gain.setTargetAtTime(0.0001, t + Math.max(a, d - .4), d < 2 ? .35 : .9);
      [-11, 0, 12].forEach(dt => { const o = osc('sawtooth', m, t, f1, dt); o.connect(f2); o.stop(t + d + 4); }); }
    else if (inst === 'pluck') { const f = F('lowpass', 2800 * tone.bright, 1), g = G(0); f.connect(g); g.connect(dest); f.frequency.setValueAtTime(3200 * tone.bright, t); f.frequency.exponentialRampToValueAtTime(500, t + .5);
      env(g, t, 0.005, 0.07 * v, Math.min(1.6, d + .5)); osc('triangle', m, t, f).stop(t + 2.2); osc('sine', m + 12, t, f, 3).stop(t + 2.2); }
    else if (inst === 'bell') { const g = G(0); g.connect(dest); env(g, t, 0.01, 0.045 * v, d);
      [[1, 1], [2.76, .22], [5.4, .07]].forEach(([r, a]) => { const o = O('sine', mtof(m) * r), og = G(a); o.detune.value = detNow; o.connect(og); og.connect(g); o.start(t); o.stop(t + d + .2); }); }
    else if (inst === 'arp') { const g = G(0); g.connect(dest); env(g, t, 0.02, 0.035 * v, .45 + d * .3); osc('sine', m, t, g).stop(t + 1.2); osc('triangle', m + 12, t, g, 4).stop(t + 1.2); }
  }
  // ---------- continuous loops: engine hum, black-hole rumble ----------
  function startLoops() {
    const hf = F('lowpass', 240, 3), hg = G(0.0001); const h1 = O('sawtooth', 52), h2 = O('square', 52.7), hm = G(0.35); h1.connect(hf); h2.connect(hm); hm.connect(hf); hf.connect(hg); hg.connect(sfxPre); h1.start(); h2.start();
    hum = { f: hf, g: hg, o: [h1, h2] };
    const rn = noise(), rf = F('lowpass', 85, 0.8), rg = G(0.0001), rs = O('sine', 34), rsg = G(0.7), lfo = O('sine', 0.9), lg = G(0.35), am = G(0.65);
    rn.connect(rf); rf.connect(am); rs.connect(rsg); rsg.connect(am); lfo.connect(lg); lg.connect(am.gain); am.connect(rg); rg.connect(sfxPre); rn.start(); rs.start(); lfo.start();
    rumble = { g: rg, s: rs, lfo, f: rf };
    startShipLoops();
  }
  // ---------- v3.1.9 ship-specific engine & brake loops (persistent, gain-gated -> nothing to leak; one shared noise source) ----------
  function startShipLoops() {
    const nz = noise(); nz.start(); const E = { nz };
    // shuttle: rocket hum/whoosh = band-passed noise + low sine; 'boost' is the post-launch roar tail
    const sF = F('bandpass', 420, 0.7), sG = G(0.0001), sB = G(0.0001), sLo = O('sine', 48), sLoG = G(0.5), sLp = F('lowpass', 900, 0.5);
    nz.connect(sF); sF.connect(sLp); sLo.connect(sLoG); sLoG.connect(sLp); sLp.connect(sG); sLp.connect(sB); sG.connect(sfxPre); sB.connect(sfxPre); sLo.start();
    E.shuttle = { f: sF, g: sG, boost: sB, lo: sLo, lp: sLp };
    // roadster: light engine idle/purr = two detuned saws + pulse-ish square through a low-pass, amplitude 'chug' LFO follows rpm
    const r1 = O('sawtooth', 46), r2 = O('square', 46.4), r2g = G(0.35), rLp = F('lowpass', 520, 2.5), rAm = G(0.7), rLfo = O('sine', 11), rLg = G(0.3), rG = G(0.0001), rB = G(0.0001);
    r1.connect(rLp); r2.connect(r2g); r2g.connect(rLp); rLp.connect(rAm); rLfo.connect(rLg); rLg.connect(rAm.gain); rAm.connect(rG); rAm.connect(rB); rG.connect(sfxPre); rB.connect(sfxPre); r1.start(); r2.start(); rLfo.start();
    E.roadster = { o: [r1, r2], lp: rLp, lfo: rLfo, g: rG, boost: rB };
    // shuttle brake: retro-thruster bursts = noise band-pass gated by a fast square LFO
    const bF = F('bandpass', 850, 0.8), bAm = G(0.5), bL = O('square', 9), bLg = G(0.5), bG = G(0.0001);
    nz.connect(bF); bF.connect(bAm); bL.connect(bLg); bLg.connect(bAm.gain); bAm.connect(bG); bG.connect(sfxPre); bL.start();
    E.retro = { g: bG, lfo: bL };
    // roadster brake: playful tire-screech (narrow noise band + wobbling sine) + air-brake hiss
    const tF = F('bandpass', 2300, 14), tS = O('triangle', 1850), tSg = G(0.18), tV = O('sine', 7), tVg = G(40), hF = F('highpass', 4200, 0.7), hG = G(0.5), tG = G(0.0001);
    nz.connect(tF); tF.connect(tG); tV.connect(tVg); tVg.connect(tS.frequency); tVg.connect(tF.frequency); tS.connect(tSg); tSg.connect(tG); nz.connect(hF); hF.connect(hG); hG.connect(tG); tG.connect(sfxPre); tS.start(); tV.start();
    E.screech = { g: tG, s: tS };
    eng = E;
  }
  // st: {fly, speed, prox (0..1), tf, aiming}
  // v3.1.9: render an SFX script offline (OfflineAudioContext) — used to export WAV samples & by e2e. script: [[time, fnName, args?], ...]
  async function renderOffline(script, dur, rate) {
    rate = rate || 44100; const keep = { ac, comp, master, musBus, sfxBus, musPre, musDuck, sfxPre, echoIn, noiseBuf, tension, hum, rumble, eng, thickGain, thickFilt, aiming, set: Object.assign({}, set), u: [update.t, update.a, update.b], live: liveSrc };
    const oc = new OfflineAudioContext(2, Math.ceil(dur * rate), rate); ac = oc; offline = true; noiseBuf = null; tension = null; for (const st of script) if (st[0] <= 0 && st[1] === 'configure') Object.assign(set, st[2]); update.t = -1; update.a = update.b = undefined;
    try {
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
      master = G(set.snd ? 0.9 : 0); comp.connect(master); master.connect(ac.destination); musBus = G(0); sfxBus = G(Math.pow(set.sfx / 100, 2) * 1.1); sfxBus.connect(comp);
      musDuck = G(1); musPre = G(1); thickGain = G(0); thickFilt = F('lowpass', 200);
      sfxPre = G(1); sfxPre.connect(sfxBus); const revS = ac.createConvolver(); revS.buffer = makeIR(1.8, 3); const revSG = G(0.22); sfxPre.connect(revS); revS.connect(revSG); revSG.connect(sfxBus);
      echoIn = G(1); const dl = ac.createDelay(1.5); dl.delayTime.value = 0.21; const fb = G(0.38); const eLp = F('lowpass', 2600); echoIn.connect(dl); dl.connect(eLp); eLp.connect(fb); fb.connect(dl); eLp.connect(sfxBus); echoIn.connect(sfxPre);
      startLoops();
      const api = { configure, update, aimStart, aimPower, aimEnd, launch, bounce, star, win, lose, magnet, key, worm, stop, crash, shield, click, ach };
      const run = st => { const a = st[2]; api[st[1]].apply(null, Array.isArray(a) ? a : a === undefined ? [] : [a]); };
      const byT = new Map(); for (const st of script) { const q = Math.round(st[0] * rate / 128) * 128 / rate; if (!byT.has(q)) byT.set(q, []); byT.get(q).push(st); }
      for (const [q, list] of byT) { if (q <= 0) list.forEach(run); else oc.suspend(q).then(() => { try { list.forEach(run); } catch (e) { console.warn('renderOffline', e); } oc.resume(); }); }
      const buf = await oc.startRendering(); return buf;
    } finally {
      ({ ac, comp, master, musBus, sfxBus, musPre, musDuck, sfxPre, echoIn, noiseBuf, tension, hum, rumble, eng, thickGain, thickFilt, aiming } = keep); set = keep.set; [update.t, update.a, update.b] = keep.u; offline = false;
    }
  }
  function update(st) {
    if (!ac) return; const t = now(); tfNow = st.tf == null ? 1 : st.tf; prox = st.prox || 0; const brk = !!(st.fly && st.braking); if (st.aiming === update.a && brk === update.b && t - (update.t || 0) < 0.05) return; update.t = t; update.a = st.aiming; update.b = brk;
    musDuck.gain.setTargetAtTime(st.aiming ? 0.42 : 1, t, 0.18);
    // near holes: a subtle low drone on the current chord root (was much louder before 3.1.5)
    thickGain.gain.setTargetAtTime(Math.pow(prox, 1.5) * 0.13, t, 0.6); thickFilt.frequency.setTargetAtTime(180 + prox * 260, t, 0.6);
    detNow = -(1 - tfNow) * 110;                                   // time-stretch feel: new notes detune down as time dilates
    const sp = st.fly ? Math.min(1, (st.speed || 0) / 520) : 0;
    hum.g.gain.setTargetAtTime(st.fly ? 0.012 + sp * 0.03 : 0.0001, t, 0.08); // generic hull hum, now mostly carried by the ship loops below
    if (eng) { const k = shipKind(), sh = eng.shuttle, rd = eng.roadster;
      sh.g.gain.setTargetAtTime(st.fly && k === 'shuttle' ? 0.05 + sp * 0.11 : 0.0001, t, 0.12); sh.f.frequency.setTargetAtTime(300 + sp * 900, t, 0.1); sh.lo.frequency.setTargetAtTime(42 + sp * 30, t, 0.1);
      rd.g.gain.setTargetAtTime(st.fly && k === 'roadster' ? 0.035 + sp * 0.06 : 0.0001, t, 0.12); const rpm = 40 + sp * 60; rd.o[0].frequency.setTargetAtTime(rpm, t, 0.08); rd.o[1].frequency.setTargetAtTime(rpm * 1.008, t, 0.08);
      rd.lp.frequency.setTargetAtTime(380 + sp * 1100, t, 0.1); rd.lfo.frequency.setTargetAtTime(rpm / 4, t, 0.1);
      eng.retro.g.gain.setTargetAtTime(brk && k === 'shuttle' ? 0.32 : 0.0001, t, brk ? 0.02 : 0.06); eng.screech.g.gain.setTargetAtTime(brk && k === 'roadster' ? 0.07 : 0.0001, t, brk ? 0.03 : 0.08);
      if (st.fly) lastSet.fly = k; if (brk) lastSet.brake = k; }
     hum.o[0].frequency.setTargetAtTime(44 + sp * 70, t, 0.06); hum.o[1].frequency.setTargetAtTime(44.6 + sp * 71, t, 0.06); hum.f.frequency.setTargetAtTime(160 + sp * 900, t, 0.06);
    rumble.g.gain.setTargetAtTime(Math.pow(prox, 1.6) * 0.6, t, 0.12); rumble.s.frequency.setTargetAtTime(22 + 14 * tfNow, t, 0.2); rumble.lfo.frequency.setTargetAtTime(0.5 + 2.6 * prox * tfNow, t, 0.2);
  }
  // ---------- one-shot SFX (scheduled at currentTime for tight timing) ----------
  function aimStart() { if (!ac || tension) return; lastSet.aim = shipKind(); if (shipKind() === 'roadster') return revStart(); const t = now(); const o = O('sawtooth', 90), o2 = O('sine', 135), f = F('lowpass', 420, 4), g = G(0.0001), vib = O('sine', 3), vg = G(4);
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency); o.connect(f); o2.connect(f); f.connect(g); g.connect(sfxPre); o.start(t); o2.start(t); vib.start(t); g.gain.setTargetAtTime(0.03, t, 0.05); tension = { o, o2, f, g, vib }; aiming = true; }
  function aimPower(pct) { if (!tension) return; const t = now(), k = pct / 100; if (tension.rev) return revPower(k); tension.o.frequency.setTargetAtTime(80 + k * 340, t, 0.04); tension.o2.frequency.setTargetAtTime(120 + k * 510, t, 0.04); tension.f.frequency.setTargetAtTime(380 + k * 2600, t, 0.05); tension.g.gain.setTargetAtTime(0.025 + k * 0.06, t, 0.05); tension.vib.frequency.setTargetAtTime(3 + k * 9, t, 0.1); }
  function aimEnd() { if (!tension) return; const t = now(), T = tension; T.g.gain.setTargetAtTime(0.0001, t, 0.03); (T.rev ? T.os : [T.o, T.o2, T.vib]).forEach(o => o.stop(t + 0.2)); tension = null; aiming = false; }
  // roadster aim: engine revving with drag length (rpm, filter and 'chug' rate rise with pull)
  function revStart() { const t = now(), o1 = O('sawtooth', 42), o2 = O('square', 42.3), o2g = G(0.3), f = F('lowpass', 420, 3), am = G(0.65), lfo = O('sine', 10), lg = G(0.35), g = G(0.0001);
    o1.connect(f); o2.connect(o2g); o2g.connect(f); f.connect(am); lfo.connect(lg); lg.connect(am.gain); am.connect(g); g.connect(sfxPre); o1.start(t); o2.start(t); lfo.start(t); g.gain.setTargetAtTime(0.05, t, 0.05);
    tension = { rev: true, os: [o1, o2, lfo], o1, o2, f, lfo, g }; aiming = true; }
  function revPower(k) { const t = now(), T = tension, rpm = 42 + k * 120; T.o1.frequency.setTargetAtTime(rpm, t, 0.05); T.o2.frequency.setTargetAtTime(rpm * 1.007, t, 0.05); T.f.frequency.setTargetAtTime(420 + k * 2200, t, 0.06); T.lfo.frequency.setTargetAtTime(rpm / 4, t, 0.05); T.g.gain.setTargetAtTime(0.05 + k * 0.07, t, 0.05); }
  function launch(pct) { if (!ac) return; aimEnd(); const k = shipKind(); lastSet.launch = k; (k === 'roadster' ? launchRoadster : launchShuttle)(pct || 50); }
  // shuttle: ignition crackle + deep roaring thrust burst (filtered noise sweep + low rumble), scaled by launch power; leaves a fading rocket roar on the engine loop
  function launchShuttle(pct) { const t = now(), k = 0.45 + pct / 180;
    const cn = noise(), cf = F('highpass', 2600, 0.7), cg = G(0); cn.connect(cf); cf.connect(cg); cg.connect(sfxPre); cg.gain.setValueAtTime(0, t);
    for (let i = 0; i < 7; i++) { const tt = t + i * 0.018 + Math.random() * 0.01, a = (0.18 + Math.random() * 0.12) * k; cg.gain.setValueAtTime(a, tt); cg.gain.exponentialRampToValueAtTime(0.0005, tt + 0.012); } cn.start(t); cn.stop(t + 0.2);
    const n = noise(), lp = F('lowpass', 300, 0.9), g = G(0); n.connect(lp); lp.connect(g); g.connect(sfxPre); lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(1400 + pct * 18, t + 0.12); lp.frequency.exponentialRampToValueAtTime(220, t + 1.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42 * k, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); n.start(t); n.stop(t + 1.3);
    const s = O('sine', 70), sg = G(0); s.connect(sg); sg.connect(sfxPre); s.frequency.setValueAtTime(78 + pct * 0.3, t); s.frequency.exponentialRampToValueAtTime(32, t + 0.9); env(sg, t, 0.01, 0.7 * k, 0.9); s.start(t); s.stop(t + 1.0);
    if (eng) { const b = eng.shuttle.boost.gain; b.cancelScheduledValues(t); b.setValueAtTime(0.0001, t); b.linearRampToValueAtTime(0.12 * k, t + 0.25); b.setTargetAtTime(0.0001, t + 0.3, 0.6); } }
  // roadster: starter + short playful 'vroom' (saw/square through an opening filter, rpm rising with power) + cold-gas hiss for the puffs
  function launchRoadster(pct) { const t = now(), k = 0.45 + pct / 180, top = 95 + pct * 1.4;
    const st = O('square', 38), stf = F('lowpass', 600), sam = G(0.5), stg = G(0); st.connect(stf); stf.connect(sam); sam.connect(stg); stg.connect(sfxPre); const sl = O('square', 18), slg = G(0.5); sl.connect(slg); slg.connect(sam.gain); env(stg, t, 0.005, 0.12, 0.16); sl.start(t); st.start(t); st.stop(t + 0.2); sl.stop(t + 0.2);
    const t1 = t + 0.1, f = F('lowpass', 500, 4), g = G(0); f.connect(g); g.connect(sfxPre);
    for (const [type, m, a] of [['sawtooth', 1, 1], ['square', 1.005, 0.45], ['sawtooth', 2.01, 0.25]]) { const o = O(type, 60 * m), og = G(a); o.connect(og); og.connect(f);
      o.frequency.setValueAtTime(55 * m, t1); o.frequency.exponentialRampToValueAtTime(top * m, t1 + 0.22); o.frequency.exponentialRampToValueAtTime(top * 0.72 * m, t1 + 0.6); o.start(t1); o.stop(t1 + 0.85); }
    f.frequency.setValueAtTime(420, t1); f.frequency.exponentialRampToValueAtTime(1200 + pct * 22, t1 + 0.2); f.frequency.exponentialRampToValueAtTime(500, t1 + 0.75);
    g.gain.setValueAtTime(0.0001, t1); g.gain.linearRampToValueAtTime(0.13 * k, t1 + 0.04); g.gain.setTargetAtTime(0.085 * k, t1 + 0.25, 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.8);
    const n = noise(), hf = F('highpass', 3200, 0.6), hg = G(0); n.connect(hf); hf.connect(hg); hg.connect(sfxPre); env(hg, t, 0.01, 0.12 * k, 0.5); n.start(t); n.stop(t + 0.6);
    if (eng) { const b = eng.roadster.boost.gain; b.cancelScheduledValues(t); b.setValueAtTime(0.0001, t); b.linearRampToValueAtTime(0.05 * k, t1 + 0.3); b.setTargetAtTime(0.0001, t1 + 0.4, 0.5); } }
  // roadster win: friendly dual-tone horn beep-beep
  function horn(t0) { const f = F('lowpass', 2200, 0.8), g = G(0); f.connect(g); g.connect(sfxPre);
    for (const [tt, d] of [[t0, 0.12], [t0 + 0.19, 0.2]]) { for (const fr of [415, 523]) { const o = O('square', fr), og = G(0.5); o.connect(og); og.connect(f); o.start(tt); o.stop(tt + d + 0.03); }
      g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.06, tt + 0.012); g.gain.setValueAtTime(0.06, tt + d - 0.02); g.gain.linearRampToValueAtTime(0.0001, tt + d); } }
  function bounce() { if (!ac) return; const t = now(), f0 = 170 + Math.random() * 60;
    [[1, 0.6, 0.22], [2.76, 0.42, 0.14], [5.4, 0.26, 0.09], [8.93, 0.16, 0.06]].forEach(([m, d, a]) => { const o = O('sine', f0 * m), g = G(0); o.connect(g); g.connect(echoIn); env(g, t, 0.002, a, d); o.start(t); o.stop(t + d + 0.05); });
    const b = O('sine', 75), bg = G(0); b.connect(bg); bg.connect(echoIn); b.frequency.setValueAtTime(90, t); b.frequency.exponentialRampToValueAtTime(38, t + 0.4); env(bg, t, 0.003, 0.7, 0.45); b.start(t); b.stop(t + 0.5); }
  const STAR_STEPS = [0, 3, 5, 7, 10, 12, 15];
  function star(n) { if (!ac) return; const t = now(), f = 659.25 * Math.pow(2, STAR_STEPS[Math.max(0, Math.min(6, n - 1))] / 12);
    [[1, 0.22, 1.3], [2.005, 0.08, 0.8], [3.01, 0.04, 0.5], [4.2, 0.02, 0.3]].forEach(([m, a, d]) => { const o = O('sine', f * m), g = G(0); o.connect(g); g.connect(echoIn); env(g, t, 0.004, a, d); o.start(t); o.stop(t + d + 0.05); }); }
  function phrase(notes, step, type, gain, dur, lp) { const t = now(); const f = F('lowpass', lp || 4000); f.connect(sfxPre);
    notes.forEach((m, i) => { const tt = t + i * step; for (const dt of [-5, 5]) { const o = O(type, mtof(m)); o.detune.value = dt; const g = G(0); o.connect(g); g.connect(f); env(g, tt, 0.02, gain, dur); o.start(tt); o.stop(tt + dur + 0.1); } }); }
  function win(stars) { if (!ac) return; const n = [69, 73, 76, 81]; if (stars >= 2) n.push(83); if (stars >= 3) n.push(88); phrase(n, 0.11, 'triangle', 0.07, 1.4); lastSet.win = shipKind(); if (shipKind() === 'roadster') horn(now() + 0.75); }
  function lose() { if (!ac) return; phrase([64, 62, 60, 55], 0.17, 'triangle', 0.07, 1.1, 1400);
    const t = now(), n = noise(), f = F('lowpass', 400), g = G(0); n.connect(f); f.connect(g); g.connect(sfxPre); f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(60, t + 0.8); env(g, t, 0.005, 0.5, 0.8); n.start(t); n.stop(t + 0.9); }
  function blip(f1, f2, d, a, type) { if (!ac) return; const t = now(), o = O(type || 'sine', f1), g = G(0); o.connect(g); g.connect(sfxPre); o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d); env(g, t, 0.003, a, d); o.start(t); o.stop(t + d + 0.05); }
  function magnet(pol) { blip(pol > 0 ? 420 : 780, pol > 0 ? 780 : 420, 0.12, 0.12, 'square'); setTimeout(() => blip(pol > 0 ? 620 : 980, pol > 0 ? 980 : 620, 0.08, 0.06), 70); }
  function key() { if (!ac) return; [0, 4, 7].forEach((s, i) => setTimeout(() => star(1 + i * 2), i * 70)); }
  function worm() { if (!ac) return; const t = now(), n = noise(), f = F('bandpass', 300, 8), g = G(0); n.connect(f); f.connect(g); g.connect(echoIn); f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(3500, t + 0.45); env(g, t, 0.02, 0.5, 0.5); n.start(t); n.stop(t + 0.6); blip(200, 900, 0.4, 0.08, 'triangle'); }
  function stop() { if (!ac) return; blip(160, 60, 0.25, 0.35); const t = now(), n = noise(), f = F('highpass', 2500), g = G(0); n.connect(f); f.connect(g); g.connect(sfxPre); env(g, t, 0.01, 0.08, 0.35); n.start(t); n.stop(t + 0.4); }
  function crash() { if (!ac) return; const t = now(), n = noise(), f = F('lowpass', 1800), g = G(0); n.connect(f); f.connect(g); g.connect(echoIn); f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(150, t + 0.5); env(g, t, 0.003, 0.55, 0.55); n.start(t); n.stop(t + 0.6); blip(110, 40, 0.3, 0.5); }
  function shield() { if (!ac) return; [1, 1.5, 2.25].forEach((m, i) => setTimeout(() => blip(700 * m, 1100 * m, 0.25, 0.06, 'triangle'), i * 40)); bounce(); }
  function click() { blip(1400, 900, 0.035, 0.05, 'triangle'); }
  function ach() { if (!ac) return; phrase([76, 81, 85, 88], 0.08, 'sine', 0.06, 0.9); }
  // ---------- control ----------
  function apply() { if (!ac) return; const t = now();
    master.gain.setTargetAtTime(set.snd ? 0.9 : 0, t, 0.05); musBus.gain.setTargetAtTime(set.musOn === false ? 0 : Math.pow(set.mus / 100, 2) * 0.9, t, 0.25); sfxBus.gain.setTargetAtTime(Math.pow(set.sfx / 100, 2) * 1.1, t, 0.05); }
  function configure(s) { set = Object.assign(set, s); apply(); }
  function unlock() {
    if (!ac) { try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac = new C({ latencyHint: 'interactive' }); build(); } catch (e) { ac = null; return; } }
    if (ac.state === 'suspended') ac.resume();
  }
  function suspend() { if (ac && ac.state === 'running') ac.suspend(); }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.hidden ? suspend() : resume());
  // while an offline render owns the globals, live game calls are ignored (they would otherwise drive the offline graph)
  const W = f => function () { if (offline) return; return f.apply(null, arguments); };
  return { unlock: W(unlock), suspend: W(suspend), resume: W(resume), configure: W(configure), update: W(update), aimStart: W(aimStart), aimPower: W(aimPower), aimEnd: W(aimEnd), launch: W(launch), bounce: W(bounce), star: W(star), win: W(win), lose: W(lose),
    magnet: W(magnet), key: W(key), worm: W(worm), stop: W(stop), crash: W(crash), shield: W(shield), click: W(click), ach: W(ach), theme: W(M(theme)), Composer, THEMES, THEME_IDS,
    renderOffline: (sc, d, r) => offline ? Promise.reject(new Error('busy')) : renderOffline(sc, d, r), get debug() { return { loops: eng ? { shuttle: eng.shuttle.g.gain.value, roadster: eng.roadster.g.gain.value, retro: eng.retro.g.gain.value, screech: eng.screech.g.gain.value } : null, master: master ? master.gain.value : 0, sfx: sfxBus ? sfxBus.gain.value : 0, live: liveSrc, made: madeSrc, sets: Object.assign({}, lastSet), ship: shipKind(), tension: !!tension, theme: themeName, songs: songs.length, layers: song ? Object.keys(song.lg).filter(k => song.lg[k].gain.value > 0.05) : [], mus: musBus ? musBus.gain.value : null, audible: musAudible(), state: ac && ac.state }; }, get on() { return !!ac && ac.state === 'running'; } };
})();
