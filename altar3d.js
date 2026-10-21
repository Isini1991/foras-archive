(() => {
const stage = document.getElementById("stage");
const A = window.FORAS_ALBUMS, TEX = window.FORAS_TEX || { covers: {} };
if (!stage || !window.THREE) return;
const T = window.THREE;

let renderer;
try {
  renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
} catch (e) { return; }
if (!renderer.getContext()) return;

const PW = 960, PH = 1280, OVER = 1.06, PLANE_W = 3 * OVER, PLANE_H = 4 * OVER, CAM_Z = 7.46;
const mobile = matchMedia("(max-width: 860px)").matches;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const uvOf = (x, y) => new T.Vector2(x / PW, 1 - y / PH);
const worldOf = (x, y, z) => {
  const k = (CAM_Z - z) / CAM_Z;
  return new T.Vector3((x / PW - 0.5) * PLANE_W * k, (0.5 - y / PH) * PLANE_H * k, z);
};

renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
renderer.setClearColor(0x000000);
const canvas = renderer.domElement;
canvas.className = "altar-gl";
canvas.setAttribute("aria-hidden", "true");

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(30, 3 / 4, 0.1, 50);
camera.position.set(0, 0, CAM_Z);

function depthTexture() {
  const c = document.createElement("canvas"); c.width = 240; c.height = 320;
  const g = c.getContext("2d"), s = 0.25;
  g.fillStyle = "#000"; g.fillRect(0, 0, 240, 320);
  g.globalCompositeOperation = "lighten";
  const shade = (v) => `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`;
  const rect = (x0, y0, x1, y1, v) => { g.fillStyle = shade(v); g.fillRect(x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s); };
  const ell = (cx, cy, rx, ry, v0, v1) => {
    const gr = g.createRadialGradient(cx * s, cy * s, 0, cx * s, cy * s, rx * s);
    gr.addColorStop(0, shade(v0)); gr.addColorStop(1, shade(v1));
    g.save(); g.translate(cx * s, cy * s); g.scale(1, ry / rx); g.translate(-cx * s, -cy * s);
    g.fillStyle = gr; g.beginPath(); g.arc(cx * s, cy * s, rx * s, 0, Math.PI * 2); g.fill(); g.restore();
  };
  const bottom = g.createLinearGradient(0, 960 * s, 0, 320);
  bottom.addColorStop(0, shade(0.3)); bottom.addColorStop(1, shade(0.85));
  g.fillStyle = bottom; g.fillRect(0, 960 * s, 240, 320);
  rect(290, 400, 690, 800, 0.22);
  rect(170, 330, 205, 1100, 0.34); rect(785, 350, 820, 1050, 0.34);
  rect(100, 720, 230, 960, 0.4); rect(760, 720, 900, 950, 0.4);
  ell(490, 985, 300, 90, 0.55, 0.45);
  ell(487, 805, 120, 140, 0.78, 0.6);
  rect(40, 470, 90, 1100, 0.58); rect(835, 540, 890, 1130, 0.58);
  rect(225, 760, 305, 1130, 0.64); rect(685, 720, 745, 1010, 0.52); rect(735, 790, 810, 1130, 0.66);
  ell(30, 940, 70, 120, 0.6, 0.45);
  rect(395, 915, 580, 1220, 0.8);
  const small = document.createElement("canvas"); small.width = 48; small.height = 64;
  small.getContext("2d").drawImage(c, 0, 0, 48, 64);
  const out = document.createElement("canvas"); out.width = 240; out.height = 320;
  const og = out.getContext("2d"); og.imageSmoothingQuality = "high"; og.drawImage(small, 0, 0, 240, 320);
  const tex = new T.CanvasTexture(out); tex.minFilter = T.LinearFilter;
  return tex;
}

const FLAMES = [[60, 490], [185, 330], [255, 770], [712, 730], [772, 810], [805, 350], [878, 545]];
const flameU = FLAMES.map(([x, y]) => { const u = uvOf(x, y); return new T.Vector3(u.x, u.y, 1); });

const photoMat = new T.ShaderMaterial({
  uniforms: {
    tPhoto: { value: null }, tDepth: { value: depthTexture() },
    uPar: { value: new T.Vector2() }, uTime: { value: 0 }, uLit: { value: 1 },
    uFlames: { value: flameU }, uSigil: { value: new T.Vector3(490 / PW, 1 - 592 / PH, 108 / PH) },
  },
  vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader: `
    uniform sampler2D tPhoto,tDepth;uniform vec2 uPar;uniform float uTime,uLit;uniform vec3 uFlames[7];uniform vec3 uSigil;
    varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      float d=texture2D(tDepth,vUv).r;
      vec2 uv=clamp(vUv+uPar*(d-.35),0.,1.);
      vec3 c=texture2D(tPhoto,uv).rgb;
      float lum=dot(c,vec3(.299,.587,.114));
      vec3 warm=vec3(0.);float mean=0.;
      for(int i=0;i<7;i++){
        vec2 q=(uv-uFlames[i].xy)*vec2(.75,1.);
        warm+=vec3(1.,.6,.28)*uFlames[i].z*exp(-dot(q,q)*55.);
        mean+=uFlames[i].z;
      }
      mean/=7.;
      vec3 lit=c*(.8+.25*mean)+c*warm*.55;
      vec2 sq=(uv-uSigil.xy)*vec2(.75,1.);
      float disc=(1.-smoothstep(uSigil.z*.88,uSigil.z,length(sq)))*smoothstep(uSigil.y-uSigil.z*.62,uSigil.y-uSigil.z*.45,uv.y);
      float lines=smoothstep(.42,.72,lum)*disc;
      float pulse=.5+.5*sin(uTime*.7);
      vec3 col=mix(c*.11,lit,uLit);
      col=mix(col,vec3(.62,.1,.07)*(.7+lum),lines*mix(.85,.18+.32*pulse,uLit));
      vec2 v=vUv-.5;col*=1.-dot(v,v)*.9;
      col+=(hash(vUv*vec2(960.,1280.)+fract(uTime))-.5)*.035;
      gl_FragColor=vec4(col,1.);
    }`,
});
const photo = new T.Mesh(new T.PlaneGeometry(PLANE_W, PLANE_H), photoMat);
scene.add(photo);

function blobTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  for (let i = 0; i < 18; i++) {
    const x = 20 + Math.random() * 24, y = 20 + Math.random() * 24, r = 8 + Math.random() * 14;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  return new T.CanvasTexture(c);
}
const SMOKE_N = mobile ? 70 : 120;
const smokeGeo = new T.BufferGeometry();
const sp = new Float32Array(SMOKE_N * 3), ss = new Float32Array(SMOKE_N);
const SOURCES = [worldOf(190, 1200, 0.45), worldOf(775, 1225, 0.45)];
for (let i = 0; i < SMOKE_N; i++) {
  const src = SOURCES[i % 2];
  sp.set([src.x, src.y, src.z], i * 3); ss[i] = Math.random();
}
smokeGeo.setAttribute("position", new T.BufferAttribute(sp, 3));
smokeGeo.setAttribute("aSeed", new T.BufferAttribute(ss, 1));
const smokeMat = new T.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uLit: { value: 1 }, uTex: { value: blobTexture() }, uScale: { value: 1 } },
  vertexShader: `
    attribute float aSeed;uniform float uTime,uScale;varying float vA;varying float vRot;
    void main(){
      float life=fract(uTime*.055+aSeed);
      vec3 p=position;
      p.y+=life*3.1;
      p.x+=sin(life*5.+aSeed*31.)*.32*life+sin(uTime*.3+aSeed*6.)*.06+(aSeed-.5)*.1;
      p.z+=life*.3;
      vA=smoothstep(0.,.3,life)*(1.-life);
      vRot=aSeed*6.28+life*1.5;
      vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_PointSize=(70.+life*200.)*uScale/-mv.z;
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader: `
    uniform sampler2D uTex;uniform float uLit;varying float vA;varying float vRot;
    void main(){
      vec2 c=gl_PointCoord-.5;float s=sin(vRot),co=cos(vRot);
      c=mat2(co,-s,s,co)*c+.5;
      float a=texture2D(uTex,c).a*vA*.55;
      gl_FragColor=vec4(mix(vec3(.24,.23,.22),vec3(.78,.74,.68),uLit),a);
    }`,
  transparent: true, depthWrite: false,
});
scene.add(new T.Points(smokeGeo, smokeMat));

const MOTE_N = mobile ? 24 : 40;
const moteGeo = new T.BufferGeometry();
const mp = new Float32Array(MOTE_N * 3), ms = new Float32Array(MOTE_N);
for (let i = 0; i < MOTE_N; i++) {
  mp.set([(Math.random() - 0.5) * 2.8, (Math.random() - 0.6) * 3, 0.2 + Math.random() * 0.9], i * 3); ms[i] = Math.random();
}
moteGeo.setAttribute("position", new T.BufferAttribute(mp, 3));
moteGeo.setAttribute("aSeed", new T.BufferAttribute(ms, 1));
const moteMat = new T.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uLit: { value: 1 }, uScale: { value: 1 } },
  vertexShader: `
    attribute float aSeed;uniform float uTime,uScale;varying float vA;
    void main(){
      float life=fract(uTime*.03+aSeed);
      vec3 p=position;p.y+=life*1.4;p.x+=sin(uTime*.4+aSeed*20.)*.08;
      vA=sin(life*3.14159)*(.5+.5*sin(uTime*3.+aSeed*40.));
      vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_PointSize=(1.5+aSeed*2.)*uScale/-mv.z*7.;
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader: `
    uniform float uLit;varying float vA;
    void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d)*vA*.4*uLit;gl_FragColor=vec4(1.,.72,.42,a);}`,
  transparent: true, depthWrite: false, blending: T.AdditiveBlending,
});
scene.add(new T.Points(moteGeo, moteMat));

