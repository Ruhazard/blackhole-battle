/* Blackhole Battle v3.1 — WebGL post-processing: gravitational lensing, bloom, chromatic aberration, breathing, slow-mo grade */
window.BHGfx = (() => {
  'use strict';
  let gl = null, cvs = null, ok = false, lost = false, P = {}, tex = null, quad = null, fbA = null, fbB = null, bw = 0, bh = 0;
  const MAXL = 8;
  const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS_BRIGHT = `precision mediump float;varying vec2 uv;uniform sampler2D uS;
void main(){vec3 c=texture2D(uS,uv).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(.45,1.,l)*1.6,1.);}`;
  const FS_BLUR = `precision mediump float;varying vec2 uv;uniform sampler2D uS;uniform vec2 uD;
void main(){vec3 c=texture2D(uS,uv).rgb*.227;c+=(texture2D(uS,uv+uD*1.385).rgb+texture2D(uS,uv-uD*1.385).rgb)*.316;c+=(texture2D(uS,uv+uD*3.23).rgb+texture2D(uS,uv-uD*3.23).rgb)*.07;gl_FragColor=vec4(c,1.);}`;
  const FS_MAIN = `precision mediump float;varying vec2 uv;
uniform sampler2D uS,uB;uniform vec2 uRes;uniform vec4 uH[${MAXL}];uniform int uN;uniform float uT,uBreath,uSlow,uBloom,uCA,uVig;
vec2 mir(vec2 q){return 1.-abs(1.-mod(q,2.));}
void main(){
  vec2 P0=vec2(uv.x,1.-uv.y)*uRes;vec2 C=uRes*.5;vec2 P=C+(P0-C)*(1.-uBreath);
  vec2 off=vec2(0.);float hor=0.,ring=0.,ca=uCA,glow=0.;
  for(int i=0;i<${MAXL};i++){if(i>=uN)break;vec4 h=uH[i];vec2 d=P-h.xy;float l=max(length(d),.001);float r=h.z;
    if(h.w>0.){float rE=r*2.15*h.w;float fall=1.-smoothstep(rE*2.,rE*4.6,l);
      off-=d/l*(rE*rE/l)*fall;hor=max(hor,1.-smoothstep(r*.97,r*1.03,l));
      float rr=(l-r*1.1)/(r*.07);ring+=exp(-rr*rr)*h.w;glow+=exp(-max(l-r,0.)/(r*.9))*.35*h.w;
      ca+=fall*(1.-smoothstep(r,rE*2.2,l))*2.;}
    else{float rE=r*2.4*(-h.w);float fall=1.-smoothstep(rE*1.5,rE*4.,l);off+=d/l*(rE*rE/l)*.3*fall;}}
  vec2 Q=P+off;vec2 dir=normalize(off+vec2(.0001,0.));vec2 cd=dir*ca/uRes;cd.y=-cd.y;
  vec2 q=Q/uRes;q.y=1.-q.y;
  vec3 col;col.r=texture2D(uS,mir(q+cd)).r;col.g=texture2D(uS,mir(q)).g;col.b=texture2D(uS,mir(q-cd)).b;
  col+=texture2D(uB,mir(q)).rgb*uBloom;
  col=mix(col,vec3(0.),hor);col+=vec3(1.,.72,.42)*min(ring,1.4)*.85*(1.-hor)+vec3(.55,.3,.9)*glow*(1.-hor);
  float g=dot(col,vec3(.3,.59,.11));col=mix(col,vec3(g)*vec3(.75,.85,1.25),uSlow*.5);
  vec2 v=(P0-C)/uRes.y;float vig=smoothstep(1.05,.25,length(v)*1.35);col*=mix(1.-uVig,1.,vig);
  gl_FragColor=vec4(col,1.);}`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(fs, unis) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const o = { p, u: {} }; unis.forEach(n => o.u[n] = gl.getUniformLocation(p, n)); return o;
  }
  function mkTex(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); return t;
  }
  function mkFB(w, h) { const t = mkTex(w, h); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { f, t }; }
  function init(canvas) {
    cvs = canvas;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) return false;
      P.main = prog(FS_MAIN, ['uS', 'uB', 'uRes', 'uH', 'uN', 'uT', 'uBreath', 'uSlow', 'uBloom', 'uCA', 'uVig']);
      P.bright = prog(FS_BRIGHT, ['uS']); P.blur = prog(FS_BLUR, ['uS', 'uD']);
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      tex = mkTex(0, 0);
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; ok = false; });
      ok = true;
    } catch (e) { console.warn('WebGL off:', e.message); ok = false; }
    return ok;
  }
  function resize(w, h, scale) {
    if (!ok) return; cvs.width = Math.round(w * scale); cvs.height = Math.round(h * scale);
    const nbw = Math.max(16, Math.round(w * scale / 4)), nbh = Math.max(16, Math.round(h * scale / 4));
    if (nbw !== bw || nbh !== bh) { bw = nbw; bh = nbh; fbA = mkFB(bw, bh); fbB = mkFB(bw, bh); }
  }
  const HU = new Float32Array(MAXL * 4);
  // o: {lenses:[{x,y,r,s}], w,h (css px), t, breath, slow, bloom(0..1), passes, ca, vig}
  function render(src, o) {
    if (!ok || lost) return false;
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (o.bloom > 0) {
      gl.viewport(0, 0, bw, bh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbA.f); gl.useProgram(P.bright.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(P.bright.u.uS, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.useProgram(P.blur.p); gl.uniform1i(P.blur.u.uS, 0);
      for (let k = 0; k < (o.passes || 1); k++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbB.f); gl.bindTexture(gl.TEXTURE_2D, fbA.t); gl.uniform2f(P.blur.u.uD, (1 + k) / bw, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbA.f); gl.bindTexture(gl.TEXTURE_2D, fbB.t); gl.uniform2f(P.blur.u.uD, 0, (1 + k) / bh); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cvs.width, cvs.height);
    const m = P.main; gl.useProgram(m.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(m.u.uS, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbA ? fbA.t : tex); gl.uniform1i(m.u.uB, 1); gl.activeTexture(gl.TEXTURE0);
    const n = Math.min(MAXL, o.lenses.length); HU.fill(0);
    for (let i = 0; i < n; i++) { const l = o.lenses[i]; HU[i * 4] = l.x; HU[i * 4 + 1] = l.y; HU[i * 4 + 2] = l.r; HU[i * 4 + 3] = l.s; }
    gl.uniform4fv(m.u.uH, HU); gl.uniform1i(m.u.uN, n); gl.uniform2f(m.u.uRes, o.w, o.h); gl.uniform1f(m.u.uT, o.t);
    gl.uniform1f(m.u.uBreath, o.breath || 0); gl.uniform1f(m.u.uSlow, o.slow || 0); gl.uniform1f(m.u.uBloom, o.bloom || 0); gl.uniform1f(m.u.uCA, o.ca || 0); gl.uniform1f(m.u.uVig, o.vig == null ? 0.35 : o.vig);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }
  return { init, resize, render, get ok() { return ok && !lost; } };
})();
