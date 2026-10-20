/* Blackhole Battle v3.2.0 — procedural ship models (canvas, no image assets).
   Static detail is pre-rendered once into high-res sprites (per kind + device-pixel bucket); per frame only cheap dynamic layers
   (lighting, rim light, nav lights, wheels, driver, plume) are composed on a small reusable scratch canvas. Visual only: hitboxes/physics untouched.
   Roadster: generic angular electric 2-seat targa (proportions-inspired, no marks/badges). Shuttle: generic delta-wing orbiter. */
window.BHShips = (() => {
  const TAU = Math.PI * 2, BUCKETS = [3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32];
  const BOX = { shuttle: [-12.8, -11.6, 14.4, 11.6], roadster: [-12.9, -7.6, 14.7, 7.6] };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const lerp = (a, b, t) => a + (b - a) * t;
  let idN = 0, made = 0; // canvases created (debug / e2e: must stay flat during play)
  const C = (w, h) => { made++; return mk(w, h); };

  // ---------------------------------------------------------------- geometry (units; nose along +x, y down)
  const SH = {
    fus(c) { c.beginPath(); c.moveTo(13.6, 0); c.bezierCurveTo(13.5, -1.25, 12.2, -2.35, 10.2, -2.6); c.lineTo(-8.9, -2.65); c.lineTo(-9.7, -2.15); c.lineTo(-9.7, 2.15); c.lineTo(-8.9, 2.65); c.lineTo(10.2, 2.6); c.bezierCurveTo(12.2, 2.35, 13.5, 1.25, 13.6, 0); c.closePath(); },
    wingHalf(c, s) { c.moveTo(9.6, 1.7 * s); c.lineTo(3.6, 3.35 * s); c.lineTo(-5.7, 10.15 * s); c.quadraticCurveTo(-6.6, 10.75 * s, -7.4, 10.55 * s); c.lineTo(-8.9, 9.7 * s); c.lineTo(-9.25, 2.6 * s); },
    wings(c) { c.beginPath(); SH.wingHalf(c, -1); c.closePath(); SH.wingHalf(c, 1); c.closePath(); },
    oms(c, s) { c.beginPath(); c.moveTo(-3.2, 2.5 * s); c.quadraticCurveTo(-4.6, 3.75 * s, -6.6, 3.8 * s); c.lineTo(-9.3, 3.6 * s); c.lineTo(-9.75, 2.3 * s); c.closePath(); },
    fin(c) { c.beginPath(); c.moveTo(-4.4, 0); c.lineTo(-9.4, -0.55); c.lineTo(-10.9, -0.42); c.lineTo(-10.9, 0.42); c.lineTo(-9.4, 0.55); c.closePath(); },
    all(c) { SH.wings(c); c.fill(); SH.fus(c); c.fill(); SH.oms(c, -1); c.fill(); SH.oms(c, 1); c.fill(); SH.fin(c); c.fill();
      for (const [y, s] of [[-1.2, 1], [1.2, 1], [0, 1.08]]) { c.beginPath(); bell(c, -9.5, y, s); c.fill(); } for (const s of [-1, 1]) { c.beginPath(); bell(c, -9.5, 3.0 * s, .55); c.fill(); } }
  };
  function bell(c, x, y, s) { c.moveTo(x, y - .5 * s); c.lineTo(x - 2.3 * s, y - 1.05 * s); c.quadraticCurveTo(x - 2.45 * s, y, x - 2.3 * s, y + 1.05 * s); c.lineTo(x, y + .5 * s); c.closePath(); }
  const RD = {
    half(c, s) { c.lineTo(14.05, .9 * s); c.lineTo(13.7, 2.6 * s); c.lineTo(12.9, 3.9 * s); c.lineTo(11.0, 5.25 * s); c.lineTo(8.7, 5.95 * s); c.lineTo(5.4, 6.0 * s); c.lineTo(3.3, 5.4 * s);
      c.lineTo(-1.8, 5.2 * s); c.lineTo(-4.1, 5.95 * s); c.lineTo(-6.2, 6.4 * s); c.lineTo(-9.4, 6.35 * s); c.lineTo(-11.3, 5.6 * s); c.lineTo(-11.95, 4.4 * s); c.lineTo(-12.1, 1.2 * s); },
    body(c) { c.beginPath(); c.moveTo(14.1, 0); RD.half(c, -1); c.lineTo(-12.1, 0); const p = []; // mirror back
      c.lineTo(-12.1, 1.2); c.lineTo(-11.95, 4.4); c.lineTo(-11.3, 5.6); c.lineTo(-9.4, 6.35); c.lineTo(-6.2, 6.4); c.lineTo(-4.1, 5.95); c.lineTo(-1.8, 5.2); c.lineTo(3.3, 5.4); c.lineTo(5.4, 6.0); c.lineTo(8.7, 5.95); c.lineTo(11.0, 5.25); c.lineTo(12.9, 3.9); c.lineTo(13.7, 2.6); c.lineTo(14.05, .9); c.closePath(); },
    canopy(c, sh) { sh = sh || 1; c.beginPath(); c.moveTo(5.5, -3.2 * sh); c.quadraticCurveTo(6.1, 0, 5.5, 3.2 * sh); c.lineTo(2.0, 4.15 * sh); c.lineTo(-4.3, 4.1 * sh); c.lineTo(-7.0, 2.7 * sh); c.lineTo(-7.0, -2.7 * sh); c.lineTo(-4.3, -4.1 * sh); c.lineTo(2.0, -4.15 * sh); c.closePath(); },
    wheels: [[7.1, -1, 4.5, 1.5], [7.1, 1, 4.5, 1.5], [-7.7, -1, 4.8, 1.75], [-7.7, 1, 4.8, 1.75]]
  };
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function tiles(c, x0, y0, x1, y1, s, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for (let x = Math.floor(x0 / s) * s; x <= x1; x += s) { c.moveTo(x, y0); c.lineTo(x, y1); } for (let y = Math.floor(y0 / s) * s, r = 0; y <= y1; y += s, r++) { c.moveTo(x0, y); c.lineTo(x1, y); } c.stroke(); }

  // ---------------------------------------------------------------- shuttle (static detail)
  function paintShuttle(c, u) {
    const px = 1 / u; c.lineJoin = 'round';
    // wings: white thermal blankets, subtle quilting, black leading-edge tiles, elevons
    let g = c.createLinearGradient(0, -11, 0, 11); g.addColorStop(0, '#dfe5ee'); g.addColorStop(.5, '#f4f6fa'); g.addColorStop(1, '#c9d1dd');
    c.fillStyle = g; SH.wings(c); c.fill();
    c.save(); SH.wings(c); c.clip();
    tiles(c, -10, -11, 10, 11, .62, 'rgba(100,116,139,.13)', Math.max(px * .6, .03));
    for (const s of [-1, 1]) { // leading edge band of black tiles
      c.beginPath(); c.moveTo(9.9, 1.6 * s); c.lineTo(3.6, 3.35 * s); c.lineTo(-5.7, 10.15 * s); c.quadraticCurveTo(-6.6, 10.75 * s, -7.4, 10.55 * s); c.lineTo(-7.3, 9.6 * s); c.lineTo(-5.2, 8.9 * s); c.lineTo(3.3, 2.65 * s); c.lineTo(9.6, 1.0 * s); c.closePath();
      c.fillStyle = '#1b1d24'; c.fill(); c.save(); c.clip(); tiles(c, -8, -11, 10, 11, .36, 'rgba(148,163,184,.25)', Math.max(px * .5, .025)); c.restore();
      // elevons + hinge line
      c.fillStyle = 'rgba(148,163,184,.28)'; c.beginPath(); c.moveTo(-7.6, 9.9 * s); c.lineTo(-8.9, 9.7 * s); c.lineTo(-9.25, 2.6 * s); c.lineTo(-8.0, 2.65 * s); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(71,85,105,.75)'; c.lineWidth = Math.max(px, .05); c.beginPath(); c.moveTo(-7.6, 9.9 * s); c.lineTo(-8.0, 2.65 * s); c.moveTo(-8.25, 6.3 * s); c.lineTo(-8.75, 6.3 * s); c.stroke();
      // accent chevron (game colours, no marks)
      c.fillStyle = 'rgba(124,58,237,.85)'; c.beginPath(); c.moveTo(-4.0, 6.6 * s); c.lineTo(-6.3, 8.55 * s); c.lineTo(-6.7, 8.2 * s); c.lineTo(-4.5, 6.3 * s); c.closePath(); c.fill();
      c.fillStyle = 'rgba(14,165,233,.85)'; c.beginPath(); c.moveTo(-4.7, 6.15 * s); c.lineTo(-6.9, 8.0 * s); c.lineTo(-7.15, 7.75 * s); c.lineTo(-5.0, 5.95 * s); c.closePath(); c.fill();
    }
    // wing-root ambient occlusion
    c.strokeStyle = 'rgba(15,23,42,.35)'; c.lineWidth = .55; c.beginPath(); c.moveTo(8.5, -2.4); c.lineTo(-9.2, -2.75); c.moveTo(8.5, 2.4); c.lineTo(-9.2, 2.75); c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(51,65,85,.55)'; c.lineWidth = Math.max(px * .8, .05); SH.wings(c); c.stroke();
    // OMS pods
    for (const s of [-1, 1]) { g = c.createLinearGradient(0, 2.4 * s, 0, 3.85 * s); g.addColorStop(0, '#cfd6e0'); g.addColorStop(.5, '#f1f4f8'); g.addColorStop(1, '#9aa5b5');
      c.fillStyle = g; SH.oms(c, s); c.fill(); c.strokeStyle = 'rgba(51,65,85,.5)'; c.lineWidth = Math.max(px * .8, .05); c.stroke();
      c.fillStyle = '#23262e'; c.save(); SH.oms(c, s); c.clip(); c.fillRect(-4.2, 2.4 * s - (s < 0 ? 1.6 : 0), 1.6, 1.6); tiles(c, -4.2, -4, -2.6, 4, .3, 'rgba(148,163,184,.25)', .025); c.restore();
      c.fillStyle = '#0b0d12'; for (let i = 0; i < 3; i++) c.fillRect(-8.6 + i * .45, 3.45 * s - .12, .28, .24); } // aft RCS ports
    // fuselage: cylindrical metal shading
    g = c.createLinearGradient(0, -2.7, 0, 2.7); g.addColorStop(0, '#8e99aa'); g.addColorStop(.18, '#e6ebf2'); g.addColorStop(.42, '#ffffff'); g.addColorStop(.7, '#d5dce6'); g.addColorStop(1, '#7c8799');
    c.fillStyle = g; SH.fus(c); c.fill();
    c.save(); SH.fus(c); c.clip();
    // payload bay doors with radiator panels and hinge lines
    c.fillStyle = 'rgba(203,213,225,.55)'; c.fillRect(-7.2, -2.2, 14.2, 4.4);
    for (let i = 0; i < 4; i++) { const x = 6.4 - i * 3.45; for (const s of [-1, 1]) { const rg = c.createLinearGradient(0, 0, 0, 2.05 * s); rg.addColorStop(0, 'rgba(226,232,240,.95)'); rg.addColorStop(1, 'rgba(186,200,220,.95)'); c.fillStyle = rg; c.fillRect(x - 3.25, s < 0 ? -2.0 : .12, 3.15, 1.88); } }
    c.strokeStyle = 'rgba(71,85,105,.8)'; c.lineWidth = Math.max(px * .9, .05); c.beginPath(); c.moveTo(7.0, 0); c.lineTo(-7.2, 0); c.stroke();
    c.strokeStyle = 'rgba(71,85,105,.45)'; c.lineWidth = Math.max(px * .7, .04); c.beginPath(); for (let i = 0; i <= 4; i++) { const x = 7.0 - i * 3.55; c.moveTo(x, -2.2); c.lineTo(x, 2.2); } c.moveTo(7, -2.2); c.lineTo(-7.2, -2.2); c.moveTo(7, 2.2); c.lineTo(-7.2, 2.2); c.stroke();
    // nose cap + chin: black tiles
    c.fillStyle = '#1a1c23'; c.beginPath(); c.moveTo(13.7, 0); c.bezierCurveTo(13.6, -1.2, 12.6, -2.2, 11.4, -2.5); c.quadraticCurveTo(12.2, 0, 11.4, 2.5); c.bezierCurveTo(12.6, 2.2, 13.6, 1.2, 13.7, 0); c.fill();
    c.save(); c.clip(); tiles(c, 11, -3, 14, 3, .3, 'rgba(148,163,184,.3)', .025); c.restore();
    // forward RCS ports
    c.fillStyle = '#0b0d12'; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { rr(c, 11.6 - i * .42, 1.7 * s - .14, .26, .28, .06); c.fill(); }
    // cockpit windows: 6 front panes + 2 overhead, deep blue glass
    const win = (a0, a1) => { c.beginPath(); c.arc(6.2, 0, 4.75, a0, a1); c.arc(6.2, 0, 3.85, a1, a0, true); c.closePath(); };
    const wg = c.createLinearGradient(9, -2, 11, 2); wg.addColorStop(0, '#0b2a4a'); wg.addColorStop(.5, '#123f6b'); wg.addColorStop(1, '#061727');
    c.fillStyle = '#2b3443'; win(-.62, .62); c.fill();
    for (let i = 0; i < 6; i++) { const a0 = -.58 + i * .195, a1 = a0 + .165; c.fillStyle = wg; win(a0, a1); c.fill(); }
    c.fillStyle = wg; rr(c, 7.3, -1.25, .95, .85, .15); c.fill(); rr(c, 7.3, .4, .95, .85, .15); c.fill();
    // panel lines + rivets
    c.strokeStyle = 'rgba(71,85,105,.5)'; c.lineWidth = Math.max(px * .7, .04); c.beginPath(); c.moveTo(8.9, -2.5); c.lineTo(8.9, 2.5); c.moveTo(-7.6, -2.6); c.lineTo(-7.6, 2.6); c.stroke();
    c.fillStyle = 'rgba(71,85,105,.45)'; for (let x = -7.2; x < 6.8; x += .7) for (const s of [-1, 1]) { c.beginPath(); c.arc(x, 2.4 * s, .045, 0, TAU); c.fill(); }
    // cylindrical shade on top
    g = c.createLinearGradient(0, -2.7, 0, 2.7); g.addColorStop(0, 'rgba(15,23,42,.38)'); g.addColorStop(.25, 'rgba(15,23,42,0)'); g.addColorStop(.75, 'rgba(15,23,42,0)'); g.addColorStop(1, 'rgba(15,23,42,.45)'); c.fillStyle = g; c.fillRect(-10, -3, 24, 6);
    c.restore();
    c.strokeStyle = 'rgba(51,65,85,.7)'; c.lineWidth = Math.max(px * .9, .05); SH.fus(c); c.stroke();
    // engine bells (metal cones, darker inside lip)
    const bells = [[-1.2, 1], [1.2, 1], [0, 1.08]];
    for (const [y, s] of bells) { g = c.createLinearGradient(0, y - 1.05 * s, 0, y + 1.05 * s); g.addColorStop(0, '#3a4252'); g.addColorStop(.35, '#aeb8c8'); g.addColorStop(.55, '#d9e0ea'); g.addColorStop(1, '#2a303b');
      c.fillStyle = g; c.beginPath(); bell(c, -9.5, y, s); c.fill(); c.strokeStyle = 'rgba(15,23,42,.8)'; c.lineWidth = Math.max(px, .05); c.stroke();
      c.strokeStyle = 'rgba(15,23,42,.35)'; c.beginPath(); for (let q = 1; q < 4; q++) { const xx = -9.5 - q * .55 * s; c.moveTo(xx, y - (.5 + q * .14) * s); c.lineTo(xx, y + (.5 + q * .14) * s); } c.stroke(); }
    for (const s of [-1, 1]) { g = c.createLinearGradient(0, 3 * s - .55, 0, 3 * s + .55); g.addColorStop(0, '#3a4252'); g.addColorStop(.5, '#c7d0dc'); g.addColorStop(1, '#2a303b'); c.fillStyle = g; c.beginPath(); bell(c, -9.5, 3.0 * s, .55); c.fill(); }
    // tail fin: drop shadow, then the fin ridge with a lit / shaded face
    c.save(); c.translate(.35, .55); c.fillStyle = 'rgba(15,23,42,.35)'; SH.fin(c); c.fill(); c.restore();
    g = c.createLinearGradient(0, -.55, 0, .55); g.addColorStop(0, '#f8fafc'); g.addColorStop(.48, '#e2e8f0'); g.addColorStop(.52, '#8d98a9'); g.addColorStop(1, '#6b7586');
    c.fillStyle = g; SH.fin(c); c.fill(); c.strokeStyle = 'rgba(51,65,85,.6)'; c.lineWidth = Math.max(px * .8, .04); c.stroke();
    c.fillStyle = '#1a1c23'; c.beginPath(); c.moveTo(-4.4, 0); c.lineTo(-6.0, -.2); c.lineTo(-6.0, .2); c.closePath(); c.fill(); // fin leading edge tiles
    c.strokeStyle = 'rgba(51,65,85,.6)'; c.beginPath(); c.moveTo(-8.2, -.5); c.lineTo(-8.2, .5); c.stroke(); // rudder split
    // nav light housings
    c.fillStyle = '#334155'; for (const s of [-1, 1]) { c.beginPath(); c.arc(-6.75, 10.45 * s, .22, 0, TAU); c.fill(); }
  }
  // ---------------------------------------------------------------- roadster (static detail)
  function paintRoadster(c, u, paintOnly) {
    const px = 1 / u; c.lineJoin = 'round';
    // tyres (only the outer shoulders show beyond the fenders)
    if (paintOnly === 'tyres') for (const [x, s, w, t] of RD.wheels) { const y0 = s < 0 ? -6.0 - t * .55 : 6.0 - t * .45; c.fillStyle = '#0b0c10'; rr(c, x - w / 2, y0, w, t, .55); c.fill();
      c.fillStyle = 'rgba(71,85,105,.22)'; rr(c, x - w / 2 + .2, s < 0 ? y0 + .12 : y0 + t - .32, w - .4, .2, .1); c.fill(); }
    if (paintOnly === 'tyres') return;
    // candy red body with cylindrical sheen across the width
    let g = c.createLinearGradient(0, -6.4, 0, 6.4); g.addColorStop(0, '#5a0a0f'); g.addColorStop(.12, '#b3121c'); g.addColorStop(.3, '#e3222b'); g.addColorStop(.5, '#c4141d'); g.addColorStop(.7, '#e0202a'); g.addColorStop(.88, '#a40f18'); g.addColorStop(1, '#4c080c');
    c.fillStyle = g; RD.body(c); c.fill();
    if (paintOnly) return;
    c.save(); RD.body(c); c.clip();
    // longitudinal sheen: nose and haunches catch light, waist darker (angular surfaces)
    g = c.createLinearGradient(-12, 0, 14, 0); g.addColorStop(0, 'rgba(40,0,4,.45)'); g.addColorStop(.12, 'rgba(255,255,255,0)'); g.addColorStop(.22, 'rgba(255,190,190,.10)'); g.addColorStop(.42, 'rgba(30,0,4,.25)'); g.addColorStop(.62, 'rgba(255,170,170,.08)'); g.addColorStop(.86, 'rgba(255,210,210,.16)'); g.addColorStop(1, 'rgba(60,0,6,.3)');
    c.fillStyle = g; c.fillRect(-13, -7, 28, 14);
    // sharp creases: hood ridges from the light slashes, fender peaks, haunch shoulder lines (light edge + dark edge)
    const crease = (pts, lit) => { c.lineWidth = Math.max(px * 1.1, .06); c.strokeStyle = lit ? 'rgba(255,214,214,.55)' : 'rgba(60,0,8,.55)'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); };
    for (const s of [-1, 1]) {
      crease([[12.9, 2.5 * s], [9.2, 3.4 * s], [5.9, 3.55 * s]], s < 0); crease([[12.9, 2.62 * s], [9.2, 3.52 * s], [5.9, 3.67 * s]], s > 0);
      crease([[10.8, 4.9 * s], [8.4, 5.45 * s], [5.0, 5.5 * s], [3.4, 5.0 * s]], s < 0);
      crease([[-3.6, 5.4 * s], [-6.2, 5.85 * s], [-9.6, 5.75 * s], [-11.4, 4.9 * s]], s < 0); crease([[-3.6, 5.52 * s], [-6.2, 5.97 * s], [-9.6, 5.87 * s]], s > 0);
      // side intake behind the front wheel
      c.fillStyle = '#16050a'; c.beginPath(); c.moveTo(4.2, 5.55 * s); c.lineTo(2.9, 5.32 * s); c.lineTo(2.9, 5.05 * s); c.lineTo(4.0, 5.2 * s); c.closePath(); c.fill();
    }
    // nose centre spine + low wedge lip
    crease([[14.0, 0], [8.0, 0]], true); c.fillStyle = 'rgba(20,0,4,.55)'; c.beginPath(); c.moveTo(14.08, -2.2); c.lineTo(14.08, 2.2); c.lineTo(13.75, 2.4); c.lineTo(13.75, -2.4); c.closePath(); c.fill();
    // specular streaks (gloss), soft
    const streak = (x0, y0, x1, y1, w, a) => { const sg = c.createLinearGradient(x0, y0, x1, y1); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, `rgba(255,255,255,${a})`); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = sg; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.lineCap = 'butt'; };
    streak(12.5, -1.4, 6.6, -2.1, .55, .45); streak(11.4, 1.0, 7.4, 1.5, .35, .22); streak(-5.0, -5.2, -10.6, -5.0, .5, .5); streak(-5.2, 5.25, -10.2, 5.1, .3, .18); streak(9.8, -5.0, 6.0, -5.5, .3, .4);
    // rear deck: hatch seam, flat deck panels, diffuser hint
    c.strokeStyle = 'rgba(40,0,6,.7)'; c.lineWidth = Math.max(px * .9, .05); c.beginPath(); c.moveTo(-7.2, -3.6); c.lineTo(-11.2, -3.9); c.lineTo(-11.4, 3.9); c.lineTo(-7.2, 3.6); c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(40,0,6,.85)'; c.lineWidth = Math.max(px * 1.1, .06); RD.body(c); c.stroke();
    // slim light bars: front slashes (angular), full-width rear bar
    for (const s of [-1, 1]) { c.fillStyle = '#14161c'; c.beginPath(); c.moveTo(13.35, 2.2 * s); c.lineTo(11.1, 4.75 * s); c.lineTo(10.6, 4.9 * s); c.lineTo(12.9, 2.2 * s); c.closePath(); c.fill();
      c.fillStyle = '#e8f1ff'; c.beginPath(); c.moveTo(13.2, 2.3 * s); c.lineTo(11.15, 4.6 * s); c.lineTo(10.95, 4.66 * s); c.lineTo(12.95, 2.3 * s); c.closePath(); c.fill(); }
    c.fillStyle = '#2a0508'; c.fillRect(-12.15, -5.0, .38, 10.0); c.fillStyle = '#ff3b4a'; c.fillRect(-12.1, -4.85, .16, 9.7);
    // canopy: windshield glass, open targa section, black roof bar, rear glass
    c.save(); RD.canopy(c); c.clip();
    g = c.createLinearGradient(6, 0, -7, 0); g.addColorStop(0, '#0a1420'); g.addColorStop(.3, '#0e2233'); g.addColorStop(1, '#05080d'); c.fillStyle = g; c.fillRect(-8, -5, 15, 10);
    // open targa area (interior visible)
    c.fillStyle = '#121418'; c.fillRect(-3.6, -4.15, 5.6, 8.3);
    // seats: light grey shells with black bolsters; console; dash with display glow
    for (const sy of [-1.95, 1.95]) { g = c.createLinearGradient(0, sy - 1.4, 0, sy + 1.4); g.addColorStop(0, '#3a3f48'); g.addColorStop(.2, '#d9dde3'); g.addColorStop(.8, '#c3c8d0'); g.addColorStop(1, '#30343c');
      c.fillStyle = g; rr(c, -3.55, sy - 1.35, 3.3, 2.7, .7); c.fill(); c.fillStyle = '#1b1e24'; rr(c, -3.55, sy - .25, 1.0, .5, .2); c.fill();
      c.strokeStyle = 'rgba(30,34,40,.6)'; c.lineWidth = Math.max(px * .6, .03); c.beginPath(); c.moveTo(-.6, sy - .9); c.lineTo(-2.4, sy - .9); c.moveTo(-.6, sy + .9); c.lineTo(-2.4, sy + .9); c.stroke(); }
    c.fillStyle = '#0c0d10'; c.fillRect(-3.4, -.55, 4.6, 1.1); c.fillStyle = '#1f2937'; c.fillRect(1.2, -3.8, .8, 7.6);
    c.fillStyle = 'rgba(56,189,248,.65)'; c.fillRect(1.35, -.7, .35, 1.4);
    // windshield glass on top
    g = c.createLinearGradient(5.8, 0, 2, 0); g.addColorStop(0, 'rgba(40,70,95,.92)'); g.addColorStop(1, 'rgba(12,26,40,.85)'); c.fillStyle = g; c.beginPath(); c.moveTo(5.6, -3.4); c.quadraticCurveTo(6.2, 0, 5.6, 3.4); c.lineTo(2.0, 4.2); c.lineTo(2.0, -4.2); c.closePath(); c.fill();
    // roof bar (black) and rear glass
    c.fillStyle = '#07080b'; c.fillRect(-4.6, -4.3, 1.05, 8.6); g = c.createLinearGradient(-4.6, 0, -7, 0); g.addColorStop(0, '#0c1824'); g.addColorStop(1, '#05070b'); c.fillStyle = g; c.fillRect(-7.1, -4.3, 2.5, 8.6);
    c.restore();
    c.strokeStyle = '#05060a'; c.lineWidth = Math.max(px * 1.4, .09); RD.canopy(c); c.stroke(); c.beginPath(); c.moveTo(2.0, -4.15); c.lineTo(2.0, 4.15); c.stroke(); // A-pillar/header
    // hidden thruster nozzles: centre rear (plate area) and front corners
    c.fillStyle = '#1a1c22'; rr(c, -12.35, -1.3, .5, 2.6, .15); c.fill(); g = c.createRadialGradient(-12.1, 0, 0, -12.1, 0, .7); g.addColorStop(0, '#050608'); g.addColorStop(.7, '#2b313b'); g.addColorStop(1, '#14171c'); c.fillStyle = g; c.beginPath(); c.ellipse(-12.1, 0, .25, .5, 0, 0, TAU); c.fill();
    c.fillStyle = '#1a1c22'; for (const s of [-1, 1]) { c.beginPath(); c.arc(13.55, 3.05 * s, .26, 0, TAU); c.fill(); }
    // diffuser fins peeking out
    c.fillStyle = '#121418'; for (const y of [-3.2, -1.8, 1.8, 3.2]) c.fillRect(-12.55, y - .12, .45, .24);
  }

  // ---------------------------------------------------------------- sprite cache
  const cache = new Map();
  function bucketFor(dev) { for (const b of BUCKETS) if (b >= dev) return b; return BUCKETS[BUCKETS.length - 1]; }
  function build(kind, u) {
    const key = kind + '@' + u; let s = cache.get(key); if (s) return s;
    const [x0, y0, x1, y1] = BOX[kind], w = Math.ceil((x1 - x0) * u), h = Math.ceil((y1 - y0) * u);
    const T = c => c.setTransform(u, 0, 0, u, -x0 * u, -y0 * u);
    const base = C(w, h), bc = base.getContext('2d'); T(bc); (kind === 'shuttle' ? paintShuttle : paintRoadster)(bc, u);
    const mask = C(w, h), mc = mask.getContext('2d'); T(mc); mc.fillStyle = '#fff'; if (kind === 'shuttle') SH.all(mc); else { RD.body(mc); mc.fill(); for (const [x, sg, ww, t] of RD.wheels) { rr(mc, x - ww / 2, sg < 0 ? -6.0 - t * .55 : 6.0 - t * .45, ww, t, .55); mc.fill(); } }
    let paint = null, tyres = null, body = mask; if (kind === 'roadster') { paint = C(w, h); const pc = paint.getContext('2d'); T(pc); pc.fillStyle = '#fff'; RD.body(pc); pc.fill(); pc.globalCompositeOperation = 'destination-out'; RD.canopy(pc); pc.fill();
      tyres = C(w, h); const tc = tyres.getContext('2d'); T(tc); paintRoadster(tc, u, 'tyres'); body = C(w, h); const bc2 = body.getContext('2d'); T(bc2); bc2.fillStyle = '#fff'; RD.body(bc2); bc2.fill(); }
    s = { kind, u, x0, y0, x1, y1, w, h, base, mask, paint, tyres, body, scratch: C(w, h), tmp: C(w, h), tint: new Map() };
    if (kind === 'shuttle') s.plume = plumeSprite(u);
    tinted(s, '#a5b4fc'); tinted(s, kind === 'shuttle' ? '#16181f' : '#140507'); tinted(s, 'rgba(0,0,0,1)'); // pre-build in-game variants (no canvas creation mid-flight)
    cache.set(key, s); if (cache.size > 8) { const k0 = cache.keys().next().value; if (k0 !== key) cache.delete(k0); }
    return s;
  }
  // a solid-colour copy of the silhouette (cached per colour)
  function tinted(s, col, src) { const k = col + (src ? '|' + (src._id || (src._id = ++idN)) : ''); let t = s.tint.get(k); if (t) return t; t = C(s.w, s.h); const c = t.getContext('2d'); c.drawImage(src || s.mask, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = col; c.fillRect(0, 0, s.w, s.h); s.tint.set(k, t); return t; }

  // ---------------------------------------------------------------- dynamic layers (scratch canvas, sprite pixel space)
  function compose(s, o) {
    const t0 = o.t || 0; if (o.throttle && s.ct != null && t0 >= s.ct && t0 - s.ct < .045 && s.cb === !!o.braking) return s.scratch; // in-game: live overlays refresh at ~20-30 Hz (perf; ship is ~30 css px)
    s.ct = o.throttle ? t0 : null; s.cb = !!o.braking;
    const c = s.scratch.getContext('2d'), u = s.u, t = o.t || 0; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, s.w, s.h);
    c.drawImage(s.base, 0, 0); c.setTransform(u, 0, 0, u, -s.x0 * u, -s.y0 * u);
    if (s.kind === 'roadster') roadsterLive(c, s, o, t); else shuttleLive(c, s, o, t);
    // directional light + shadow (clipped to the hull via source-atop)
    const lt = o.light || { a: -2.3, c: '255,244,220', k: .6 }, la = lt.a, lx = Math.cos(la), ly = Math.sin(la), R0 = 13;
    c.globalCompositeOperation = 'source-atop';
    let g = c.createLinearGradient(lx * R0, ly * R0, -lx * R0, -ly * R0); g.addColorStop(0, `rgba(${lt.c},${.32 * lt.k})`); g.addColorStop(.42, `rgba(${lt.c},0)`); g.addColorStop(.6, 'rgba(2,6,23,0)'); g.addColorStop(1, `rgba(2,6,23,${.42 + .2 * (o.bank ? Math.abs(o.bank) : 0)})`);
    c.fillStyle = g; c.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
    if (o.hole > 0.02) { c.fillStyle = `rgba(147,51,234,${Math.min(.5, o.hole * .55)})`; c.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); }
    // rim light: silhouette minus itself shifted away from the light, tinted with the light colour
    const r = s.tmp.getContext('2d'); r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, s.w, s.h); r.drawImage(s.body, 0, 0);
    const d = Math.max(1, .2 * u); r.globalCompositeOperation = 'destination-out'; r.drawImage(s.body, -lx * d, -ly * d);
    r.globalCompositeOperation = 'source-in'; r.fillStyle = `rgba(${lt.c},${Math.min(.8, .3 + .4 * lt.k)})`; r.fillRect(0, 0, s.w, s.h);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .75; c.drawImage(s.tmp, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    return s.scratch;
  }
  function shuttleLive(c, s, o, t) {
    // nozzle inner glow (always a faint pilot glow; bright with thrust)
    const I = o.engine || 0; c.globalCompositeOperation = 'lighter';
    for (const [y, sc] of [[-1.2, 1], [1.2, 1], [0, 1.08]]) { const g = c.createRadialGradient(-11.75, y, 0, -11.75, y, 1.1 * sc); g.addColorStop(0, `rgba(255,255,255,${.25 + .75 * I})`); g.addColorStop(.35, `rgba(125,211,252,${.2 + .6 * I})`); g.addColorStop(1, 'rgba(56,189,248,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(-11.7, y, .45, 1.0 * sc, 0, 0, TAU); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    // cockpit reflection sweep (moves with heading / light)
    const ph = ((o.refl || 0) * .25 + t * .05) % 1, rx = 6.2 + Math.cos(-.55 + ph * 1.1) * 4.3, ry = Math.sin(-.55 + ph * 1.1) * 4.3;
    c.save(); c.beginPath(); c.arc(6.2, 0, 4.75, -.6, .6); c.arc(6.2, 0, 3.85, .6, -.6, true); c.closePath(); c.clip();
    const g = c.createRadialGradient(rx, ry, 0, rx, ry, 1.6); g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(rx - 2, ry - 2, 4, 4);
    c.fillStyle = 'rgba(167,139,250,.18)'; c.fillRect(1, -5, 10, 10); c.restore();
    // nav lights: red port (y<0), green starboard, white tail strobe
    const blink = (t * 1.25) % 1 < .08;
    c.fillStyle = '#ff4d5e'; c.beginPath(); c.arc(-6.75, -10.45, .17, 0, TAU); c.fill(); c.fillStyle = '#4ade80'; c.beginPath(); c.arc(-6.75, 10.45, .17, 0, TAU); c.fill();
    if (blink) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-10.75, 0, .2, 0, TAU); c.fill(); }
  }
  function roadsterLive(c, s, o, t) {
    const u = s.u, ang = o.refl || 0;
    // nebula reflection sliding over the paint (paint mask only), plus a moving gloss highlight
    const r = s.tmp.getContext('2d'); r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, s.w, s.h); r.setTransform(u, 0, 0, u, -s.x0 * u, -s.y0 * u);
    const off = Math.sin(ang) * 6 + Math.sin(t * .23) * 2, g = r.createLinearGradient(-12 + off, -7, 4 + off, 7);
    g.addColorStop(0, 'rgba(124,58,237,0)'); g.addColorStop(.3, 'rgba(139,92,246,.16)'); g.addColorStop(.45, 'rgba(34,211,238,.10)'); g.addColorStop(.55, 'rgba(255,255,255,.04)'); g.addColorStop(.7, 'rgba(236,72,153,.10)'); g.addColorStop(1, 'rgba(124,58,237,0)');
    r.fillStyle = g; r.fillRect(-13, -8, 28, 16); const gx = 4 + Math.cos(ang * .7 + t * .1) * 6; const hg = r.createRadialGradient(gx, -3.5, 0, gx, -3.5, 3.2); hg.addColorStop(0, 'rgba(255,255,255,.22)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); r.fillStyle = hg; r.fillRect(gx - 4, -7, 8, 8);
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'destination-in'; r.drawImage(s.paint, 0, 0);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'screen'; c.drawImage(s.tmp, 0, 0); c.restore();
    // windshield reflection streak
    c.save(); c.beginPath(); c.moveTo(5.6, -3.4); c.quadraticCurveTo(6.2, 0, 5.6, 3.4); c.lineTo(2.0, 4.2); c.lineTo(2.0, -4.2); c.closePath(); c.clip();
    const wy = -4 + ((t * .15 + ang * .3) % 1 + 1) % 1 * 8; const wg = c.createLinearGradient(4, wy - 1.2, 3, wy + 1.2); wg.addColorStop(0, 'rgba(255,255,255,0)'); wg.addColorStop(.5, 'rgba(200,230,255,.38)'); wg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = wg; c.fillRect(1.5, -5, 5, 10); c.restore();
    // tyre treads (spin = scrolling grooves), rotation speed from o.wheel
    const ph = (o.wheel || 0) % 1; if (!o.noTyre) {
    c.fillStyle = 'rgba(148,163,184,.35)'; for (const [x, sg, w, th] of RD.wheels) { const y0 = sg < 0 ? -6.0 - th * .55 : 6.0 - th * .45, yy = sg < 0 ? y0 : y0 + th * .55; for (let i = 0; i < 6; i++) { const xx = x - w / 2 + ((i + ph) / 6) * w; if (xx > x - w / 2 + .3 && xx < x + w / 2 - .3) c.fillRect(xx, yy, .12, th * .45); } } }
    // driver: white suit mannequin, helmet with gold visor; head bob, arm on the door
    const bob = Math.sin(t * 2.3) * .09 + (o.jolt || 0) * .35, nod = Math.sin(t * 1.15 + 1) * .05, dx = -1.95;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(-1.9, dx + .15, 1.5, 1.45, 0, 0, TAU); c.fill();
    let g2 = c.createLinearGradient(0, dx - 1.5, 0, dx + 1.5); g2.addColorStop(0, '#cfd6df'); g2.addColorStop(.4, '#ffffff'); g2.addColorStop(1, '#b8c0cc');
    c.fillStyle = g2; c.beginPath(); c.ellipse(-2.5, dx, 1.05, 1.55, 0, 0, TAU); c.fill(); // shoulders/torso
    c.fillStyle = '#e11d48'; c.fillRect(-2.6, dx - 1.45, .35, .25); c.fillStyle = '#2563eb'; c.fillRect(-2.6, dx + 1.2, .35, .25); // shoulder patches (generic)
    c.strokeStyle = '#eef2f7'; c.lineCap = 'round'; c.lineWidth = .62;
    const arm = Math.sin(t * .9) * .06; c.beginPath(); c.moveTo(-2.3, dx - 1.25); c.quadraticCurveTo(-1.4, -4.35 + arm, .1, -4.45 + arm); c.stroke(); // left arm resting on the door sill
    c.beginPath(); c.moveTo(-2.1, dx + .9); c.quadraticCurveTo(-.6, dx + .55, .55, dx + .45); c.stroke(); // right arm to the wheel
    c.lineCap = 'butt'; c.fillStyle = '#e5e7eb'; c.beginPath(); c.arc(.15, -4.45 + arm, .3, 0, TAU); c.fill(); c.beginPath(); c.arc(.6, dx + .45, .26, 0, TAU); c.fill(); // gloves
    c.strokeStyle = '#0b0c10'; c.lineWidth = .22; c.beginPath(); c.ellipse(.75, dx, .3, .95, 0, 0, TAU); c.stroke(); // steering wheel
    const hx = -1.75 + bob, hy = dx + nod; g2 = c.createRadialGradient(hx - .35, hy - .4, .1, hx, hy, 1.15); g2.addColorStop(0, '#ffffff'); g2.addColorStop(.7, '#e2e8f0'); g2.addColorStop(1, '#94a3b8');
    c.fillStyle = g2; c.beginPath(); c.arc(hx, hy, 1.08, 0, TAU); c.fill();
    g2 = c.createLinearGradient(hx, hy - .8, hx + .9, hy + .8); g2.addColorStop(0, '#fde68a'); g2.addColorStop(.35, '#b45309'); g2.addColorStop(.7, '#3b1d06'); g2.addColorStop(1, '#a16207');
    c.fillStyle = g2; c.beginPath(); c.arc(hx, hy, .86, -1.25, 1.25); c.quadraticCurveTo(hx + .15, hy, hx + .3, hy - .82); c.closePath(); c.fill(); // visor facing forward
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(hx + .5, hy - .38, .22, .1, .7, 0, TAU); c.fill(); // visor glint
    c.fillStyle = 'rgba(167,139,250,.5)'; c.beginPath(); c.ellipse(hx + .62, hy + .2, .14, .32, .2, 0, TAU); c.fill(); // nebula in the visor
    // lights: head slashes and rear bar glow (rear brighter when braking)
    c.globalCompositeOperation = 'lighter';
    const hl = .55 + .1 * Math.sin(t * 3), br = o.braking ? 1 : .45;
    for (const sg of [-1, 1]) { const lg = c.createLinearGradient(13.2, 2.3 * sg, 11, 4.7 * sg); lg.addColorStop(0, `rgba(219,234,254,${hl})`); lg.addColorStop(1, 'rgba(147,197,253,.2)'); c.strokeStyle = lg; c.lineWidth = .45; c.beginPath(); c.moveTo(13.1, 2.35 * sg); c.lineTo(11.05, 4.62 * sg); c.stroke(); }
    c.fillStyle = `rgba(255,60,80,${.3 * br})`; c.fillRect(-12.1, -4.9, .7, 9.8); c.fillStyle = `rgba(255,120,130,${.6 * br})`; c.fillRect(-12.12, -4.8, .2, 9.6);
    c.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- in-game draw (ctx at ship centre, nose +x, 1 unit = k css px)
  function draw(ctx, kind, o) {
    const k = o.k, s = build(kind, bucketFor((o.dev || 3) * 1.12)), t = o.t || 0;
    ctx.save(); ctx.scale(k, k);
    if (o.squash) ctx.scale(1 + o.squash, 1 - o.squash * .7);
    const bk = o.bank || 0; if (bk) ctx.scale(1, 1 - .16 * Math.abs(bk));
    if (o.ghost) { ctx.drawImage(tinted(s, o.ghost), s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); ctx.restore(); return; }
    if (kind === 'shuttle') { o.plume = s.plume; plume(ctx, o, t); }
    // banking reveals a sliver of the dark underside on the low side
    if (Math.abs(bk) > .05) { ctx.globalAlpha = Math.min(1, Math.abs(bk) * 1.6); ctx.drawImage(tinted(s, kind === 'shuttle' ? '#16181f' : '#140507'), s.x0, s.y0 + bk * .9, s.x1 - s.x0, s.y1 - s.y0); ctx.globalAlpha = 1; }
    else { ctx.globalAlpha = .55; ctx.drawImage(tinted(s, 'rgba(0,0,0,1)'), s.x0 + .25, s.y0 + .45, s.x1 - s.x0, s.y1 - s.y0); ctx.globalAlpha = 1; } // contact shadow
    if (s.tyres) ctx.drawImage(s.tyres, s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
    o.throttle = 1; ctx.drawImage(compose(s, o), s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
    if (kind === 'shuttle') { navGlow(ctx, t); if (o.braking) rcs(ctx, t); } else roadsterGlow(ctx, o, t);
    ctx.restore();
  }
  function navGlow(ctx, t) { const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    for (const [y, col] of [[-10.45, '255,77,94'], [10.45, '74,222,128']]) { const g = ctx.createRadialGradient(-6.75, y, 0, -6.75, y, 1.5); g.addColorStop(0, `rgba(${col},.55)`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(-8.3, y - 1.5, 3.1, 3); }
    if ((t * 1.25) % 1 < .08) { const g = ctx.createRadialGradient(-10.75, 0, 0, -10.75, 0, 2.6); g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-13.4, -2.6, 5.3, 5.2); }
    ctx.globalCompositeOperation = pc; }
  function roadsterGlow(ctx, o, t) { const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    for (const sg of [-1, 1]) { const g = ctx.createRadialGradient(13.6, 3.0 * sg, 0, 13.6, 3.0 * sg, 3.2); g.addColorStop(0, 'rgba(219,234,254,.22)'); g.addColorStop(1, 'rgba(219,234,254,0)'); ctx.fillStyle = g; ctx.fillRect(10.4, 3.0 * sg - 3.2, 6.4, 6.4); }
    const br = o.braking ? .75 : .32; ctx.save(); ctx.translate(-12.2, 0); ctx.scale(.5, 2.1); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 3); g.addColorStop(0, `rgba(255,60,80,${br})`); g.addColorStop(.5, `rgba(255,40,70,${br * .35})`); g.addColorStop(1, 'rgba(255,40,70,0)'); ctx.fillStyle = g; ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    if (o.gas > .02) { const gg = ctx.createRadialGradient(-12.3, 0, 0, -12.3, 0, 2.4); gg.addColorStop(0, `rgba(224,242,254,${.6 * o.gas})`); gg.addColorStop(1, 'rgba(224,242,254,0)'); ctx.fillStyle = gg; ctx.fillRect(-14.8, -2.4, 4.8, 4.8); }
    ctx.globalCompositeOperation = pc; }
  // shuttle braking: nose RCS jets (white-cyan, short, flickering)
  function rcs(ctx, t) { const pc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    for (const sg of [-1, 1]) { const f = .7 + .3 * Math.sin(t * 47 + sg * 3) * Math.sin(t * 31); for (const [dx, dy, len] of [[1, .35 * sg, 3.6], [.35, 1 * sg, 2.2]]) { const x0 = 11.6, y0 = 1.75 * sg, L = len * f, g = ctx.createLinearGradient(x0, y0, x0 + dx * L, y0 + dy * L);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.4, 'rgba(186,230,253,.6)'); g.addColorStop(1, 'rgba(186,230,253,0)'); ctx.fillStyle = g; const nx = -dy * .32, ny = dx * .32;
      ctx.beginPath(); ctx.moveTo(x0 + nx * .4, y0 + ny * .4); ctx.lineTo(x0 + dx * L + nx * 1.6, y0 + dy * L + ny * 1.6); ctx.lineTo(x0 + dx * L - nx * 1.6, y0 + dy * L - ny * 1.6); ctx.lineTo(x0 - nx * .4, y0 - ny * .4); ctx.fill(); } }
    ctx.globalCompositeOperation = pc; }
  // shuttle main plume: smoke-tinted outer, violet/blue flame, cyan mid, white cores with shock diamonds, heat shimmer
  // exhaust plume layers pre-rendered once per bucket at a reference size (L0 x W0), then stretched per frame: ~10 gradient path fills -> 1 drawImage
  const SHL = 16.2, SHP = 11.3, SHY = 3.2, PL0 = 18, PW0 = 2.6, PX = PL0 * 1.15 + .6, PY = PW0 * 1.45 + .3;
  function plumeSprite(u) {
    const q = Math.max(2, Math.round(u * .75)), cv = C(Math.ceil((PX + .6) * q), Math.ceil(PY * 2 * q)), c = cv.getContext('2d'); c.setTransform(q, 0, 0, q, PX * q, PY * q); c.globalCompositeOperation = 'lighter';
    const L = PL0, Wd = PW0, tear = (len, w, c0, c1, c2) => { const g = c.createLinearGradient(0, 0, -len, 0); g.addColorStop(0, c0); g.addColorStop(.35, c1); g.addColorStop(1, c2); c.fillStyle = g; c.beginPath(); c.moveTo(0, -w * .62); c.bezierCurveTo(-len * .35, -w, -len * .8, -w * .35, -len, 0); c.bezierCurveTo(-len * .8, w * .35, -len * .35, w, 0, w * .62); c.closePath(); c.fill(); };
    tear(L * 1.15, Wd * 1.45, 'rgba(124,58,237,.35)', 'rgba(99,102,241,.22)', 'rgba(76,29,149,0)');
    tear(L, Wd, 'rgba(56,189,248,.75)', 'rgba(59,130,246,.45)', 'rgba(124,58,237,0)');
    tear(L * .6, Wd * .62, 'rgba(186,230,253,.95)', 'rgba(125,211,252,.6)', 'rgba(56,189,248,0)');
    for (const [y, sc] of [[-1.2, .8], [1.2, .8], [0, 1]]) { const g = c.createLinearGradient(0, y, -L * .35 * sc, y); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(-L * .14 * sc, y, L * .18 * sc, .42 * sc, 0, 0, TAU); c.fill(); }
    // heat-shimmer strip: 3 wavy lines, one extra period long so it can scroll (cheap drawImage instead of per-frame thin strokes)
    const sh = C(Math.ceil((SHL + SHP) * q), Math.ceil(SHY * 2 * q)), d = sh.getContext('2d'); d.setTransform(q, 0, 0, q, 0, SHY * q); d.strokeStyle = 'rgb(226,232,240)'; d.lineWidth = .35;
    for (let i = 0; i < 3; i++) { d.beginPath(); for (let x = 0; x <= SHL + SHP + .01; x += .25) { const y = (i - 1) * PW0 * .9 + Math.sin(x / SHP * TAU + i * 2) * .35; x ? d.lineTo(x, y) : d.moveTo(x, y); } d.stroke(); }
    cv.shim = sh; return cv; }
  function plume(ctx, o, t) {
    const I = o.engine || 0; if (I < .02) return; const pc = ctx.globalCompositeOperation;
    const fl = .88 + .12 * Math.sin(t * 61) * Math.sin(t * 37 + 1) + .06 * Math.sin(t * 13), x0 = -11.4, L = (5 + 13 * I) * fl, Wd = 1.5 + 1.1 * I;
    // heat shimmer: faint wavy translucent bands
    ctx.globalCompositeOperation = 'source-over';
    if (o.plume && o.plume.shim) { const sh = o.plume.shim, q = sh.height / (SHY * 2), ph = ((t * 9 / TAU) % 1) * SHP, ga = ctx.globalAlpha; ctx.globalAlpha = ga * (.05 + .05 * I);
      ctx.save(); ctx.translate(x0 - L * .5, 0); ctx.scale(-L / PL0, Wd / PW0); ctx.drawImage(sh, ph * q, 0, SHL * q, sh.height, 0, -SHY, SHL, SHY * 2); ctx.restore(); ctx.globalAlpha = ga; }
    ctx.globalCompositeOperation = 'lighter';
    if (o.plume) { ctx.save(); ctx.translate(x0, 0); ctx.scale(L / PL0, Wd / PW0); ctx.drawImage(o.plume, -PX, -PY, PX + .6, PY * 2); ctx.restore(); }
    if (I > .55) { ctx.fillStyle = `rgba(255,255,255,${.35 * (I - .5)})`; for (let q = 1; q <= 4; q++) { ctx.beginPath(); ctx.ellipse(x0 - q * L * .13, 0, .45, Wd * .28 * (1 - q * .12), 0, 0, TAU); ctx.fill(); } } // shock diamonds
    if (o.ignite > 0) { const g = ctx.createRadialGradient(x0 - 1, 0, 0, x0 - 1, 0, 6 * o.ignite + 2); g.addColorStop(0, `rgba(254,215,170,${.8 * o.ignite})`); g.addColorStop(.4, `rgba(251,146,60,${.4 * o.ignite})`); g.addColorStop(1, 'rgba(251,146,60,0)'); ctx.fillStyle = g; ctx.fillRect(x0 - 10, -8, 12, 16); }
    ctx.globalCompositeOperation = pc;
  }

  // ---------------------------------------------------------------- 3/4 turntable preview (sprite stacking)
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, m = v => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${m(r)},${m(g)},${m(b)})`; }
  const fusMaskCache = new Map(), canopyCache = new Map(), finCache = new Map();
  function subMask(s, which) { const map = which === 'fus' ? fusMaskCache : which === 'fin' ? finCache : canopyCache, key = s.kind + s.u; let m = map.get(key); if (m) return m;
    m = C(s.w, s.h); const c = m.getContext('2d'); c.setTransform(s.u, 0, 0, s.u, -s.x0 * s.u, -s.y0 * s.u); c.fillStyle = '#fff';
    if (which === 'fus') { SH.fus(c); c.fill(); } else if (which === 'fin') { SH.fin(c); c.fill(); } else { RD.canopy(c); c.fill(); }
    map.set(key, m); return m; }
  function clipTop(s, which) { const key = 'top-' + which; let m = s.tint.get(key); if (m) return m; m = C(s.w, s.h); const c = m.getContext('2d'); c.drawImage(s.base, 0, 0); c.globalCompositeOperation = 'destination-in'; c.drawImage(subMask(s, which), 0, 0); s.tint.set(key, m); return m; }
  function preview(ctx, kind, W, H, t, o) {
    o = o || {}; const P = Math.min(W / 30, H / 19) * (kind === 'roadster' ? 1.0 : .9), s = build(kind, bucketFor(P * 1.1)), th = o.angle != null ? o.angle : -0.55 + Math.sin(t * .35) * .55 + t * .0, cy = .56, hs = P * .62;
    const cx = W * .5, cY = H * (kind === 'roadster' ? .66 : .64), ca = Math.cos(th), sa = Math.sin(th);
    const at = z => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(cx, cY - z * hs); ctx.scale(1, cy); ctx.rotate(th); ctx.scale(P, P); };
    const spr = (img, z, sy, xs, px) => { at(z); if (xs && xs !== 1) { ctx.translate(px, 0); ctx.scale(xs, 1); ctx.translate(-px, 0); } if (sy && sy !== 1) ctx.scale(1, sy); ctx.drawImage(img, s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); };
    const sprS = (col, f, src, z, sy, xs, px) => { spr(tinted(s, col, src), z, sy, xs, px); if (f < .995) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * (1 - Math.max(0, f)); spr(tinted(s, '#000000', src), z, sy, xs, px); ctx.globalAlpha = ga; } }; // shade via one colour tint + black overlay (2 cached canvases, not one per shade level)
    const scrY = (x, y) => (sa * x + ca * y) * cy; // screen-depth of a local point (bigger = nearer)
    ctx.save();
    // floor glow + shadow
    ctx.setTransform(1, 0, 0, 1, 0, 0); const fg = ctx.createRadialGradient(cx, cY + P * .5, 0, cx, cY + P * .5, P * 14); fg.addColorStop(0, 'rgba(56,189,248,.16)'); fg.addColorStop(1, 'rgba(56,189,248,0)'); ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .5; spr(tinted(s, '#000000'), -.6); ctx.globalAlpha = 1;
    const bob = Math.sin(t * 1.6) * .25 + .9; // hover
    if (kind === 'roadster') {
      const R = 1.95, wheels = [[7.1, -5.25, R, 1.45], [7.1, 5.25, R, 1.45], [-7.7, -5.55, R * 1.04, 1.6], [-7.7, 5.55, R * 1.04, 1.6]], spin = -t * 2.4;
      const nearSide = scrY(0, 1) >= 0 ? 1 : -1;
      const wheel = (w, near) => { const [x, y, r, wd] = w, sg = y < 0 ? -1 : 1; if (near) disc(ctx, cx, cY, th, cy, hs, P, x, y - sg * wd * .1, r * 1.1, bob + r, 'arch', 0);
        for (let i = 0; i <= 6; i++) { const yy = y + sg * (i / 6 - .5) * wd, outer = sg === nearSide ? (i === 6) : false; disc(ctx, cx, cY, th, cy, hs, P, x, yy, r, bob + r, outer ? 'rim' : 'tyre', spin); } };
      wheels.filter(w => Math.sign(w[1]) !== nearSide).forEach(w => wheel(w, false));
      const base = '#b3121c', Z0 = .75, Z1 = 4.3;
      for (let z = Z0; z <= Z1; z += .045) { const q = (z - Z0) / (Z1 - Z0); let col = base, f = Math.min(1, .42 + q * .6); if (z < 1.25) { col = '#121316'; f = 1; }
        if (Math.abs(z - 3.55) < .03) { col = '#ff6b6f'; f = 1; } if (Math.abs(z - 2.35) < .03) f = .3;
        const wq = Math.max(0, (z - 1.6) / (Z1 - 1.6)); sprS(col, f, s.body, bob + z, z > 3.6 ? 1 - (z - 3.6) * .05 : 1, 1 - wq * wq * .075, -12); }
      wheels.filter(w => Math.sign(w[1]) === nearSide).forEach(w => wheel(w, true));
      compose(s, { t, refl: th * 2, noTyre: 1, light: { a: -2.2 - th, c: '255,244,230', k: .8 } }); spr(s.scratch, bob + Z1 + .05, .965, .925, -12);
      // greenhouse: raked windshield and rear glass, black targa bar; the roof between them is open
      const ZT = Z1 + .05, ZR = ZT + 1.9;
      for (let z = ZT; z <= ZR; z += .045) { const q = (z - ZT) / (ZR - ZT); at(bob + z); ctx.scale(1, .965 - q * .14);
        ctx.save(); RD.canopy(ctx); ctx.clip(); const xf = lerp(5.6, 2.4, q), xr = lerp(-7.0, -5.0, q);
        ctx.fillStyle = q > .97 ? '#1f3a52' : Math.abs(q - .5) < .07 ? '#3f6886' : Math.abs(q - .62) < .025 ? '#5d87a6' : shade('#10202e', .7 + q * .5); ctx.fillRect(2.0, -5, xf - 2.0, 10); ctx.fillStyle = shade('#0b1520', .7 + q * .4); ctx.fillRect(xr, -5, -4.6 - xr, 10);
        ctx.fillStyle = shade('#0b0c0f', 1 + q * .6); ctx.fillRect(-4.6, -5, 1.05, 10); ctx.restore(); }
      // driver helmet rises in the open cabin
      const hb = Math.sin(t * 2.3) * .09; helmet(ctx, cx, cY, th, cy, hs, P, -1.75 + hb, -1.95, bob + ZT + 1.3);
    } else {
      // belly tiles (dark), wing, then fuselage cylinder (dark lower flank, white upper), swept tail fin
      for (let z = 0; z <= .45; z += .06) spr(tinted(s, '#17191f'), bob + z); for (let z = .45; z <= .8; z += .06) spr(tinted(s, '#aab3c0'), bob + z);
      const eng = .25 + .2 * Math.sin(t * 3) ** 2; engines(ctx, cx, cY, th, cy, hs, P, bob + 1.9, eng, -1);
      compose(s, { t, engine: eng, refl: th, light: { a: -2.2 - th, c: '255,244,230', k: .8 } }); spr(s.scratch, bob + .82);
      const fm = subMask(s, 'fus'), F0 = .82, F1 = 3.9; for (let z = F0; z <= F1; z += .045) { const q = (z - F0) / (F1 - F0), w = Math.sqrt(Math.max(.04, 1 - Math.pow(q * 1.25 - .25, 2))); if (q < .18) spr(tinted(s, '#1b1d24', fm), bob + z, w, 1 - (1 - w) * .07, -9.7); else sprS('#e7ecf3', .5 + .5 * q, fm, bob + z, w, 1 - (1 - w) * .07, -9.7); }
      spr(clipTop(s, 'fus'), bob + F1 + .05, .7, .975, -9.7);
      const fn = subMask(s, 'fin'), H0 = F1 + .05, H1 = H0 + 4.6; for (let z = H0; z <= H1; z += .045) { const q = (z - H0) / (H1 - H0); at(bob + z); ctx.translate(-10.9 - q * .5, 0); ctx.scale(1 - q * .62, .9); ctx.translate(10.9, 0); if (q > .94) ctx.drawImage(tinted(s, '#22252d', fn), s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); else { ctx.drawImage(tinted(s, '#e8edf3', fn), s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); ctx.globalAlpha = .38 - .38 * q; ctx.drawImage(tinted(s, '#000000', fn), s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); ctx.globalAlpha = 1; } }
      engines(ctx, cx, cY, th, cy, hs, P, bob + 1.9, eng, 1);
    }
    ctx.restore();
  }
  // a vertical wheel disc at local (x,y), radius r, centre height z (preview projection)
  function disc(ctx, cx, cY, th, cy, hs, P, x, y, r, z, kind, spin) {
    const ca = Math.cos(th), sa = Math.sin(th), ox = cx + (ca * x - sa * y) * P, oy = cY + (sa * x + ca * y) * P * cy - z * hs;
    ctx.setTransform(ca * P, sa * P * cy, 0, -hs, ox, oy); // basis: local x -> screen, up -> screen
    if (kind === 'arch') { ctx.fillStyle = '#060608'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.lineTo(-r, -r * .25); ctx.lineTo(r, -r * .25); ctx.fill(); return; }
    if (kind === 'tyre') { ctx.fillStyle = '#0b0c10'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); return; }
    ctx.fillStyle = '#0d0e12'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a3f48'; ctx.beginPath(); ctx.arc(0, 0, r * .72, 0, TAU); ctx.fill();
    ctx.fillStyle = '#dc2626'; ctx.fillRect(-r * .15, r * .2, r * .3, r * .38); // caliper
    ctx.strokeStyle = '#9aa3b0'; ctx.lineWidth = r * .09; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = spin + i * TAU / 10; ctx.moveTo(Math.cos(a) * r * .14, Math.sin(a) * r * .14); ctx.lineTo(Math.cos(a + .18) * r * .68, Math.sin(a + .18) * r * .68); } ctx.stroke();
    ctx.fillStyle = '#c3cad4'; ctx.beginPath(); ctx.arc(0, 0, r * .14, 0, TAU); ctx.fill();
  }
  function helmet(ctx, cx, cY, th, cy, hs, P, x, y, z) { const ca = Math.cos(th), sa = Math.sin(th), ox = cx + (ca * x - sa * y) * P, oy = cY + (sa * x + ca * y) * P * cy - z * hs, r = 1.05 * P;
    ctx.setTransform(1, 0, 0, 1, 0, 0); let g = ctx.createRadialGradient(ox - r * .35, oy - r * .4, r * .1, ox, oy, r); g.addColorStop(0, '#fff'); g.addColorStop(.7, '#e2e8f0'); g.addColorStop(1, '#8b95a5'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill();
    const fx = ca, fy = sa * cy; if (fy > -0.95) { const vx = ox + fx * r * .45, vy = oy + fy * r * .45 + r * .05; g = ctx.createLinearGradient(vx - r * .5, vy - r * .5, vx + r * .5, vy + r * .5); g.addColorStop(0, '#fde68a'); g.addColorStop(.4, '#b45309'); g.addColorStop(1, '#2a1404');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(vx, vy, r * (.42 + .25 * Math.abs(fy)), r * .5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(vx - r * .15, vy - r * .2, r * .14, r * .07, -.5, 0, TAU); ctx.fill(); } }
  function engines(ctx, cx, cY, th, cy, hs, P, z, I, pass) {
    const ca = Math.cos(th), sa = Math.sin(th), facing = -ca; // engines face -x: visible when -x points toward the viewer-ish
    if ((pass < 0) !== (facing < 0)) return;
    for (const [y, dz, r] of [[-1.2, -.3, .95], [1.2, -.3, .95], [0, .75, 1.02]]) { const x = -11.6, ox = cx + (ca * x - sa * y) * P, oy = cY + (sa * x + ca * y) * P * cy - (z + dz) * hs;
      ctx.setTransform(-sa * P, ca * P * cy, 0, -hs, ox, oy); // basis: local y, up
      ctx.fillStyle = '#4b5361'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * .85); g.addColorStop(0, `rgba(255,255,255,${.4 + .6 * I})`); g.addColorStop(.4, `rgba(125,211,252,${.3 + .5 * I})`); g.addColorStop(1, 'rgba(30,41,59,1)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * .82, 0, TAU); ctx.fill(); }
  }
  return { draw, preview, build, bucketFor, BOX, get made() { return made; }, get cached() { return cache.size; } };
})();
