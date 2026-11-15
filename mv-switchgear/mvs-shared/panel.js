// The geometry: one switchgear panel built from code, in the dimensions of model.js. Four compartments (LV, breaker,
// busbar, cable), the withdrawable vacuum circuit breaker on its truck, spouts and shutters, main busbars and droppers,
// current transformers, cable terminations and the earthing switch. update(s) poses it from the frame's state.
import * as THREE from 'three';
import {P} from './model.js';

const V3 = THREE.Vector3;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoother = (x) => {
  const u = clamp01(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ACCENT = new THREE.Color('#e3562a');

// one shared clipping plane for the hero's housing: keeps x <= cut
export const SECTION_PLANE = new THREE.Plane(new V3(-1, 0, 0), 10);

export function makeMats(clip) {
  const planes = clip ? [SECTION_PLANE] : [];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const housing = (color, o = {}) => std({color, roughness: 0.62, metalness: 0.15, clippingPlanes: planes, clipShadows: true, transparent: true, ...o});
  return {
    sheet: housing('#d9dad5'),
    door: housing('#dcddd8'),
    inner: housing('#c9cbc6', {roughness: 0.7, side: THREE.DoubleSide}),
    dark: housing('#4a4d52', {roughness: 0.8}),
    glass: new THREE.MeshPhysicalMaterial({color: '#9fb6c4', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.22, clippingPlanes: planes, depthWrite: false}),
    copper: std({color: '#c47a4a', roughness: 0.38, metalness: 0.85, envMapIntensity: 0.6}),
    contact: std({color: '#c47a4a', roughness: 0.38, metalness: 0.85, envMapIntensity: 0.6}),
    tulip: std({color: '#c9ccd0', roughness: 0.35, metalness: 0.9}),
    steel: std({color: '#8d939a', roughness: 0.5, metalness: 0.7}),
    epoxy: std({color: '#3d4046', roughness: 0.55, metalness: 0.05, transparent: true}),
    resin: std({color: '#4b4f56', roughness: 0.6}),
    ct: std({color: '#6b5a48', roughness: 0.65}),
    ceramic: std({color: '#f1ede4', roughness: 0.4, transparent: true}),
    truck: std({color: '#5a5e65', roughness: 0.6, metalness: 0.3}),
    face: std({color: '#b9bcbf', roughness: 0.55}),
    shutter: std({color: '#a7adb2', roughness: 0.42, metalness: 0.6}),
    blade: std({color: '#b8bcc2', roughness: 0.35, metalness: 0.85}),
    cable: std({color: '#202226', roughness: 0.7}),
    cone: std({color: '#a8442e', roughness: 0.55}),
    earth: std({color: '#4f9a3c', roughness: 0.5}),
    lampR: std({color: '#5a1d18', emissive: '#ff3b2f', emissiveIntensity: 0}),
    lampG: std({color: '#173d22', emissive: '#28d36a', emissiveIntensity: 0}),
    ind: std({color: '#ffffff', roughness: 0.5, emissive: '#000000'}),
    spring: std({color: '#f2c230', roughness: 0.5}),
    hmi: std({color: '#0d1a14', emissive: '#2fd67a', emissiveIntensity: 0.6, roughness: 0.3}),
    arc: new THREE.MeshBasicMaterial({color: '#cfe8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}),
  };
}

const nameTexture = (name, sub) => {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f7f4';
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = '#2a2d31';
  g.lineWidth = 4;
  g.strokeRect(4, 4, 504, 88);
  g.fillStyle = '#1d2024';
  g.font = '700 42px Inter, sans-serif';
  g.textAlign = 'center';
  g.fillText(name, 256, 50);
  g.font = '600 20px "JetBrains Mono", monospace';
  g.fillStyle = '#5b6067';
  g.fillText(sub, 256, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

let haloTex = null;
const halo = () => {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(220,240,255,1)');
  gr.addColorStop(0.25, 'rgba(140,200,255,.55)');
  gr.addColorStop(1, 'rgba(80,140,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
};

export function buildPanel({name = 'FEEDER T2', sub = '11 kV · 1250 A', clip = false} = {}) {
  const M = makeMats(clip);
  const root = new THREE.Group();
  const shadowed = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (parent, w, h, d, mat, x, y, z) => {
    const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cyl = (parent, r, len, mat, x, y, z, axis = 'y', seg = 28, r2 = r) => {
    const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, seg), mat));
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const pieces = [];
  const piece = (ex) => {
    const g = new THREE.Group();
    g.userData.ex = new V3(...ex);
    root.add(g);
    pieces.push(g);
    return g;
  };
  const {W, H, zF, zB, zWall, yBrk, yTop, yBus, zLV, phase, ySpU, ySpL, zSpout, barY, barZ} = P;
  const t = 0.015;

  // ------------------------------------------------------------ housing
  const frame = piece([0, 0, 0]);
  box(frame, W, 0.06, P.D, M.dark, 0, 0.03, 0);
  const sideL = piece([-1.2, 0, -0.3]);
  const sideR = piece([1.6, 0, -0.5]);
  box(sideL, t, H - 0.06, P.D, M.sheet, -W / 2 + t / 2, (H + 0.06) / 2, 0);
  box(sideR, t, H - 0.06, P.D, M.sheet, W / 2 - t / 2, (H + 0.06) / 2, 0);
  const back = piece([0, 0, -0.7]);
  box(back, W - 2 * t, H - 0.06, t, M.sheet, 0, (H + 0.06) / 2, zB + t / 2);
  const roof = piece([0, 0.75, -0.1]);
  box(roof, W - 2 * t, t, P.D - t, M.sheet, 0, H - t / 2, -t / 2);
  // pressure-relief flaps over the busbar and breaker compartments, hinged at the back edge
  const flaps = [];
  for (const [z0, len] of [[-0.7, 0.62], [0.0, 0.3]]) {
    const pv = new THREE.Group();
    pv.position.set(0, H + 0.006, z0);
    roof.add(pv);
    box(pv, W * 0.82, 0.01, len, M.door, 0, 0.005, len / 2);
    flaps.push(pv);
  }

  // LV compartment: door with relay, lamps and nameplate; it lifts away as a box
  const lv = piece([0, 0.55, 0.25]);
  box(lv, W - 0.004, 0.5, 0.02, M.door, 0, (yTop + H) / 2 + 0.004, zF + 0.01);
  box(lv, W - 2 * t - 0.01, 0.52, t, M.inner, 0, (yTop + H) / 2, zLV);
  box(lv, W - 2 * t - 0.01, t, zF - zLV, M.inner, 0, yTop + 0.006, (zF + zLV) / 2);
  for (const sx of [-1, 1]) box(lv, 0.008, 0.5, zF - zLV - 0.02, M.inner, sx * (W / 2 - t - 0.006), (yTop + H) / 2, (zF + zLV) / 2);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.075), new THREE.MeshStandardMaterial({map: nameTexture(name, sub), roughness: 0.6}));
  plate.position.set(0, 2.16, zF + 0.0215);
  lv.add(plate);
  const hmi = box(lv, 0.17, 0.11, 0.006, M.hmi, -0.15, 2.0, zF + 0.022);
  box(lv, 0.21, 0.15, 0.004, M.dark, -0.15, 2.0, zF + 0.02);
  cyl(lv, 0.014, 0.012, M.lampR, 0.09, 2.04, zF + 0.025, 'z');
  cyl(lv, 0.014, 0.012, M.lampG, 0.16, 2.04, zF + 0.025, 'z');
  cyl(lv, 0.022, 0.02, M.dark, 0.125, 1.92, zF + 0.028, 'z');
  // inside: a DIN rail of miniature breakers and terminals
  box(lv, 0.6, 0.03, 0.01, M.steel, 0, 1.96, zLV + 0.012);
  for (let i = 0; i < 9; i++) box(lv, 0.05, 0.09, 0.07, i % 3 === 2 ? M.cone : M.face, -0.24 + i * 0.06, 1.96, zLV + 0.05);

  // the lower front cover with louvres
  const low = piece([0, 0, 0.4]);
  box(low, W - 0.004, yBrk - 0.08, 0.02, M.door, 0, 0.06 + (yBrk - 0.08) / 2, zF + 0.01);
  for (let i = 0; i < 5; i++) box(low, 0.4, 0.012, 0.004, M.dark, 0, 0.2 + i * 0.05, zF + 0.022);

  // the breaker compartment door, hinged on the left, with a viewing window
  const doorP = piece([0, 0, 0.5]);
  const hinge = new THREE.Group();
  hinge.position.set(-W / 2 + 0.01, 0, zF + 0.012);
  doorP.add(hinge);
  const dw = W - 0.02;
  const y0 = yBrk + 0.01;
  const y1 = yTop - 0.01;
  const wx0 = 0.19;
  const wx1 = dw - 0.19;
  const wy0 = 1.02;
  const wy1 = 1.5;
  box(hinge, wx0, y1 - y0, 0.02, M.door, wx0 / 2, (y0 + y1) / 2, 0);
  box(hinge, dw - wx1, y1 - y0, 0.02, M.door, (wx1 + dw) / 2, (y0 + y1) / 2, 0);
  box(hinge, wx1 - wx0, wy0 - y0, 0.02, M.door, (wx0 + wx1) / 2, (y0 + wy0) / 2, 0);
  box(hinge, wx1 - wx0, y1 - wy1, 0.02, M.door, (wx0 + wx1) / 2, (wy1 + y1) / 2, 0);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(wx1 - wx0, wy1 - wy0), M.glass);
  glass.position.set((wx0 + wx1) / 2, (wy0 + wy1) / 2, 0.004);
  hinge.add(glass);
  box(hinge, 0.025, 0.16, 0.03, M.dark, dw - 0.06, 1.2, 0.02);
  cyl(hinge, 0.02, 0.01, M.dark, dw / 2, 0.86, 0.012, 'z');

  // ------------------------------------------------------------ internal partitions (fixed)
  box(frame, W - 2 * t, yTop - yBrk, 0.012, M.inner, 0, (yBrk + yTop) / 2, zWall);
  box(frame, W - 2 * t, 0.012, zF - zWall, M.inner, 0, yBrk, (zF + zWall) / 2);
  box(frame, W - 2 * t, 0.012, zLV - zWall, M.inner, 0, yTop, (zLV + zWall) / 2);
  box(frame, W - 2 * t, 0.012, zWall - zB - t, M.inner, 0, yBus, (zWall + zB + t) / 2);
  for (const sx of [-0.3, 0.3]) box(frame, 0.04, 0.02, zF - zWall - 0.02, M.dark, sx, yBrk + 0.016, (zF + zWall) / 2);

  // spouts: cast-resin bushings through the partition, a contact pin inside each
  for (const x of phase)
    for (const y of [ySpU, ySpL]) {
      cyl(frame, 0.045, zSpout + 0.02, M.resin, x, y, (zSpout - 0.02) / 2, 'z');
      cyl(frame, 0.062, 0.012, M.resin, x, y, zWall + 0.012, 'z');
      cyl(frame, 0.016, 0.1, M.copper, x, y, zSpout - 0.04, 'z');
    }
  // shutters: steel plates that drop over the spouts when the truck leaves
  const shU = box(frame, W - 0.12, 0.2, 0.006, M.shutter, 0, ySpU, zSpout + 0.02);
  const shL = box(frame, W - 0.12, 0.2, 0.006, M.shutter, 0, ySpL, zSpout + 0.02);

  // ------------------------------------------------------------ busbar compartment
  for (let i = 0; i < 3; i++) {
    box(frame, W + 0.004, 0.1, 0.016, M.copper, 0, barY, barZ[i]);
    for (const sx of [-0.3, 0.3]) cyl(frame, 0.024, 0.24, M.resin, sx, barY + 0.17, barZ[i], 'y', 16);
    const x = phase[i];
    const zz = barZ[i] + 0.012;
    box(frame, 0.06, 0.012, -0.02 - zz, M.copper, x, ySpU, (-0.02 + zz) / 2);
    box(frame, 0.06, barY - ySpU, 0.012, M.copper, x, (barY + ySpU) / 2, zz);
  }

  // ------------------------------------------------------------ cable compartment
  const zC = -0.4;
  for (const x of phase) {
    box(frame, 0.06, 0.012, -0.02 - zC, M.copper, x, ySpL, (-0.02 + zC) / 2);
    box(frame, 0.06, ySpL - 0.62, 0.012, M.copper, x, (ySpL + 0.62) / 2, zC);
    // block-type current transformer around the connection
    box(frame, 0.13, 0.16, 0.12, M.ct, x, ySpL, -0.21);
    box(frame, 0.05, 0.03, 0.02, M.dark, x + 0.04, ySpL + 0.095, -0.21);
    // earthing switch fixed contact: a stud to the side of the bar
    box(frame, 0.05, 0.03, 0.02, M.tulip, x + 0.045, 0.78, zC - 0.006);
    // cable termination: lug, stress-control sleeve with sheds, the cable down into the trench
    box(frame, 0.05, 0.06, 0.02, M.tulip, x, 0.62, zC - 0.012);
    cyl(frame, 0.032, 0.2, M.cone, x, 0.49, zC - 0.03, 'y', 20);
    for (const y of [0.53, 0.47, 0.41]) cyl(frame, 0.05, 0.012, M.cone, x, y, zC - 0.03, 'y', 20);
    cyl(frame, 0.026, 0.62, M.cable, x, 0.08, zC - 0.03, 'y', 16);
  }
  const cones = [];
  frame.traverse((o) => o.material === M.cone && cones.push(o));
  // earthing switch: a shaft with three blades that swing up onto the studs
  const ES = {y: 0.3, z: -0.62};
  cyl(frame, 0.016, W - 0.06, M.steel, 0, ES.y, ES.z, 'x');
  const blades = phase.map((x) => {
    const pv = new THREE.Group();
    pv.position.set(x + 0.045, ES.y, ES.z);
    frame.add(pv);
    const dy = 0.78 - ES.y;
    const dz = zC - 0.006 - ES.z;
    const len = Math.hypot(dy, dz);
    box(pv, 0.03, len, 0.012, M.blade, 0, len / 2, 0);
    pv.userData.closed = Math.atan2(dz, dy);
    return pv;
  });
  box(frame, W - 0.04, 0.02, 0.03, M.earth, 0, 0.1, zB + 0.05);

  // ------------------------------------------------------------ the withdrawable vacuum circuit breaker on its truck
  const truck = piece([0, 0, 1.0]);
  box(truck, 0.66, 0.09, 0.46, M.truck, 0, yBrk + 0.065, 0.47);
  for (const sx of [-0.3, 0.3]) for (const z of [0.3, 0.64]) cyl(truck, 0.03, 0.03, M.dark, sx, yBrk + 0.04, z, 'x', 16);
  // the mechanism housing and its front plate: position indicator, spring indicator, push buttons
  box(truck, 0.66, 0.78, 0.15, M.truck, 0, 1.2, 0.625);
  box(truck, 0.6, 0.7, 0.006, M.face, 0, 1.2, 0.703);
  const indicator = box(truck, 0.1, 0.06, 0.006, M.ind, 0, 1.4, 0.709);
  box(truck, 0.08, 0.035, 0.006, M.spring, 0, 1.31, 0.709);
  cyl(truck, 0.022, 0.012, M.lampG, -0.08, 1.18, 0.71, 'z');
  cyl(truck, 0.022, 0.012, M.lampR, 0.08, 1.18, 0.71, 'z');
  box(truck, 0.06, 0.025, 0.006, M.dark, 0, 1.08, 0.709);
  cyl(truck, 0.018, 0.012, M.dark, 0.18, 0.98, 0.71, 'z');
  // the racking screw at the front of the truck
  cyl(truck, 0.012, 0.18, M.steel, 0, yBrk + 0.065, 0.62, 'z', 12);

  const gapBase = P.yGap;
  const poles = [];
  const moving = [];
  const arcs = [];
  for (const x of phase) {
    const pole = cyl(truck, 0.055, 0.62, M.epoxy, x, 1.205, 0.4, 'y', 32);
    pole.renderOrder = 2;
    poles.push(pole);
    for (const y of [1.45, 0.95]) box(truck, 0.03, 0.04, 0.1, M.steel, x, y, 0.5);
    // terminal arms out to the tulip contacts
    for (const y of [ySpU, ySpL]) {
      cyl(truck, 0.02, 0.15, M.copper, x, y, 0.325, 'z', 16);
      cyl(truck, 0.032, 0.07, M.tulip, x, y, 0.215, 'z', 20);
    }
    // vacuum interrupter: ceramic body, copper end caps, fixed contact from above
    const vi = cyl(truck, 0.038, 0.2, M.ceramic, x, gapBase, 0.4, 'y', 28);
    vi.renderOrder = 1;
    cyl(truck, 0.04, 0.01, M.contact, x, gapBase + 0.105, 0.4, 'y', 24);
    cyl(truck, 0.04, 0.01, M.contact, x, gapBase - 0.105, 0.4, 'y', 24);
    cyl(truck, 0.012, ySpU - gapBase, M.contact, x, (ySpU + gapBase) / 2, 0.4, 'y', 12);
    cyl(truck, 0.024, 0.006, M.contact, x, gapBase + 0.003, 0.4, 'y', 24);
    // the moving contact, its stem and the insulated push rod down to the mechanism
    const mv = new THREE.Group();
    truck.add(mv);
    cyl(mv, 0.024, 0.006, M.contact, x, gapBase - 0.003, 0.4, 'y', 24);
    cyl(mv, 0.012, gapBase - 0.98, M.contact, x, (gapBase + 0.98) / 2, 0.4, 'y', 12);
    cyl(mv, 0.02, 0.14, M.resin, x, 0.91, 0.4, 'y', 12);
    moving.push(mv);
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 16, 1, true), M.arc);
    arc.position.set(x, gapBase, 0.4);
    arc.renderOrder = 5;
    truck.add(arc);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: halo(), color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false}));
    sp.position.set(x, gapBase, 0.4);
    sp.renderOrder = 6;
    truck.add(sp);
    arcs.push({arc, sp});
  }
  // the operating shaft linking the three push rods
  const bar = new THREE.Group();
  truck.add(bar);
  cyl(bar, 0.012, 0.5, M.steel, 0, 0.85, 0.4, 'x', 12);

  // ------------------------------------------------------------ pose
  const hlMats = {breaker: [M.ceramic, M.contact], truck: [M.truck], shutter: [M.shutter], earth: [M.blade], cable: [M.cone]};
  const update = (s) => {
    const ex = s.explode ?? 0;
    const k = smoother(ex);
    for (const p of pieces) p.position.copy(p.userData.ex).multiplyScalar(k);
    const out = (s.rack ?? 0) * P.rack + k * 1.0;
    truck.position.z = out;
    const gap = (1 - (s.brk ?? 1)) * P.stroke;
    for (const mv of moving) mv.position.y = -gap;
    bar.position.y = -gap;
    const arcOn = s.arc ?? 0;
    const flick = 0.75 + 0.25 * Math.sin((s.t ?? 0) * 91) * Math.sin((s.t ?? 0) * 37);
    for (const {arc, sp} of arcs) {
      arc.visible = arcOn > 0 && gap > 0.0005;
      arc.scale.y = Math.max(gap, 0.0005);
      arc.position.y = gapBase - gap / 2;
      M.arc.opacity = arcOn * flick;
      sp.material.opacity = arcOn * flick * 0.95;
      sp.position.y = gapBase - gap / 2;
      sp.scale.setScalar(0.09 + 0.05 * flick);
      sp.visible = arcOn > 0;
    }
    // shutters close once the tulips have left the spouts
    const shut = smoother((out - 0.035) / 0.06);
    shU.position.y = ySpU + (1 - shut) * 0.18;
    shL.position.y = ySpL - (1 - shut) * 0.18;
    for (const b of blades) b.rotation.x = 0.05 + (s.earth ?? 0) * (b.userData.closed - 0.05);
    hinge.rotation.y = -1.85 * smoother(s.door ?? 0);
    // lamps: red = closed, green = open (the usual MV convention)
    const closed = (s.brk ?? 1) > 0.5;
    M.lampR.emissiveIntensity = closed ? 2.2 : 0;
    M.lampG.emissiveIntensity = closed ? 0 : 2.2;
    M.ind.color.set(closed ? '#d8392b' : '#2f9e55');
    M.hmi.emissive.set(s.trip && s.trip.includes('50') ? '#ff4a3a' : s.trip ? '#ffb02e' : '#2fd67a');
    // x-ray: the housing goes to glass, the pole tubes go clear enough to see the interrupters
    const xr = s.xray ?? 0;
    for (const m of [M.sheet, M.door, M.inner, M.dark]) {
      m.opacity = 1 - 0.86 * xr;
      m.depthWrite = xr < 0.05;
    }
    M.glass.opacity = 0.22 * (1 - xr);
    M.epoxy.opacity = 1 - 0.85 * xr;
    M.epoxy.depthWrite = xr < 0.05;
    M.ceramic.opacity = 1 - 0.15 * xr;
    // the part doing the work glows in the accent
    for (const key in hlMats)
      for (const m of hlMats[key]) {
        const on = s.hl === key ? 0.5 + 0.5 * Math.sin((s.t ?? 0) * 6) : 0;
        if (key === 'cable') m.emissive.set('#ff2a1a').multiplyScalar(on * 1.4);
        else m.emissive.copy(ACCENT).multiplyScalar(on * 0.45);
      }
    void hmi;
  };
  return {root, update, M, truck, cones, poles};
}