const ambient = new T.AmbientLight(0x3a2a22, 0.55);
scene.add(ambient);
const LIGHTS = [[150, 600, 0], [270, 760, 2], [760, 780, 4], [850, 450, 6]].map(([x, y, fi]) => {
  const l = new T.PointLight(0xffa060, 1.1, 5, 1.6);
  l.position.copy(worldOf(x, y, 1.1)); l.userData.fi = fi; scene.add(l); return l;
});

const CASE_Z = 0.42;
const casePos = worldOf(487, 1067, CASE_Z);
const caseK = (CAM_Z - CASE_Z) / CAM_Z;
const CW = 0.585 * OVER * caseK, CH = 0.96 * OVER * caseK, CD = 0.11;
const tape = new T.Group();
tape.position.copy(casePos);
scene.add(tape);
const plastic = new T.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.35, metalness: 0.1 });
const frontMat = new T.MeshStandardMaterial({ roughness: 0.42, metalness: 0.05 });
const backMat = new T.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 });
const body = new T.Mesh(new T.BoxGeometry(CW, CH, CD), [plastic, plastic, plastic, plastic, frontMat, backMat]);
tape.add(body);
const shell = new T.Mesh(new T.BoxGeometry(CW * 1.03, CH * 1.015, CD * 1.18),
  new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.09, depthWrite: false }));
