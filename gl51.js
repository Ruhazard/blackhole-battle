/* Blackhole Battle v3.4.0 — L51 "Expedition" WebGL renderer (prototype).
   Photographic-ish procedural look, no image assets: baked periodic nebula + per-pixel parallax stars, PBR-like impostor
   asteroids/moons/planets (fbm silhouette + bump, craters, AO, star key light, accretion-disk fill light, rim light),
   composite pass with gravitational lensing, photon ring, Doppler-beamed accretion disk (+ lensed far side), ACES tonemap.
   Quality tiers: 2 = high, 1 = mid, 0 = low (fewer octaves, no craters/derivative bump, lower scene resolution). */
window.BHGl51 = (() => {
  'use strict';
  let gl = null, cv = null, ok = false, P = {}, quad = null, neb = null, fbo = null, fbw = 0, fbh = 0, q = 2, deriv = false, scale = 1;
  const HP = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  const NOISE = `
float h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec3 h33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
  const VS_Q = 'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
  // ---------------------------------------------------------------- nebula bake (periodic so it tiles)
  const FS_NEB = HP + `varying vec2 v;
float hp(vec2 p,float per){p=mod(p,per);return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float np(vec2 x,float per){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(hp(i,per),hp(i+vec2(1,0),per),f.x),mix(hp(i+vec2(0,1),per),hp(i+vec2(1,1),per),f.x),f.y);}
float fb(vec2 x,float per){float s=0.,a=.5;for(int k=0;k<7;k++){s+=a*np(x,per);x*=2.;per*=2.;a*=.5;}return s;}
void main(){vec2 p=v*6.;float w1=fb(p+vec2(3.1,1.7),6.),w2=fb(p+vec2(8.3,2.8),6.);vec2 q=p+vec2(w1,w2)*2.2;q=mod(q,6.);
 float a=fb(q,6.),b=fb(q*1.+vec2(5.2,1.3),6.),d=fb(p*1.+vec2(1.7,9.2),6.);
 float gas=smoothstep(.42,.95,a),gas2=smoothstep(.5,.9,b),dust=smoothstep(.45,.75,d);
 vec3 c=vec3(.010,.008,.022);c+=vec3(.20,.06,.32)*gas*1.1;c+=vec3(.03,.16,.30)*gas2*.9;c+=vec3(.42,.12,.22)*pow(gas*gas2,1.5)*1.3;
 c*=1.-dust*.75;c+=vec3(.9,.7,1.)*pow(max(0.,a*b-.42),2.)*1.4;gl_FragColor=vec4(c,1.);}`;
  // ---------------------------------------------------------------- background (nebula parallax + 2 star layers)
  const FS_BG = HP + NOISE + `varying vec2 v;uniform sampler2D uN;uniform vec2 uRes,uCam;uniform float uS,uT;
float star(vec2 px,float cell,float th,float sz){vec2 c=floor(px/cell),f=px-c*cell;float hh=h12(c+17.3);if(hh<th)return 0.;
 vec2 sp=vec2(h12(c+3.1),h12(c+9.7))*cell;float d=length(f-sp);float tw=.75+.25*sin(uT*(1.+hh*3.)+hh*40.);return pow(max(0.,1.-d/sz),2.2)*(hh-th)/(1.-th)*tw;}
void main(){vec2 px=v*uRes;vec2 ctr=uRes*.5;vec2 w=vec2(px.x-ctr.x,ctr.y-px.y)/uS;
 vec2 nb=(w*.45+uCam*.10)/1500.;vec3 c=texture2D(uN,nb).rgb*1.05+texture2D(uN,nb*2.3+.37).rgb*.25;
 float s1=star(w*.8+uCam*.25+5000.,26.,.80,1.6),s2=star(w*1.+uCam*.5+9000.,52.,.86,2.3);vec2 cb=floor((w*1.+uCam*.5+9000.)/52.);
 vec3 tint=mix(vec3(.75,.85,1.),vec3(1.,.85,.7),h12(cb+2.));c+=vec3(.85,.88,1.)*s1*.9+tint*s2*1.7;gl_FragColor=vec4(c,1.);}`;
  // ---------------------------------------------------------------- bodies (impostor quads)
  const VS_B = 'attribute vec2 a;uniform vec2 uC,uRes;uniform float uR,uE;varying vec2 p;void main(){p=a*uE;vec2 s=uC+p*uR;gl_Position=vec4(s/uRes*2.-1.,0.,1.);gl_Position.y=-gl_Position.y;}';
  const FS_B = (oct, crat, der) => (der ? '#extension GL_OES_standard_derivatives : enable\n' : '') + HP + NOISE + `varying vec2 p;
uniform float uR,uSeed,uSpin,uTone,uType,uT;uniform vec3 uL;uniform vec3 uAmb;uniform vec4 uH[2];uniform vec2 uC;
float fbm(vec3 x){float s=0.,a=.5;for(int k=0;k<${oct};k++){s+=a*n3(x);x=x*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
void main(){
 vec3 sd=vec3(uSeed*17.,uSeed*31.,uSeed*7.)*3.;float th=atan(p.y,p.x);vec3 cs=vec3(cos(th),sin(th),0.);
 float planet=step(2.5,uType),moon=step(1.5,uType)*(1.-planet);
 float lump=(n3(cs*1.5+sd)-.5)*.46+(n3(cs*3.6+sd+4.)-.5)*.18+(n3(cs*8.+sd+9.)-.5)*.05;lump*=1.-planet;lump*=1.-moon*.75;
 float rr=.93+lump,l=length(p)/rr;float aa=1.6/(uR*rr);
 vec3 L=normalize(uL);
 if(l>1.){ if(planet>.5){float g=exp(-(l-1.)*9.)*smoothstep(1.4,1.,l);float lit=max(0.,dot(normalize(vec3(p,0.)),L)*.8+.35);gl_FragColor=vec4(vec3(.35,.55,1.)*g*lit*.9,0.);return;} discard; }
 vec3 n0=vec3(p/rr,sqrt(max(0.,1.-l*l)));
 float cz=cos(uSpin),sz=sin(uSpin),tl=.5+uSeed;vec3 q=vec3(cz*n0.x-sz*n0.y,sz*n0.x+cz*n0.y,n0.z);q=vec3(q.x,cos(tl)*q.y-sin(tl)*q.z,sin(tl)*q.y+cos(tl)*q.z);
 float hgt=fbm(q*(planet>.5?1.6:2.4)+sd);float ao=1.;
 ${crat ? `for(int k=0;k<7;k++){vec3 cd=normalize(h33(sd+float(k)*7.13)*2.-1.);float sz2=.16+.26*h13(sd+float(k)*3.7);sz2*=1.-planet;float d=length(q-cd)/sz2;
   if(d<1.25){float bowl=max(0.,1.-d*d);float rim=exp(-pow((d-1.)*5.,2.));hgt+=(-bowl*.55+rim*.22)*(1.-moon*.3);ao-=bowl*.35;}}` : ''}
 vec3 n=n0;
 ${der ? `float k2=planet>.5?.25:(moon>.5?.55:.85);vec2 g=vec2(dFdx(hgt),-dFdy(hgt))*uR*k2;n=normalize(vec3(n0.xy-g,n0.z));` : `n=normalize(n0+vec3(hgt-.5)*.0);`}
 // albedo
 vec3 rock=mix(vec3(.33,.29,.25),vec3(.23,.23,.25),uTone);rock=mix(rock,vec3(.42,.36,.30),smoothstep(.55,.8,n3(q*5.+sd))*.6);
 vec3 al=rock*(.75+.5*hgt);
 if(moon>.5)al=mix(vec3(.46,.45,.47),vec3(.62,.6,.58),hgt)*(.8+.3*n3(q*3.+sd));
 if(planet>.5){float lat=q.y*7.+fbm(q*3.+sd)*2.2;al=mix(vec3(.62,.44,.30),vec3(.86,.74,.58),.5+.5*sin(lat));al=mix(al,vec3(.55,.30,.22),smoothstep(.6,.9,n3(q*4.+sd))*.5);}
 if(uType>.5&&uType<1.5)al*=.8;
 ao*=.55+.45*smoothstep(.2,.7,hgt);
 float dif=max(0.,dot(n,L));dif=dif*.92+.08*max(0.,dot(n,L)+.3);
 vec3 col=al*dif*vec3(1.,.96,.9)*2.1;
 // fill light from accretion disks (warm), falls off with distance
 for(int k=0;k<2;k++){vec4 H=uH[k];if(H.z<=0.)continue;vec3 d3=vec3(H.xy-(uC+p*uR),uR*.6);float dd=length(d3);vec3 hl=d3/dd;col+=al*max(0.,dot(n,hl))*vec3(1.,.55,.25)*H.z*clamp(H.w/dd,0.,1.)*1.6;}
 col+=al*uAmb*(.35+.65*n.z)*ao;
 col*=ao;
 float fr=pow(1.-n0.z,3.);vec2 bl=-L.xy;col+=vec3(.35,.5,1.)*fr*(.25+.75*max(0.,dot(normalize(p+1e-4),normalize(bl+1e-4))))*(planet>.5?.6:.45);
 vec3 hv=normalize(L+vec3(0.,0.,1.));col+=vec3(1.)*pow(max(0.,dot(n,hv)),24.)*.10*(1.-planet)*ao;
 float A=smoothstep(1.,1.-aa,l);gl_FragColor=vec4(col*A,A);}`;
  // ---------------------------------------------------------------- composite (lensing + disks + white holes + tonemap)
  const FS_C = HP + NOISE + `varying vec2 v;uniform sampler2D uS;uniform vec2 uRes;uniform vec4 uH[2];uniform vec4 uD[2];uniform vec4 uW[2];uniform float uT,uQ,uGrain;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 diskEm(float rho,float ph,float rs,float sgn){ // rho in units of rs
 if(rho<1.9||rho>6.5)return vec3(0.);float w=1./pow(rho,1.25);float sh=ph+uT*1.7/pow(rho,1.5)*sgn;
 float turb=.55+.45*n3(vec3(cos(sh)*rho*1.7,sin(sh)*rho*1.7,rho*2.3))+.25*n3(vec3(cos(sh)*rho*5.,sin(sh)*rho*5.,rho*7.));
 float edge=smoothstep(1.9,2.4,rho)*smoothstep(6.5,4.,rho);float dop=1.+.75*cos(ph)*sgn;dop=max(.15,dop);
 vec3 c=mix(vec3(1.,.45,.12),vec3(1.,.86,.62),clamp(w*2.2,0.,1.));c=mix(c,vec3(.75,.85,1.),clamp(cos(ph)*sgn,0.,1.)*.35);return c*w*turb*edge*dop*dop*2.6;}
void main(){vec2 px=v*uRes;vec2 sp=px;vec3 add=vec3(0.);float shadow=1.;
 for(int k=0;k<2;k++){vec4 H=uH[k];if(H.z<=0.)continue;vec2 d=px-H.xy;float r=length(d);float rs=H.z;float th2=pow(rs*2.3,2.);
   sp-=d/max(r,1.)*th2/max(r,rs*.5)*smoothstep(rs*14.,rs*6.,r);
   shadow*=smoothstep(rs*.98,rs*1.08,r);
   // photon ring
   add+=vec3(1.,.8,.6)*exp(-pow((r-rs*1.12)/(rs*.06),2.))*.9*H.w;
   // disk: tilted plane (screen y squashed); near half over the shadow, far half hidden behind; lensed far-side arc around shadow
   vec4 D=uD[k];float tilt=D.x,sgn=D.y;vec2 dd=vec2(d.x,d.y/tilt);float rho=length(dd)/rs;float ph=atan(dd.y,dd.x);
   vec3 e=diskEm(rho,ph,rs,sgn)*H.w;float front=step(d.y,0.);float vis=front+(1.-front)*smoothstep(rs*1.02,rs*1.25,r);add+=e*vis;
   float ra=r/rs;if(ra>1.08&&ra<2.2){float rho2=1.9+(ra-1.08)*4.;float ph2=atan(-d.y,d.x);vec3 e2=diskEm(rho2,ph2+1.57,rs,sgn)*smoothstep(1.08,1.25,ra)*smoothstep(2.2,1.6,ra);
     add+=e2*H.w*(.55+.45*smoothstep(0.,rs,d.y));}
   add+=vec3(1.,.55,.2)*.05*H.w*exp(-r/(rs*5.));}
 vec3 c=texture2D(uS,sp/uRes).rgb*shadow;c+=add;
 for(int k=0;k<2;k++){vec4 Wh=uW[k];if(Wh.z<=0.)continue;vec2 d=px-Wh.xy;float r=length(d)/Wh.z;float a=atan(d.y,d.x);
   float rays=.5+.5*n3(vec3(cos(a)*3.,sin(a)*3.,uT*.6-r*.6));c+=vec3(.75,.9,1.)*(exp(-r*r*1.6)*2.2+exp(-r*.9)*.35*rays)*Wh.w;}
 c=aces(c*1.08);
 vec2 uv=v-.5;c*=1.-dot(uv,uv)*.55;
 c+=(h12(px+fract(uT)*91.)-.5)*uGrain;
 gl_FragColor=vec4(pow(c,vec3(.94)),1.);}`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.slice(0, 200)); return s; }
  function prog(vs, fs, names) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; for (const n of names) u[n] = gl.getUniformLocation(p, n); return { p, u }; }
  function mkTex(w, h, rep) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wr = rep ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr); return t; }
  function mkFbo(w, h, rep) { const t = mkTex(w, h, rep), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { t, f, w, h }; }
  function draw() { gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
  function buildBody() { const oct = q === 2 ? 4 : q === 1 ? 3 : 2; P.b = prog(VS_B, FS_B(oct, q >= 1, deriv && q >= 1), ['uC', 'uRes', 'uR', 'uE', 'uSeed', 'uSpin', 'uTone', 'uType', 'uT', 'uL', 'uAmb', 'uH']); }
  function init(canvas) {
    cv = canvas; try { gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return (ok = false); try {
      deriv = !!gl.getExtension('OES_standard_derivatives');
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      P.neb = prog(VS_Q, FS_NEB, []); P.bg = prog(VS_Q, FS_BG, ['uN', 'uRes', 'uCam', 'uS', 'uT']); P.c = prog(VS_Q, FS_C, ['uS', 'uRes', 'uH', 'uD', 'uW', 'uT', 'uQ', 'uGrain']); buildBody();
      neb = mkFbo(1024, 1024, true); gl.bindFramebuffer(gl.FRAMEBUFFER, neb.f); gl.viewport(0, 0, 1024, 1024); gl.useProgram(P.neb.p); draw(); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, neb.t); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); ok = false; }, false);
      ok = true; } catch (e) { console.warn('gl51', e); ok = false; }
    return ok; }
  function setQuality(n) { if (!gl || n === q) return; q = n; try { buildBody(); } catch (e) { console.warn(e); } }
  function resize(w, h) { const fw = Math.max(1, Math.round(w * scale)), fh = Math.max(1, Math.round(h * scale)); if (fbo && fbw === fw && fbh === fh) return; if (fbo) { gl.deleteTexture(fbo.t); gl.deleteFramebuffer(fbo.f); } fbo = mkFbo(fw, fh, false); fbw = fw; fbh = fh; }
  // V: {w,h (device px), S (device px per world unit), cx, cy (camera centre, world)}, bodies: [{x,y,r,type,seed,spin,tone}], holes [{x,y,rs,disk,tilt,sgn}], whites [{x,y,r}]
  function render(V, bodies, holes, whites, t, star) {
    if (!ok) return false; scale = q === 2 ? 1 : q === 1 ? .8 : .62; resize(V.w, V.h); const fw = fbw, fh = fbh, k = fw / V.w, S = V.S * k;
    const sx = x => (x - V.cx) * S + fw / 2, sy = y => (y - V.cy) * S + fh / 2;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.f); gl.viewport(0, 0, fw, fh); gl.disable(gl.BLEND);
    gl.useProgram(P.bg.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, neb.t); gl.uniform1i(P.bg.u.uN, 0); gl.uniform2f(P.bg.u.uRes, fw, fh); gl.uniform2f(P.bg.u.uCam, V.cx, V.cy); gl.uniform1f(P.bg.u.uS, S); gl.uniform1f(P.bg.u.uT, t); draw();
    // bodies: premultiplied alpha over
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); const B = P.b; gl.useProgram(B.p); gl.uniform2f(B.u.uRes, fw, fh); gl.uniform1f(B.u.uT, t);
    gl.uniform3f(B.u.uL, star.x, star.y, .62); gl.uniform3f(B.u.uAmb, .07, .06, .11);
    const hu = new Float32Array(8); holes.slice(0, 2).forEach((h, i) => { hu[i * 4] = sx(h.x) / k; hu[i * 4 + 1] = sy(h.y) / k; hu[i * 4 + 2] = h.disk; hu[i * 4 + 3] = h.rs * 7 * V.S; });
    // (fill light uses body-shader pixel space = FBO px)
    for (let i = 0; i < 2; i++) { hu[i * 4] *= k; hu[i * 4 + 1] *= k; hu[i * 4 + 3] *= k; } gl.uniform4fv(B.u.uH, hu);
    let drawn = 0; const mx = fw * .5 / S + 80, my = fh * .5 / S + 80;
    for (const o of bodies) { if (Math.abs(o.x - V.cx) > mx + o.r || Math.abs(o.y - V.cy) > my + o.r) continue; const e = o.type === 3 ? 1.45 : 1.25;
      gl.uniform2f(B.u.uC, sx(o.x), sy(o.y)); gl.uniform1f(B.u.uR, o.r * S); gl.uniform1f(B.u.uE, e); gl.uniform1f(B.u.uSeed, o.seed); gl.uniform1f(B.u.uSpin, o.spin); gl.uniform1f(B.u.uTone, o.tone || 0); gl.uniform1f(B.u.uType, o.type); draw(); drawn++; }
    gl.disable(gl.BLEND);
    // composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, V.w, V.h); const C = P.c; gl.useProgram(C.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbo.t); gl.uniform1i(C.u.uS, 0);
    gl.uniform2f(C.u.uRes, V.w, V.h); gl.uniform1f(C.u.uT, t); gl.uniform1f(C.u.uQ, q); gl.uniform1f(C.u.uGrain, q === 2 ? .025 : 0);
    const X = x => (x - V.cx) * V.S + V.w / 2, Y = y => V.h - ((y - V.cy) * V.S + V.h / 2); // composite runs in GL pixel space (y up)
    const H = new Float32Array(8), D = new Float32Array(8), Wv = new Float32Array(8);
    holes.slice(0, 2).forEach((h, i) => { H[i * 4] = X(h.x); H[i * 4 + 1] = Y(h.y); H[i * 4 + 2] = h.rs * V.S * 1.25; H[i * 4 + 3] = h.disk; D[i * 4] = h.tilt || .24; D[i * 4 + 1] = h.sgn || 1; });
    whites.slice(0, 2).forEach((h, i) => { Wv[i * 4] = X(h.x); Wv[i * 4 + 1] = Y(h.y); Wv[i * 4 + 2] = h.r * V.S * 1.6; Wv[i * 4 + 3] = 1; });
    gl.uniform4fv(C.u.uH, H); gl.uniform4fv(C.u.uD, D); gl.uniform4fv(C.u.uW, Wv); draw();
    return drawn; }
  return { init, render, setQuality, get ok() { return ok; }, get quality() { return q; }, get deriv() { return deriv; } };
})();
