/* Blackhole Battle v3.1 — procedural WebAudio sound (no samples; everything synthesized at runtime) */
window.BHAudio = (() => {
  'use strict';
  let ac = null, comp, master, musBus, sfxBus, musPre, musDuck, sfxPre, echoIn, noiseBuf = null;
  let set = { snd: true, sfx: 80, mus: 60 };
  let pad = [], padFilt, padGain, thick, thickFilt, thickGain, sub, schedT = 0, chordIdx = 0, tickT = 0, bellT = 0, timer = null;
  let tension = null, hum = null, rumble = null, prox = 0, tfNow = 1, aiming = false;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // slow organ-like progression (Am - F - C - G - Am - F - Dm - E)
  const CHORDS = [[45, 57, 60, 64, 69], [41, 57, 60, 65, 69], [48, 55, 60, 64, 67], [43, 55, 59, 62, 67], [45, 57, 60, 64, 71], [41, 53, 57, 60, 65], [38, 53, 57, 62, 65], [40, 56, 59, 64, 68]];
  const CH_DUR = 7.5;
  const now = () => ac.currentTime;

  function makeIR(sec, decay) {
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function noise() {
    if (!noiseBuf) { const n = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
  }
  function G(v) { const g = ac.createGain(); g.gain.value = v == null ? 1 : v; return g; }
  function F(type, f, q) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
  function O(type, f) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; return o; }
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
    startMusic(); startLoops(); apply();
  }
  // ---------- music ----------
  function startMusic() {
    padFilt = F('lowpass', 900, 0.7); padGain = G(0.0001); padFilt.connect(padGain); padGain.connect(musPre);
    const ch = CHORDS[0];
    for (let v = 0; v < ch.length; v++) for (const dt of [-7, 6]) {
      const o = O(v === 0 ? 'sine' : 'triangle', mtof(ch[v])); o.detune.value = dt; const g = G(v === 0 ? 0.16 : 0.085); o.connect(g); g.connect(padFilt); o.start(); pad.push({ o, v, dt });
    }
    // organ shimmer: upper octave sines with slow tremolo
    const shim = G(0.03), trem = O('sine', 0.17), tg = G(0.02); trem.connect(tg); tg.connect(shim.gain); trem.start();
    for (let v = 2; v < 5; v++) { const o = O('sine', mtof(ch[v] + 12)); o.connect(shim); o.start(); pad.push({ o, v, up: 1 }); }
    shim.connect(padFilt);
    // "thick" layer near black holes: low saw drone + sub
    thickFilt = F('lowpass', 260, 1.2); thickGain = G(0.0001); thickFilt.connect(thickGain); thickGain.connect(musPre);
    thick = [O('sawtooth', mtof(ch[0])), O('sawtooth', mtof(ch[0]) * 1.005)]; thick.forEach(o => { o.connect(thickFilt); o.start(); });
    sub = O('sine', mtof(ch[0]) / 2); const sg = G(0.5); sub.connect(sg); sg.connect(thickFilt); sub.start();
    padGain.gain.setTargetAtTime(1, now(), 2.5);
    schedT = now() + CH_DUR; tickT = now() + 1; bellT = now() + 2.5;
    timer = setInterval(sched, 90);
  }
  function setChord(i, t) {
    const ch = CHORDS[i % CHORDS.length];
    for (const p of pad) p.o.frequency.setTargetAtTime(mtof(ch[p.v] + (p.up ? 12 : 0)), t, 0.9);
    thick[0].frequency.setTargetAtTime(mtof(ch[0]), t, 1.2); thick[1].frequency.setTargetAtTime(mtof(ch[0]) * 1.005, t, 1.2); sub.frequency.setTargetAtTime(mtof(ch[0]) / 2, t, 1.2);
  }
  function sched() {
    if (!ac || ac.state !== 'running') return; const t = now();
    while (schedT < t + 0.3) { chordIdx++; setChord(chordIdx, schedT); schedT += CH_DUR; }
    // clock ticks (tempo slows as time dilates)
    while (tickT < t + 0.3) { tickClick(tickT); tickT += 1.25 / Math.max(0.55, tfNow); }
    while (bellT < t + 0.3) { const ch = CHORDS[chordIdx % CHORDS.length]; const n = ch[1 + Math.floor(Math.random() * 4)] + 12; musBell(bellT, mtof(n)); bellT += 2.5 * (1 + Math.floor(Math.random() * 2)); }
  }
  function tickClick(t) { const n = noise(), f = F('bandpass', 3800, 6), g = G(0); n.connect(f); f.connect(g); g.connect(musPre); env(g, t, 0.002, 0.07, 0.05); n.start(t, Math.random()); n.stop(t + 0.08); }
  function musBell(t, f) { const o = O('sine', f), o2 = O('sine', f * 2.003), g = G(0), g2 = G(0.25); o.connect(g); o2.connect(g2); g2.connect(g); g.connect(musPre); env(g, t, 0.02, 0.045, 3); o.start(t); o2.start(t); o.stop(t + 3.2); o2.stop(t + 3.2); }
  // ---------- continuous loops: engine hum, black-hole rumble ----------
  function startLoops() {
    const hf = F('lowpass', 240, 3), hg = G(0.0001); const h1 = O('sawtooth', 52), h2 = O('square', 52.7), hm = G(0.35); h1.connect(hf); h2.connect(hm); hm.connect(hf); hf.connect(hg); hg.connect(sfxPre); h1.start(); h2.start();
    hum = { f: hf, g: hg, o: [h1, h2] };
    const rn = noise(), rf = F('lowpass', 85, 0.8), rg = G(0.0001), rs = O('sine', 34), rsg = G(0.7), lfo = O('sine', 0.9), lg = G(0.35), am = G(0.65);
    rn.connect(rf); rf.connect(am); rs.connect(rsg); rsg.connect(am); lfo.connect(lg); lg.connect(am.gain); am.connect(rg); rg.connect(sfxPre); rn.start(); rs.start(); lfo.start();
    rumble = { g: rg, s: rs, lfo, f: rf };
  }
  // st: {fly, speed, prox (0..1), tf, aiming}
  function update(st) {
    if (!ac) return; const t = now(); tfNow = st.tf == null ? 1 : st.tf; prox = st.prox || 0; if (st.aiming === update.a && t - (update.t || 0) < 0.05) return; update.t = t; update.a = st.aiming;
    musDuck.gain.setTargetAtTime(st.aiming ? 0.42 : 1, t, 0.18);
    thickGain.gain.setTargetAtTime(Math.pow(prox, 1.3) * 0.32, t, 0.25); padFilt.frequency.setTargetAtTime(800 + prox * 1600, t, 0.3); thickFilt.frequency.setTargetAtTime(200 + prox * 500, t, 0.3);
    // time-stretch feel: whole pad detunes down as time dilates
    const det = -(1 - tfNow) * 140; for (const p of pad) p.o.detune.setTargetAtTime(det + (p.dt || 0), t, 0.3);
    const sp = st.fly ? Math.min(1, (st.speed || 0) / 520) : 0;
    hum.g.gain.setTargetAtTime(st.fly ? 0.03 + sp * 0.07 : 0.0001, t, 0.08); hum.o[0].frequency.setTargetAtTime(44 + sp * 70, t, 0.06); hum.o[1].frequency.setTargetAtTime(44.6 + sp * 71, t, 0.06); hum.f.frequency.setTargetAtTime(160 + sp * 900, t, 0.06);
    rumble.g.gain.setTargetAtTime(Math.pow(prox, 1.6) * 0.6, t, 0.12); rumble.s.frequency.setTargetAtTime(22 + 14 * tfNow, t, 0.2); rumble.lfo.frequency.setTargetAtTime(0.5 + 2.6 * prox * tfNow, t, 0.2);
  }
  // ---------- one-shot SFX (scheduled at currentTime for tight timing) ----------
  function aimStart() { if (!ac || tension) return; const t = now(); const o = O('sawtooth', 90), o2 = O('sine', 135), f = F('lowpass', 420, 4), g = G(0.0001), vib = O('sine', 3), vg = G(4);
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency); o.connect(f); o2.connect(f); f.connect(g); g.connect(sfxPre); o.start(t); o2.start(t); vib.start(t); g.gain.setTargetAtTime(0.03, t, 0.05); tension = { o, o2, f, g, vib }; aiming = true; }
  function aimPower(pct) { if (!tension) return; const t = now(), k = pct / 100; tension.o.frequency.setTargetAtTime(80 + k * 340, t, 0.04); tension.o2.frequency.setTargetAtTime(120 + k * 510, t, 0.04); tension.f.frequency.setTargetAtTime(380 + k * 2600, t, 0.05); tension.g.gain.setTargetAtTime(0.025 + k * 0.06, t, 0.05); tension.vib.frequency.setTargetAtTime(3 + k * 9, t, 0.1); }
  function aimEnd() { if (!tension) return; const t = now(), T = tension; T.g.gain.setTargetAtTime(0.0001, t, 0.03); [T.o, T.o2, T.vib].forEach(o => o.stop(t + 0.2)); tension = null; aiming = false; }
  function launch(pct) { if (!ac) return; aimEnd(); const t = now(), k = 0.5 + (pct || 50) / 200;
    const n = noise(), bp = F('bandpass', 2200, 1.1), g = G(0); n.connect(bp); bp.connect(g); g.connect(sfxPre); bp.frequency.setValueAtTime(2400, t); bp.frequency.exponentialRampToValueAtTime(160, t + 0.7); env(g, t, 0.015, 0.5 * k, 0.75); n.start(t); n.stop(t + 0.85);
    const s = O('sine', 120), sg = G(0); s.connect(sg); sg.connect(sfxPre); s.frequency.setValueAtTime(130, t); s.frequency.exponentialRampToValueAtTime(34, t + 0.55); env(sg, t, 0.006, 0.9 * k, 0.6); s.start(t); s.stop(t + 0.7);
    const c = O('triangle', 70), cg = G(0); c.connect(cg); cg.connect(sfxPre); env(cg, t, 0.002, 0.4, 0.12); c.start(t); c.stop(t + 0.15); }
  function bounce() { if (!ac) return; const t = now(), f0 = 170 + Math.random() * 60;
    [[1, 0.6, 0.22], [2.76, 0.42, 0.14], [5.4, 0.26, 0.09], [8.93, 0.16, 0.06]].forEach(([m, d, a]) => { const o = O('sine', f0 * m), g = G(0); o.connect(g); g.connect(echoIn); env(g, t, 0.002, a, d); o.start(t); o.stop(t + d + 0.05); });
    const b = O('sine', 75), bg = G(0); b.connect(bg); bg.connect(echoIn); b.frequency.setValueAtTime(90, t); b.frequency.exponentialRampToValueAtTime(38, t + 0.4); env(bg, t, 0.003, 0.7, 0.45); b.start(t); b.stop(t + 0.5); }
  const STAR_STEPS = [0, 3, 5, 7, 10, 12, 15];
  function star(n) { if (!ac) return; const t = now(), f = 659.25 * Math.pow(2, STAR_STEPS[Math.max(0, Math.min(6, n - 1))] / 12);
    [[1, 0.22, 1.3], [2.005, 0.08, 0.8], [3.01, 0.04, 0.5], [4.2, 0.02, 0.3]].forEach(([m, a, d]) => { const o = O('sine', f * m), g = G(0); o.connect(g); g.connect(echoIn); env(g, t, 0.004, a, d); o.start(t); o.stop(t + d + 0.05); }); }
  function phrase(notes, step, type, gain, dur, lp) { const t = now(); const f = F('lowpass', lp || 4000); f.connect(sfxPre);
    notes.forEach((m, i) => { const tt = t + i * step; for (const dt of [-5, 5]) { const o = O(type, mtof(m)); o.detune.value = dt; const g = G(0); o.connect(g); g.connect(f); env(g, tt, 0.02, gain, dur); o.start(tt); o.stop(tt + dur + 0.1); } }); }
  function win(stars) { if (!ac) return; const n = [69, 73, 76, 81]; if (stars >= 2) n.push(83); if (stars >= 3) n.push(88); phrase(n, 0.11, 'triangle', 0.07, 1.4); }
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
    master.gain.setTargetAtTime(set.snd ? 0.9 : 0, t, 0.05); musBus.gain.setTargetAtTime(Math.pow(set.mus / 100, 2) * 0.9, t, 0.08); sfxBus.gain.setTargetAtTime(Math.pow(set.sfx / 100, 2) * 1.1, t, 0.05); }
  function configure(s) { set = Object.assign(set, s); apply(); }
  function unlock() {
    if (!ac) { try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac = new C({ latencyHint: 'interactive' }); build(); } catch (e) { ac = null; return; } }
    if (ac.state === 'suspended') ac.resume();
  }
  function suspend() { if (ac && ac.state === 'running') ac.suspend(); }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }
  document.addEventListener('visibilitychange', () => document.hidden ? suspend() : resume());
  return { unlock, suspend, resume, configure, update, aimStart, aimPower, aimEnd, launch, bounce, star, win, lose, magnet, key, worm, stop, crash, shield, click, ach, get on() { return !!ac && ac.state === 'running'; } };
})();