tape.add(shell);


function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(" "); let line = "", lines = [];
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, x, y + i * lh));
}
function cardTextures(al, img) {
  const W = 512, H = 840;
  const f = document.createElement("canvas"); f.width = W; f.height = H;
  const g = f.getContext("2d");
  g.fillStyle = "#0b0b0c"; g.fillRect(0, 0, W, H);
  if (img) g.drawImage(img, 16, 16, W - 32, W - 32);
  g.strokeStyle = "rgba(200,185,157,.35)"; g.lineWidth = 2; g.strokeRect(16, 16, W - 32, W - 32);
  g.fillStyle = "#d9cdb3"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = '64px "Unifraktur", serif'; wrap(g, al.artist, W / 2, W + 90, W - 60, 66);
  g.fillStyle = "#c8b99d"; g.font = '600 26px "Cinzel", serif'; wrap(g, al.title, W / 2, H - 120, W - 60, 32);
  const b = document.createElement("canvas"); b.width = W; b.height = H;
  const h = b.getContext("2d");
  h.fillStyle = "#c8b99d"; h.fillRect(0, 0, W, H);
  h.fillStyle = "#1c1712"; h.textAlign = "center";
  h.font = '72px "Unifraktur", serif'; h.fillText("Foras", W / 2, 140);
  h.font = '600 24px "Cinzel", serif'; wrap(h, al.title, W / 2, 230, W - 80, 32);
  h.font = '22px "JetBrains", monospace';
  h.fillText(al.genre.slice(0, 36), W / 2, 380);
  h.fillText(`${al.posts.length} chapters`, W / 2, 420);
  h.fillText(new Date(al.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }), W / 2, 460);
  h.strokeStyle = "#7a1c1c"; h.lineWidth = 3; h.beginPath(); h.arc(W / 2, 640, 80, 0, Math.PI * 2); h.stroke();
  h.font = '120px "Unifraktur", serif'; h.fillStyle = "#7a1c1c"; h.textBaseline = "middle"; h.fillText("F", W / 2, 645);
  const ft = new T.CanvasTexture(f), bt = new T.CanvasTexture(b);
  [ft, bt].forEach((t) => { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); });
  return [ft, bt];
}
const imgCache = {};
function loadImg(src) {
  return imgCache[src] || (imgCache[src] = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
}
const REST = -0.24;
let rot = REST, target = REST, dragging = false, lastX = 0, pendingSwap = null, hidden = false;
async function setOffering(i) {
  const al = A[i];
  hidden = al.id === "album-10";
  const img = await loadImg(TEX.covers[al.id] || al.cover);
  const [ft, bt] = cardTextures(al, img);
  pendingSwap = { ft, bt, at: rot + Math.PI };
  target = Math.round((rot - REST) / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2 + REST;
}
function applySwap() {
  if (frontMat.map) frontMat.map.dispose();
  if (backMat.map) backMat.map.dispose();
  frontMat.map = pendingSwap.ft; backMat.map = pendingSwap.bt;
  frontMat.needsUpdate = backMat.needsUpdate = true;
  pendingSwap = null;
}

const pointer = new T.Vector2(), par = new T.Vector2();
stage.addEventListener("pointermove", (e) => {
  const r = stage.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  if (dragging) { target += (e.clientX - lastX) * 0.012; lastX = e.clientX; }
});
stage.addEventListener("pointerleave", () => pointer.set(0, 0));
canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); stage.classList.add("dragging"); });
const release = () => { dragging = false; stage.classList.remove("dragging"); target = Math.round((target - REST) / (Math.PI * 2)) * Math.PI * 2 + REST; };
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const scale = h * renderer.getPixelRatio() / 4.4;
  smokeMat.uniforms.uScale.value = moteMat.uniforms.uScale.value = scale / 100;
}
new ResizeObserver(resize).observe(stage);

