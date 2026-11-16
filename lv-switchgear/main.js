// "The Power Room": a pop-up book explains low-voltage switchgear in a data center. render(t) is a pure function of t.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, lerp, seg, ss, eio, eo, back, spring, TAU, mulberry, track } from './engine/lib.js';
import { cv } from './engine/paper.js';
import { makeBook, coverCanvases, texOf, BW, BD, PG } from './engine/book.js';
import { cutMesh, particles, thread } from './engine/cutmesh.js';
import { makePost } from './engine/post.js';
import { UD, patchDesat } from './engine/desat.js';
import * as A from './art.js';
import { VO, DUR, T, voCues } from './story.js';

const W = 1920, H = 1080, Q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('stage').appendChild(renderer.domElement);
const ov = document.getElementById('ov'), OX = ov.getContext('2d');
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, W / H, .004, 30);
const post = makePost(renderer, scene, cam, W, H);

// ---------- assets ----------
await Promise.all(['500 40px Fredoka', '600 40px Fredoka', '700 40px Fredoka', '40px "Lilita One"', 'italic 40px "IM Fell English"'].map(f => document.fonts.load(f, 'Aa0')));
const DURS = await (await fetch('voices/dur.json')).json();
const hdr = await new RGBELoader().loadAsync('/core/assets/polyhaven/lythwood_lounge_2k.hdr'); hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = hdr; scene.background = hdr; scene.backgroundBlurriness = .22;
scene.backgroundRotation.set(0, 2.3, 0); scene.environmentRotation.set(0, 2.3, 0);
const tl = new THREE.TextureLoader();
const wt = n => { const t = tl.load(`/core/assets/polyhaven/walnut_${n}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.2, 1.4); t.anisotropy = 12; return t; };
const wdiff = wt('diff'); wdiff.colorSpace = THREE.SRGBColorSpace;
const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, .04, 1.7), new THREE.MeshStandardMaterial({ map: wdiff, normalMap: wt('nor'), roughnessMap: wt('rough'), color: '#c9a88a', envMapIntensity: .8 }));
desk.position.set(0, -.02, .25); desk.receiveShadow = true; scene.add(desk);
const gl = new GLTFLoader();
async function prop(name, x, z, s, ry) {
  const m = (await gl.loadAsync(`/core/assets/polyhaven/${name}/${name}.gltf`)).scene;
  m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = ry;
  m.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  scene.add(m); return m;
}
const lamp = await prop('desk_lamp_arm_01', -.347, .51, .55, -.76);
lamp.traverse(o => { if (o.isMesh && o.material.name.includes('light')) { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ffd9a0'); o.material.emissiveIntensity = 6; } });
const tea = await prop('tea_set_01', 0, 0, 1, 0);
{ const keep = { tea_set_01_cup_small_01: [.36, .5, 2.2], tea_set_01_saucer_circular_04: [.36, .5, 0] }, dead = [];
  tea.traverse(o => { if (!o.name.startsWith('tea_set_01_')) return; const k = keep[o.name]; if (!k) dead.push(o); else { o.position.x = k[0]; o.position.z = k[1]; o.rotation.y = k[2]; } });
  dead.forEach(o => o.parent && o.parent.remove(o));
  tea.traverse(o => { if (o.name === 'tea_set_01_cup_small_01') o.position.y += .012; }); }
{ // pencil
  const g = new THREE.Group(), M = (c, r = .6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.0038, .0038, .15, 6), M('#f2b632', .5)), wood = new THREE.Mesh(new THREE.CylinderGeometry(.0038, .0008, .018, 6), M('#e8c79a', .8));
  const lead = new THREE.Mesh(new THREE.CylinderGeometry(.0008, .0001, .004, 6), M('#333', .4)), ferr = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .012, 12), M('#c9c2b0', .3, 1)), eras = new THREE.Mesh(new THREE.CylinderGeometry(.0039, .0039, .01, 12), M('#e88a8a', .9));
  wood.position.y = .084; lead.position.y = .095; ferr.position.y = -.081; eras.position.y = -.092;
  g.add(body, wood, lead, ferr, eras); g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.rotation.set(0, .5, Math.PI / 2); g.position.set(.3, .0038, .38); scene.add(g);
}

// ---------- book ----------
const book = makeBook(coverCanvases());
scene.add(book.root); book.setOpen(Math.PI / 2);
const P = A.pages(), PT = {}; for (const k in P) PT[k] = texOf(P[k]);
patchDesat(book.groundMat); patchDesat(book.backMat);
const S = book.stage, K = book.sky;

// ---------- pop-up pieces ----------
const POPS = [];
function piece(parent, item, x, y, z, o = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const m = cutMesh(item, o); g.add(m); parent.add(g);
  const r = { g, m, t0: o.t0 ?? 0, tf: o.tf ?? 1e9, dir: o.dir ?? (z > .15 ? -1 : 1), sway: o.sway || 0, ph: o.ph ?? x * 40, pop: o.pop !== false, sky: parent === K };
  POPS.push(r); return r;
}
const riseOf = (r, t) => Math.min(r.pop ? back(seg(t, r.t0, r.t0 + .55), 1.7) : +(t >= r.t0), 1 - ss(seg(t, r.tf, r.tf + .4)));
const dz1 = z => T.rise1 + (.3 - z) * 1.4 - .05, dz2 = z => T.rise2 + (.3 - z) * 1.3;
const F1 = z => T.turn[0] - .35 + (.3 - z) * .5;           // spread 1 folds just before the leaf lifts
const F2 = z => T.fold2 + (z - .07) * 2.2;                 // ending: front pieces fold first

// spread 1: the path
const sp1 = [];
sp1.push(piece(S, A.tree(.06, '#5fbf8a', '#3f9c6c', 3), -.205, 0, .2, { t0: dz1(.2), tf: F1(.2), sway: .02 }));
sp1.push(piece(S, A.bush(.05, .022, '#6fcf9a', '#49a877', 4), -.1, 0, .25, { t0: dz1(.25), tf: F1(.25) }));
sp1.push(piece(S, A.bush(.045, .02, '#6fcf9a', '#49a877', 6), .19, 0, .23, { t0: dz1(.23), tf: F1(.23) }));
sp1.push(piece(S, A.tree(.07, '#4fb08a', '#368a68', 7), .195, 0, .05, { t0: dz1(.05), tf: F1(.05), sway: .015 }));
const pyA = piece(S, A.pylon(.13), -.185, 0, .055, { t0: dz1(.055), tf: F1(.055) }); sp1.push(pyA);
const pyB = piece(S, A.pylon(.105), -.13, 0, .1, { t0: dz1(.1), tf: F1(.1) }); sp1.push(pyB);
sp1.push(piece(S, A.transformer(.058), -.06, 0, .14, { t0: dz1(.14), tf: F1(.14) }));
const board1 = piece(S, A.switchboardSmall(.075, .06), .06, 0, .13, { pop: false, t0: -1, tf: F1(.13) }); sp1.push(board1);
const rack1 = piece(S, A.rack(.042, .072, 'SERVERS'), .15, 0, .085, { pop: false, t0: -1, tf: F1(.085) }); sp1.push(rack1);
sp1.push(piece(S, A.rack(.03, .06), .185, 0, .1, { pop: false, t0: -1, tf: F1(.1) }));
sp1.push(piece(K, A.cloud(.075, 1), -.1, .27, .004, { t0: dz1(0) - .1, tf: F1(0), dir: 1, sway: .02 }));
sp1.push(piece(K, A.cloud(.06, 2), .12, .285, .004, { t0: dz1(0), tf: F1(0), dir: 1, sway: .02 }));
// the hook's breaker handle on the small board (middle section)
const hookH = cutMesh(A.handle(), { backCol: '#20242c', s: .55, shadow: false }); hookH.position.set(0, .0297, .0012); board1.m.add(hookH);
// overhead line between the two pylons (sagging strands)
const wires = new THREE.Group(); S.add(wires);
const PYA_TOP = [-.185 - .0299 + .0045, .13 * .8 + .0, .055], PYB_TOP = [-.13 - .0242 + .0037, .105 * .8, .1];
for (const dy of [0, .0234]) {
  const a = new THREE.Vector3(-.185 + .028, .13 * .8 - dy * 1.0, .0552), bb = new THREE.Vector3(-.13 + .022, .105 * .8 - dy * .81, .1002);
  const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(bb, .5).add(new THREE.Vector3(0, -.008, 0)), bb]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .00035, 5), new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: .6 }));
  m.castShadow = true; wires.add(m);
}
// title sign on strings, hanging in front of the backdrop
const signItem = A.titleSign(.15, ['LOW-VOLTAGE', 'SWITCHGEAR']);
const signG = new THREE.Group(); K.add(signG);
const signM = cutMesh(signItem); signG.add(signM);
const strL = thread(.2), strR = thread(.2); signG.add(strL, strR); strL.position.set(-.06, .0, 0); strR.position.set(.06, .0, 0);

// spread 2: inside the lineup
const sp2 = [];
const line = piece(S, A.lineup(), 0, 0, A.LZ, { t0: dz2(A.LZ), tf: 1e9 }); sp2.push(line);
const H6 = A.SX.map((x, i) => { const h = cutMesh(A.handle(), { backCol: '#20242c', shadow: false }); h.position.set(x, A.BRK_Y, .003); line.m.add(h); return h; });
const ups1 = piece(S, A.upsCab(.05, .055, 'UPS 1'), ...xz(A.LOAD.ups1), { t0: dz2(A.LOAD.ups1[1]), tf: F2(A.LOAD.ups1[1]), keep: true }); sp2.push(ups1);
const ups2 = piece(S, A.upsCab(.05, .055, 'UPS 2'), ...xz(A.LOAD.ups2), { t0: dz2(A.LOAD.ups2[1]), tf: F2(A.LOAD.ups2[1]), keep: true }); sp2.push(ups2);
const rkA = piece(S, A.rack(.036, .05, 'RACKS A'), ...xz(A.LOAD.racksA), { t0: dz2(A.LOAD.racksA[1]), tf: F2(A.LOAD.racksA[1]), keep: true, dir: -1 }); sp2.push(rkA);
const rkB = piece(S, A.rack(.036, .05, 'RACKS B'), ...xz(A.LOAD.racksB), { t0: dz2(A.LOAD.racksB[1]), tf: F2(A.LOAD.racksB[1]), keep: true, dir: -1 }); sp2.push(rkB);
const cool = piece(S, A.coolUnit(.045, .05), ...xz(A.LOAD.cool), { t0: dz2(A.LOAD.cool[1]), tf: F2(A.LOAD.cool[1]) }); sp2.push(cool);
const fanM = cutMesh(A.fan(.0145)); fanM.position.set(0, .05 * (1 - .58), .0015); cool.m.add(fanM);
const lightsP = piece(S, A.lightLamp(.05), ...xz(A.LOAD.lights), { t0: dz2(A.LOAD.lights[1]), tf: F2(A.LOAD.lights[1]) }); sp2.push(lightsP);
const gen = piece(S, A.generator(.06), ...xz(A.LOAD.gen), { t0: T.genStart, tf: F2(A.LOAD.gen[1]), dir: -1, keep: true });
const util = piece(K, A.utilitySign(.07), -.13, .27, .004, { t0: T.rise2 + .1, tf: F2(.3), dir: 1, sway: .012 }); sp2.push(util);
const lockM = cutMesh(A.padlock(.013), { keep: true }); lockM.position.set((A.SX[0] + A.SX[1]) / 2, A.BRK_Y + .004, .005); line.m.add(lockM);
const zapM = cutMesh(A.zap(.011)); const zapG = new THREE.Group(); zapG.add(zapM); zapG.position.set(A.SX[5], .011, .125); S.add(zapG);
function xz(p) { return [p[0], 0, p[1]]; }
// UPS battery bars (emissive, stay lit through the outage)
const barMat = new THREE.MeshBasicMaterial({ color: '#7dff9a', toneMapped: false });
const bars = [ups1, ups2].map(u => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, .008), barMat.clone()); m.geometry.translate(.5, 0, 0); m.position.set(-.0165, .055 * (1 - .42), .0009); u.m.add(m); return m; });

// ---------- lights ----------
const spot = new THREE.SpotLight('#fff0dc', 2.2, 3, .75, .55, 2); spot.position.set(-.28, .375, .44); spot.target.position.set(.02, 0, .2);
spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -.00006; spot.shadow.normalBias = .0004; spot.shadow.radius = 5; spot.shadow.camera.near = .05; spot.shadow.camera.far = 2;
scene.add(spot, spot.target);
const sun = new THREE.DirectionalLight('#fff3e0', 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.00008; sun.shadow.normalBias = .0003; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -.3, right: .3, top: .3, bottom: -.3, near: .1, far: 3 }); sun.position.set(-.35, .55, .75); sun.target.position.set(0, .05, .12); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe6ff', '#caa27a', .55); scene.add(hemi);

// ---------- glows (power pulses, lamps, LEDs) ----------
function spriteTex(fn, n = 64) { const c = cv(n, n), x = c.getContext('2d'); fn(x, n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const glowTex = spriteTex((x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
const puffTex = spriteTex((x, n) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, cx = n / 2 + Math.cos(a) * n * .15, cy = n / 2 + Math.sin(a) * n * .15, g = x.createRadialGradient(cx, cy, 0, cx, cy, n * .3); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } }, 128);
const quad = new THREE.PlaneGeometry(1, 1), camQ = new THREE.Quaternion(), eul = new THREE.Euler();
const addMat = (map, col) => new THREE.MeshBasicMaterial({ map, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const PS = [];
function glows(n, col, fn, map = glowTex, parent = scene) {
  const p = particles(quad, addMat(map, col), n, (i, t) => { const q = fn(i, t); if (q) { eul.setFromQuaternion(camQ); q.rx = eul.x; q.ry = eul.y; q.rz = eul.z; } return q; });
  parent.add(p); PS.push(p); return p;
}
// polyline in stage coordinates → length + point at arc length
function path(pts) {
  const v = pts.map(p => new THREE.Vector3(...p)), L = [0];
  for (let i = 1; i < v.length; i++) L.push(L[i - 1] + v[i].distanceTo(v[i - 1]));
  return { len: L[L.length - 1], at(s) { s = clamp(s, 0, L[L.length - 1]); let i = 1; while (i < L.length - 1 && L[i] < s) i++; return v[i - 1].clone().lerp(v[i], (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1])); } };
}
const tmp = new THREE.Vector3();
const st = v => { tmp.copy(v); return S.localToWorld(tmp); };       // stage → world
// spread 1 path: overhead line → transformer → trench → switchboard → racks
const PATH1 = path([[-.185 + .028, .104, .0552], [-.13 + .022, .084, .1002], [-.07, .052, .14], [-.06, .004, .162], [0, .004, .176], [.055, .004, .163], [.06, .03, .1335], [.07, .004, .155], [.1, .004, .135], [.14, .004, .105], [.15, .03, .087]]);
const YEL = new THREE.Color(1.6, 1.25, .35), GRN = new THREE.Color(.5, 1.6, .7), RED = new THREE.Color(2, .35, .25);
glows(44, YEL, (i, t) => {
  if (t < T.flow1[0] || t > T.turn[0] - .2) return null;
  const head = PATH1.len * eio(seg(t, T.flow1[0], T.flow1[1])), s = (i * .011 + (t - T.flow1[0]) * .03) % (44 * .011);
  if (s > head) return null; const p = st(PATH1.at(s));
  return { x: p.x, y: p.y + .001, z: p.z + .002, s: .0055 * (1 - seg(t, T.turn[0] - .6, T.turn[0] - .2)) };
});
// spread 1 rack LEDs: blink on with the hook
glows(10, GRN, (i, t) => {
  if (t > T.turn[0] - .2) return null;
  const on = seg(t, T.hookClack + .08 + i * .05, T.hookClack + .2 + i * .05); if (on <= 0) return null;
  const blink = .65 + .35 * Math.sign(Math.sin(t * (3 + i % 4) + i * 1.7));
  const lx = i < 6 ? .15 - .012 + (i % 2) * .024 : .185 - .006 + (i % 2) * .012, ly = i < 6 ? .062 - Math.floor(i / 2) * .016 : .05 - Math.floor((i - 6) / 2) * .02, lz = i < 6 ? .0862 : .1012;
  const p = st(new THREE.Vector3(lx, ly, lz)); return { x: p.x, y: p.y, z: p.z, s: .004 * on * blink };
});

// spread 2: state of the system at time t
const ST = t => {
  const utility = t < T.outage, mainOn = t >= T.mainClose + .06 && t < T.mainOpen, genOn = t >= T.genClose + .06;
  const busOn = (utility && mainOn && t >= T.busGlow) || genOn;
  const fOn = T.feeders.map((tf, i) => t >= tf + .06 && !(i === 3 && t >= T.trip && t < T.lightsReset));
  return { utility, mainOn, genOn, busOn, fOn, src: genOn ? 0 : 1, genRun: t >= T.genStart + .7 };
};
const SW = A.LINEUP_W / 6, BUSZ = A.LZ + .0035, BY = A.BUS_Y[1];
const vis2 = t => t > T.turn[1] - .1 && t < 1e9;
// incoming power: from the wall tray down the MAIN dropper, and from the generator cable up into the GEN section
const PIN = path([[A.SX[1], .2, A.LZ - .002], [A.SX[1], .162, BUSZ], [A.SX[1], BY, BUSZ]]);
const PGEN = path([[A.LOAD.gen[0], .006, A.LOAD.gen[1] - .02], [A.SX[0], .0025, .15], [A.SX[0], .0025, A.LZ + .01], [A.SX[0], .01, BUSZ], [A.SX[0], A.BRK_Y, BUSZ], [A.SX[0], BY, BUSZ]]);
glows(10, YEL, (i, t) => { const s = ST(t); if (!vis2(t) || !(s.utility && s.mainOn)) return null; const u = ((i / 10 + t * .45) % 1), p = st(PIN.at(u * PIN.len)); return { x: p.x, y: p.y, z: p.z, s: .006 }; });
glows(14, YEL, (i, t) => { const s = ST(t); if (!s.genRun || t > T.fold2) return null; const u = ((i / 14 + t * .3) % 1), p = st(PGEN.at(u * PGEN.len)); if (!s.genOn && p.y > .02 && p.z < .1) return null; return { x: p.x, y: p.y + .0015, z: p.z, s: .0055 }; });
// busbars: pulses run outward from the source section along all three bars
glows(60, YEL, (i, t) => {
  const s = ST(t); if (!vis2(t) || !s.busOn) return null;
  const k = i % 3, j = Math.floor(i / 3), xs = A.SX[s.src], u = ((j / 20 + t * .35) % 1), side = j % 2 ? 1 : -1;
  const x = xs + side * u * .2; if (x < -.185 || x > .185) return null;
  const grow = s.genOn ? seg(t, T.genClose, T.genClose + 1) : seg(t, T.busGlow, T.busGlow + 1.2); if (u * .2 > grow * .4) return null;
  const p = st(new THREE.Vector3(x, A.BUS_Y[k], BUSZ)); return { x: p.x, y: p.y, z: p.z, s: .0045 };
});
// feeders: bus → dropper → breaker → gland → floor cable → load; UPS → racks
const FEED = [2, 3, 4, 5].map((sec, i) => path([[A.SX[sec], BY, BUSZ], [A.SX[sec], A.BRK_Y, BUSZ], [A.SX[sec], .006, BUSZ], ...A.CABLES[i + 1].map(([x, z]) => [x, .0028, z])]));
const RACKP = [5, 6].map(c => path(A.CABLES[c].map(([x, z]) => [x, .0028, z])));
glows(64, YEL, (i, t) => {
  const s = ST(t), f = i % 4, j = Math.floor(i / 4); if (!vis2(t) || !s.busOn || !s.fOn[f] || t > T.fold2 + .2) return null;
  const P0 = FEED[f], u = (j / 16 + t * .32) % 1, grow = seg(t, T.feeders[f], T.feeders[f] + 1); if (u > grow) return null;
  const p = st(P0.at(u * P0.len)); return { x: p.x, y: p.y + .0012, z: p.z, s: .0045 };
});
glows(16, GRN, (i, t) => {
  const r = i % 2, j = Math.floor(i / 2); if (!vis2(t) || t < T.feeders[r] + .8 || t > T.fold2 + .2) return null;
  const u = (j / 8 + t * .4) % 1, p = st(RACKP[r].at(u * RACKP[r].len)); return { x: p.x, y: p.y + .0012, z: p.z, s: .0042 };
});
// indicator lamps on each section, utility lamp on the wall sign, lights lamp, rack LEDs
const lampOn = (i, t) => { const s = ST(t); return i === 0 ? s.genOn : i === 1 ? (s.mainOn && s.utility) : (s.fOn[i - 2] && s.busOn); };
glows(6, YEL, (i, t) => { if (!vis2(t) || !lampOn(i, t)) return null; const p = st(new THREE.Vector3(A.SX[i] + SW * .3, .092 * riseOf(line, t), A.LZ + .0025)); return { x: p.x, y: p.y, z: p.z, s: .007 }; });
glows(1, YEL, (i, t) => { if (!vis2(t) || !ST(t).utility || riseOf(util, t) < .9) return null; const p = new THREE.Vector3(-.1216, .2365, .0062); K.localToWorld(p); return { x: p.x, y: p.y, z: p.z, s: .011 }; });
glows(3, new THREE.Color(1.8, 1.5, .7), (i, t) => { const s = ST(t), k = riseOf(lightsP, t); if (!vis2(t) || !s.busOn || !s.fOn[3] || k < .95) return null; const p = st(new THREE.Vector3(A.LOAD.lights[0] + (i - 1) * .008, .038, A.LOAD.lights[1] + .002)); return { x: p.x, y: p.y, z: p.z, s: .02 }; });
glows(12, GRN, (i, t) => {
  const rk = i < 6 ? rkA : rkB, k = riseOf(rk, t); if (!vis2(t) || k < .95 || t < T.feeders[i < 6 ? 0 : 1] + 1.2) return null;
  const j = i % 6, L = i < 6 ? A.LOAD.racksA : A.LOAD.racksB, blink = .6 + .4 * Math.sign(Math.sin(t * (2.5 + j) + i));
  const p = st(new THREE.Vector3(L[0] - .008 + (j % 2) * .016, .042 - Math.floor(j / 2) * .011, L[1] + .0015)); return { x: p.x, y: p.y, z: p.z, s: .0035 * blink };
});
// fault sparks + generator exhaust puffs + pop-up paper puffs
glows(18, RED, (i, t) => {
  const d = t - T.fault; if (d < 0 || d > .9) return null; const R = mulberry(i + 3), a = R() * TAU, v = .02 + R() * .03, up = .03 + R() * .03;
  const p = st(new THREE.Vector3(A.SX[5] + Math.cos(a) * v * d, .006 + up * d - .06 * d * d, .125 + Math.sin(a) * v * d)); return { x: p.x, y: p.y, z: p.z, s: .004 * (1 - d / .9) };
});
glows(10, new THREE.Color(.55, .52, .5), (i, t) => {
  const s = ST(t); if (!s.genRun || t > T.fold2) return null; const R = mulberry(i + 40), ph = (t * .9 + i / 10) % 1;
  const p = st(new THREE.Vector3(A.LOAD.gen[0] + .009 + ph * .01 + R() * .004, .048 + ph * .05, A.LOAD.gen[1] + R() * .004)); return { x: p.x, y: p.y, z: p.z, s: .006 + ph * .012 };
}, puffTex).material.blending = THREE.NormalBlending;

// ---------- camera ----------
// [t, pos xyz, target xyz, fov, aperture, focus (0 = target distance)]; each inner list is one shot, a new list = a hard cut
const SH = [
  [
    [0, .072, .042, .238, .06, .03, .13, 28, 2.4],
    [.7, .072, .042, .238, .06, .03, .13, 28, 2.4],
    [4.6, .068, .04, .222, .06, .03, .13, 28, 2.4],
    [6.4, .0, .27, .64, -.01, .04, .13, 30, 1.6],
    [8.2, -.15, .085, .37, -.145, .05, .08, 30, 2.0],
    [10.6, -.05, .072, .345, -.05, .035, .13, 30, 2.1],
    [12.9, .05, .07, .33, .07, .035, .12, 30, 2.2],
    [14.2, .065, .085, .3, .07, .085, .06, 30, 2.1],
    [16.8, .065, .088, .285, .068, .09, .06, 30, 2.1],
    [17.9, .0, .3, .68, .0, .05, .12, 30, 1.5],
    [19.9, .0, .28, .64, .0, .06, .12, 30, 1.5],
    [21.6, -.07, .13, .38, -.08, .09, .07, 30, 2.0],
    [23.6, -.09, .115, .32, -.09, .105, .07, 30, 2.3],
    [26.6, .0, .11, .33, .01, .095, .07, 30, 2.2],
    [28.4, .03, .17, .48, .04, .045, .13, 30, 1.6],
    [30.8, .06, .165, .47, .06, .045, .13, 30, 1.6],
    [31.6, .11, .13, .29, .15, .045, .1, 30, 2.1],
    [33.2, .115, .125, .265, .155, .045, .095, 30, 2.3],
    [35.3, .113, .125, .268, .153, .045, .097, 30, 2.3],
    [36.9, .06, .15, .44, .02, .04, .14, 30, 1.8],
    [38.1, .055, .15, .445, .018, .04, .14, 30, 1.8],
  ],
  [
    [T.outage, .0, .42, .41, .0, .03, .14, 30, 1.3],
    [41.0, .0, .405, .4, .0, .03, .14, 30, 1.3],
    [42.6, -.01, .11, .44, -.02, .035, .2, 30, 2.1],
    [44.2, -.07, .1, .43, -.1, .035, .2, 30, 2.1],
    [45.9, -.12, .095, .42, -.16, .035, .2, 30, 2.1],
    [47.6, -.127, .165, .315, -.127, .112, .07, 30, 2.1],
    [50.2, -.125, .163, .31, -.127, .112, .07, 30, 2.1],
    [52.6, .0, .24, .62, .0, .05, .13, 30, 1.6],
    [54.0, .0, .26, .66, .0, .05, .13, 30, 1.5],
    [58.5, .01, .55, 1.05, .0, .05, .14, 31, 1.0],
    [DUR, .015, .66, 1.25, .0, .05, .14, 32, .9],
  ],
];
const SHOTS = SH.map(keys => ({ t0: keys[0][0], f: track(keys.map(k => [k[0], k.slice(1, 10).concat(k[9] ?? 0)])) }));
function camAt(t) { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x.t0) s = x; const v = s.f(t); return { pos: new THREE.Vector3(v[0], v[1], v[2]), tgt: new THREE.Vector3(v[3], v[4], v[5]), fov: v[6], aper: v[7], focus: v[8] }; }

// ---------- sound events (for mix.py) ----------
const EV = [];
EV.push({ t: T.hookClack, type: 'clack', v: 1 });
for (const r of POPS) if (r.pop && r.t0 > 0 && r.t0 < 1e8) EV.push({ t: r.t0 + .1, type: 'pop', v: r.m.userData.h > .1 ? 1 : .7 });
for (const r of POPS) if (r.tf < 1e8 && r.tf > 0) EV.push({ t: r.tf + .05, type: 'fold' });
EV.push({ t: T.flow1[0], type: 'slide', d: T.flow1[1] - T.flow1[0] });
EV.push({ t: T.sign, type: 'sign' }, { t: T.turn[0], type: 'page', d: T.turn[1] - T.turn[0] });
EV.push({ t: T.mainClose, type: 'clack', v: 1.1 }, { t: T.busGlow, type: 'energise' });
T.feeders.forEach(t => EV.push({ t, type: 'clack', v: .7 }));
EV.push({ t: T.fault, type: 'zap' }, { t: T.trip, type: 'trip' }, { t: T.trip + .05, type: 'ding' });
EV.push({ t: T.outage, type: 'outage' }, { t: T.upsOn, type: 'ups' }, { t: T.genStart, type: 'genstart' });
EV.push({ t: T.mainOpen, type: 'clack', v: 1 }, { t: T.lock, type: 'lock' }, { t: T.genClose, type: 'clack', v: 1.15 }, { t: T.genClose + .1, type: 'restore' }, { t: T.lightsReset, type: 'clack', v: .6 });
EV.sort((a, b) => a.t - b.t);
window.EV = EV; window.DUR = DUR; window.TL = T;

// ---------- HUD ----------
const CUES = voCues(DURS).map((c, i, a) => ({ ...c, a: c.t0 - .25, b: Math.min(c.t1 + .6, i + 1 < a.length ? a[i + 1].t0 - .25 : 1e9) }));
window.CUES = CUES;
function wrap(x, text, maxW) { const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const s = cur ? cur + ' ' + w : w; if (x.measureText(s).width > maxW && cur) { lines.push(cur); cur = w; } else cur = s; } if (cur) lines.push(cur); return lines; }
function drawSubs(x, t) {
  if (Q.get('nosubs')) return;   // poster stills
  for (const c of CUES) {
    const al = Math.min(seg(t, c.a, c.a + .2), 1 - seg(t, c.b - .2, c.b)); if (al <= 0) continue;
    x.save(); x.globalAlpha = al; x.textAlign = 'center'; x.font = '500 40px Fredoka'; x.lineJoin = 'round';
    const L = wrap(x, c.text, 1760); let y = H - 64 - (L.length - 1) * 50;
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 16;
    for (const l of L) { x.lineWidth = 8; x.strokeStyle = 'rgba(28,18,12,.8)'; x.strokeText(l, W / 2, y); x.shadowBlur = 0; x.fillStyle = '#fffaf0'; x.fillText(l, W / 2, y); y += 50; }
    x.restore();
  }
}
const INK = '#3a2a24';
function drawAction(x, t, t0, text, p, col) {
  if (!p || t < t0 || t > t0 + 2.1) return;
  const k = back(seg(t, t0, t0 + .18), 2.5), fo = 1 - seg(t, t0 + 1.8, t0 + 2.1);
  x.save(); x.translate(p[0], p[1] - seg(t, t0, t0 + 2.1) * 30); x.rotate(-.1); x.scale(k, k); x.globalAlpha = fo;
  const R = mulberry(7);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + R() * .3, r0 = 90, r1 = 150 + R() * 60 * eo(seg(t, t0, t0 + .4)); x.strokeStyle = i % 2 ? '#ffe35a' : '#ffffff'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * .6); x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * .6); x.stroke(); }
  x.font = 'italic 120px "Lilita One"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = 30; x.strokeStyle = '#fffaf0'; x.strokeText(text, 0, 0); x.lineWidth = 12; x.strokeStyle = INK; x.strokeText(text, 0, 0);
  const g = x.createLinearGradient(0, -50, 0, 50); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]); x.fillStyle = g; x.fillText(text, 0, 0);
  x.restore();
  return [p[0] - 200, p[1] - 90, p[0] + 200, p[1] + 90];
}
function toScreen(v) { const p = v.clone().project(cam); if (p.z > 1) return null; return [(p.x * .5 + .5) * W, (-p.y * .5 + .5) * H]; }
let TXT = [];
function poseCam(t) { const C = camAt(t); cam.position.copy(C.pos); cam.fov = C.fov; cam.lookAt(C.tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); camQ.copy(cam.quaternion); return C; }
function poseSign(t) {   // title sign: drops on strings, swings on a spring, lifts away before the turn
  const dropK = spring(t - T.sign, 6, .32), up = ss(seg(t, T.turn[0] - .5, T.turn[0] + .1));
  signG.visible = t > T.sign - .05 && up < 1;
  signG.position.set(.065, .31 - .17 * (t > T.sign ? dropK : 0) + up * .2, .028);
  signG.rotation.z = t > T.sign ? Math.sin((t - T.sign) * 4.2) * .05 * Math.exp(-(t - T.sign) * 1.1) : 0;
  strL.position.set(-.058, -.004, -.0005); strR.position.set(.058, -.004, -.0005);
}
function texts(t) {
  const out = [];
  if (signG.visible && t > T.sign + .3) {
    scene.updateMatrixWorld(true);
    const a = toScreen(signG.localToWorld(new THREE.Vector3(-signItem.w / 2, 0, 0))), b2 = toScreen(signG.localToWorld(new THREE.Vector3(signItem.w / 2, -signItem.h, 0)));
    if (a && b2) out.push({ id: 'sign', text: 'LOW-VOLTAGE SWITCHGEAR', x0: Math.max(0, Math.min(a[0], b2[0])), y0: Math.max(0, Math.min(a[1], b2[1])), x1: Math.min(W, Math.max(a[0], b2[0])), y1: Math.min(H, Math.max(a[1], b2[1])) });
  }
  if (t >= T.trip && t < T.trip + 1.9) out.push({ id: 'trip', text: 'TRIP!', x0: 700, y0: 300, x1: 1100, y1: 480, pass: true });
  return out;
}
window.TEXTS = t => { poseCam(t); poseSign(t); return texts(t); };

// fan angle = integral of its speed (on with the COOLING feeder, spins down in the outage, back up on the generator)
const fanSpeed = t => 11 * (t < T.feeders[2] ? 0 : t < T.outage ? ss(seg(t, T.feeders[2], T.feeders[2] + .8)) : t < T.genClose ? 1 - ss(seg(t, T.outage, T.outage + 2)) : ss(seg(t, T.genClose + .3, T.genClose + 1.5)));
const FAN = []; for (let i = 0, a = 0; i <= DUR * 50 + 2; i++) { FAN.push(a); a += fanSpeed(i / 50) / 50; }
const fanAngle = t => { const f = t * 50, i = Math.floor(clamp(f, 0, FAN.length - 2)); return lerp(FAN[i], FAN[i + 1], f - i); };

// ---------- render ----------
const SPREAD = t => t < T.turn[0] ? 1 : 2;
window.render = function (t) {
  if (Q.get('nogl')) { poseCam(t); poseSign(t); return; }   // reading-time check: posing only, no drawing
  // book pages + page turn
  const turning = t >= T.turn[0] && t < T.turn[1];
  book.groundMat.map = t < T.turn[0] ? PT.ground1 : PT.ground2;
  book.backMat.map = t < T.turn[1] - .35 ? PT.sky1 : PT.sky2;
  book.groundMat.needsUpdate = book.backMat.needsUpdate = true;
  if (turning) {
    const lf = book.leafFront.material, lb = book.leafBack.material;
    if (lf.map !== PT.ground1) { lf.map = lf.emissiveMap = PT.ground1; lb.map = lb.emissiveMap = PT.sky2; lf.needsUpdate = lb.needsUpdate = true; }
    book.setLeaf(eio(seg(t, T.turn[0] + .05, T.turn[1] - .3)));
  } else book.setLeaf(0);
  // pop-ups
  for (const r of POPS) {
    const k = riseOf(r, t); r.g.visible = k > .002; if (!r.g.visible) continue;
    r.g.rotation.x = r.dir * (Math.PI / 2) * (1 - k);
    if (r.sway) r.m.rotation.z = Math.sin(t * 1.6 + r.ph) * r.sway * k;
  }
  wires.visible = Math.min(riseOf(pyA, t), riseOf(pyB, t)) > .985;
  // hook handle: OFF → ON
  hookH.rotation.x = lerp(Math.PI - .5, .5, back(seg(t, T.hookClack, T.hookClack + .12), 2.2));
  poseSign(t);
  // spread 2 mechanisms
  const s = ST(t);
  H6.forEach((h, i) => {
    let a;
    if (i === 0) a = t < T.genClose ? Math.PI - .5 : lerp(Math.PI - .5, .5, back(seg(t, T.genClose, T.genClose + .12), 2.2));
    else if (i === 1) a = t < T.mainOpen ? lerp(Math.PI - .5, .5, back(seg(t, T.mainClose, T.mainClose + .12), 2.2)) : lerp(.5, Math.PI - .5, back(seg(t, T.mainOpen, T.mainOpen + .12), 2.2));
    else {
      const f = i - 2, on = lerp(Math.PI - .5, .5, back(seg(t, T.feeders[f], T.feeders[f] + .12), 2.2));
      a = on;
      if (f === 3 && t >= T.trip) a = t < T.lightsReset ? lerp(.5, Math.PI / 2, back(seg(t, T.trip, T.trip + .1), 3)) : lerp(Math.PI / 2, .5, back(seg(t, T.lightsReset, T.lightsReset + .12), 2.2));
    }
    h.rotation.x = a;
  });
  lockM.visible = t >= T.lock && t < T.fold2; lockM.scale.setScalar(Math.max(.001, back(seg(t, T.lock, T.lock + .2), 2.4)));
  { const zk = back(seg(t, T.fault, T.fault + .15), 2.5) * (1 - ss(seg(t, T.fault + .9, T.fault + 1.3))); zapG.visible = zk > .01; zapG.scale.setScalar(Math.max(.001, zk)); zapM.rotation.z = (t - T.fault) * 2; }
  fanM.rotation.z = -fanAngle(t);
  { const charge = 1 - .45 * seg(t, T.outage, T.genClose) + .45 * seg(t, T.genClose + .5, T.genClose + 6) * seg(t, T.outage, T.genClose);
    const pulse = t > T.outage && t < T.genClose + .5 ? .55 + .45 * Math.sin(t * 7) ** 2 : 1;
    bars.forEach(b => { b.scale.x = .033 * charge; b.material.color.setRGB(.49 * pulse + (charge < .7 ? .4 : 0), 1 * pulse, .6 * pulse); }); }
  gen.m.position.y = s.genRun && t < T.fold2 ? Math.abs(Math.sin(t * 38)) * .0004 : 0;
  // graphite wash during the outage
  UD.value.set(seg(t, T.outage, T.outage + 1.4), seg(t, T.genClose, T.genClose + 1.6), A.SX[0], 0);
  // lights (the lamp keeps its warmth; the paper sun dims a touch in the outage)
  const dim = seg(t, T.outage, T.outage + 1) * (1 - seg(t, T.genClose, T.genClose + 1.2));
  sun.intensity = (SPREAD(t) === 1 ? 2.4 : 2.1) - dim * .7; sun.color.set(SPREAD(t) === 1 ? '#fff3e0' : '#ffe9d2');
  spot.intensity = 1.6 + seg(t, T.fold2, DUR - 2) * .3; hemi.intensity = .5 - dim * .15;
  scene.environmentIntensity = .38 + seg(t, T.fold2, DUR - 2) * .1; scene.backgroundIntensity = .75;
  const C = poseCam(t);
  post.dof.focus = C.focus > .001 ? C.focus : C.pos.distanceTo(C.tgt); post.dof.aper = C.aper; post.dof.maxCoc = 14;
  post.vig.uniforms.warm.value = .12; post.vig.uniforms.fade.value = 1;
  post.bloom.strength = .18;
  scene.updateMatrixWorld(true);
  for (const p of PS) p.userData.update(t);
  post.composer.render();
  // 2D overlay
  OX.clearRect(0, 0, W, H);
  const tp = toScreen(st(new THREE.Vector3(A.SX[5], A.BRK_Y + .03, A.LZ)));
  const box = tp && drawAction(OX, t, T.trip, 'TRIP!', [clamp(tp[0], 260, W - 260), clamp(tp[1] - 60, 140, H - 300)], ['#ffb08a', '#ff4b3a']);
  drawSubs(OX, t);
  const fade = Math.max(1 - seg(t, 0, .5), seg(t, DUR - 1.2, DUR));
  if (fade > 0) { OX.fillStyle = `rgba(0,0,0,${fade})`; OX.fillRect(0, 0, W, H); }
};
window.DBG = { book, cam, POPS, scene, post, renderer, sun, spot };
window.render(0);
window.READY = true;