let running = false, t0 = performance.now(), lit = 1, raf = 0;
const flick = (t, s) => 0.78 + 0.12 * Math.sin(t * 7.3 + s * 3.1) + 0.07 * Math.sin(t * 13.7 + s * 5.3) + 0.05 * Math.sin(t * 23.1 + s);
function frame(now) {
  raf = 0;
  if (!running) return;
  const t = still ? 4 : (now - t0) / 1000;
  const wantLit = stage.classList.contains("snuffed") ? 0 : 1;
  lit += (wantLit - lit) * 0.06;
  const drift = still ? 0 : 1;
  par.x += ((pointer.x + Math.sin(t * 0.17) * 0.35 * drift) - par.x) * 0.05;
  par.y += ((pointer.y + Math.sin(t * 0.13 + 1) * 0.25 * drift) - par.y) * 0.05;
  camera.position.set(par.x * 0.2, par.y * 0.16, CAM_Z);
  camera.lookAt(0, 0, 0);
  photoMat.uniforms.uPar.value.set(par.x * 0.011, par.y * 0.009);
  flameU.forEach((f, i) => { f.z = still ? 0.85 : flick(t, i); });
  LIGHTS.forEach((l) => { l.intensity = 1.25 * flameU[l.userData.fi].z * lit; });
  ambient.intensity = 0.25 + 0.35 * lit;
  photoMat.uniforms.uTime.value = smokeMat.uniforms.uTime.value = moteMat.uniforms.uTime.value = t;
  photoMat.uniforms.uLit.value = smokeMat.uniforms.uLit.value = moteMat.uniforms.uLit.value = lit;
  rot += (target - rot) * (dragging ? 0.35 : 0.075);
  if (pendingSwap && rot >= pendingSwap.at) applySwap();
  tape.rotation.y = rot;
  tape.rotation.x = -par.y * 0.04;
  const s = tape.scale.x + ((hidden ? 0.0001 : 1) - tape.scale.x) * 0.15;
  tape.scale.setScalar(s);
  tape.visible = s > 0.01;
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}
function setRunning(on) {
  running = on && !document.hidden;
  if (running && !raf) raf = requestAnimationFrame(frame);
}
let inView = false;
new IntersectionObserver(([e]) => { inView = e.isIntersecting; setRunning(inView); }).observe(stage);
document.addEventListener("visibilitychange", () => setRunning(inView));
stage.addEventListener("offering", (e) => setOffering(e.detail));

new T.TextureLoader().load(TEX.altar || "img/album-10/p01-1.webp", (tex) => {
  tex.minFilter = T.LinearFilter;
  photoMat.uniforms.tPhoto.value = tex;
  const start = A.findIndex((a, i) => document.querySelector(`#picks button[data-o="${i}"]`)?.getAttribute("aria-pressed") === "true");
  (document.fonts ? document.fonts.load('64px "Unifraktur"').then(() => document.fonts.load('600 26px "Cinzel"')) : Promise.resolve())
    .catch(() => {}).then(() => setOffering(Math.max(0, start))).then(() => {
      rot = target; if (pendingSwap) applySwap();
      stage.prepend(canvas);
      resize();
      tape.rotation.y = rot;
      renderer.render(scene, camera);
      stage.classList.add("gl");
      setRunning(inView);
    });
});
})();
