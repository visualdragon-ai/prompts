// The geometry: one generator set built from code in the dimensions of model.js. The acoustic enclosure, the belly
// fuel tank, the V16 (block, 16 heads, crankshaft, 16 pistons on real slider-crank rods, turbochargers, aftercooler,
// exhaust manifolds), flywheel and starters, the radiator and fan, the 4-pole alternator with exciter and terminal box,
// controller, batteries and the roof silencer. update(s) poses it from the frame's state.
import * as THREE from 'three';
import {CYL, E, pinDist} from './model.js';

const V3 = THREE.Vector3;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoother = (x) => {
  const u = clamp01(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ACCENT = new THREE.Color('#e3562a');
// the hero's section: keeps z <= cut
export const SECTION_PLANE = new THREE.Plane(new V3(0, 0, -1), 10);

export function makeMats(clip) {
  const planes = clip ? [SECTION_PLANE] : [];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const shell = (color, o = {}) => std({color, roughness: 0.6, metalness: 0.15, clippingPlanes: planes, clipShadows: true, transparent: true, ...o});
  return {
    encl: shell('#d8d6ce', {side: THREE.DoubleSide}),
    louvre: shell('#9a9b96'),
    block: shell('#2f5560', {roughness: 0.55, metalness: 0.25}),
    head: shell('#2a4b55', {roughness: 0.5, metalness: 0.3}),
    cover: shell('#d6d9d6', {roughness: 0.4, metalness: 0.5}),
    altFrame: shell('#33383e', {roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide}),
    fly: shell('#3b4046', {roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide}),
    radFrame: shell('#30353a'),
    core: shell('#5d6166', {roughness: 0.8}),
    tank: std({color: '#262a2e', roughness: 0.6, metalness: 0.2}),
    steel: std({color: '#8e959c', roughness: 0.4, metalness: 0.8}),
    crank: std({color: '#a9afb5', roughness: 0.3, metalness: 0.9}),
    piston: std({color: '#c7cbcf', roughness: 0.35, metalness: 0.8}),
    rod: std({color: '#7f878f', roughness: 0.35, metalness: 0.85}),
    copper: std({color: '#c47a4a', roughness: 0.4, metalness: 0.85}),
    lam: std({color: '#4c5157', roughness: 0.55, metalness: 0.5}),
    rotor: std({color: '#5e646b', roughness: 0.45, metalness: 0.6}),
    exh: std({color: '#6f6a64', roughness: 0.55, metalness: 0.6, emissive: '#ff5a1a', emissiveIntensity: 0}),
    turbo: std({color: '#9aa0a5', roughness: 0.45, metalness: 0.7}),
    fan: std({color: '#2a2e33', roughness: 0.6, transparent: true}),
    starter: std({color: '#3d4247', roughness: 0.5, metalness: 0.4}),
    pinion: std({color: '#b8bdc2', roughness: 0.35, metalness: 0.85}),
    cable: std({color: '#1b1d20', roughness: 0.7}),
    batt: std({color: '#1f2226', roughness: 0.6}),
    red: std({color: '#b5352a', roughness: 0.5}),
    ctrl: std({color: '#d9dbd8', roughness: 0.5}),
    screen: std({color: '#0c1612', emissive: '#2fd67a', emissiveIntensity: 0.5}),
    silencer: std({color: '#8a8780', roughness: 0.5, metalness: 0.6, transparent: true}),
    rubber: std({color: '#191b1d', roughness: 0.9}),
    fire: new THREE.MeshBasicMaterial({color: '#ffb347', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}),
  };
}

let smokeTex = null;
const smokeMap = () => {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(70,70,72,.9)');
  gr.addColorStop(0.6, 'rgba(90,90,92,.35)');
  gr.addColorStop(1, 'rgba(110,110,112,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
};

export function buildGenset({clip = false, label = 'G1'} = {}) {
  const M = makeMats(clip);
  const root = new THREE.Group();
  const sh = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (p, w, h, d, mat, x, y, z) => {
    const m = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
    m.position.set(x, y, z);
    p.add(m);
    return m;
  };
  const cyl = (p, r, len, mat, x, y, z, axis = 'y', seg = 28, open = false) => {
    const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1, open), mat));
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    p.add(m);
    return m;
  };
  const pieces = [];
  const piece = (ex, parent = root) => {
    const g = new THREE.Group();
    g.userData.ex = new V3(...ex);
    parent.add(g);
    pieces.push(g);
    return g;
  };
  const {yC} = E;

  // ------------------------------------------------------------ base: belly fuel tank, rails, anti-vibration mounts
  const base = piece([0, 0, 0]);
  box(base, 5.7, 0.33, 1.9, M.tank, -0.45, 0.165, 0);
  for (const z of [-0.8, 0.8]) box(base, 5.7, 0.04, 0.12, M.steel, -0.45, 0.35, z);
  box(base, 0.3, 0.06, 0.3, M.red, -2.8, 0.36, 0.7);
  for (const x of [-1.9, -0.4, 0.8, 1.8]) for (const z of [-0.62, 0.62]) cyl(base, 0.07, 0.1, M.rubber, x, 0.42, z, 'y', 16);

  // ------------------------------------------------------------ the engine block: crankcase, two banks, sump
  const blockP = piece([0, 0, 0]);
  box(blockP, 2.25, 0.6, 0.86, M.block, -1.0, yC + 0.0, 0);
  box(blockP, 2.15, 0.16, 0.74, M.block, -1.0, 0.56, 0);
  const banks = [];
  for (const beta of [-E.bank, E.bank]) {
    const dir = new V3(0, Math.cos(beta), Math.sin(beta));
    const a = 0.2;
    const b = E.deck;
    const m = box(blockP, 2.2, b - a, 0.3, M.block, -1.0, 0, 0);
    m.rotation.x = beta;
    m.position.copy(dir.clone().multiplyScalar((a + b) / 2)).add(new V3(-1.0, yC, 0));
    banks.push(dir);
  }
  // front cover, crank pulley, the belt up to the fan
  box(blockP, 0.1, 0.9, 0.8, M.block, -2.17, yC + 0.15, 0);
  // engine feet
  for (const x of [-1.9, -0.4]) for (const z of [-0.62, 0.62]) box(blockP, 0.2, 0.55, 0.12, M.block, x, 0.72, z);

  // ------------------------------------------------------------ 16 cylinder heads with rocker covers, exhaust manifolds, turbos
  const headsP = [piece([0, 0, 0]), piece([0, 0, 0])];
  const firing = [];
  banks.forEach((dir, b) => {
    const beta = b ? E.bank : -E.bank;
    const hp = headsP[b];
    hp.userData.ex.copy(dir).multiplyScalar(0.55);
    for (let k = 0; k < 8; k++) {
      const x = E.throwX[k] + (b ? E.dx : -E.dx);
      const c = dir.clone().multiplyScalar(E.deck + 0.085).add(new V3(x, yC, 0));
      const h = box(hp, 0.215, 0.17, 0.3, M.head, 0, 0, 0);
      h.rotation.x = beta;
      h.position.copy(c);
      const cv = box(hp, 0.19, 0.07, 0.24, M.cover, 0, 0, 0);
      cv.rotation.x = beta;
      cv.position.copy(dir.clone().multiplyScalar(E.deck + 0.205).add(new V3(x, yC, 0)));
      // the fire in the chamber: a disc at the head face
      const f = new THREE.Mesh(new THREE.CylinderGeometry(E.pistonR * 0.95, E.pistonR * 0.95, 0.02, 24), M.fire.clone());
      f.rotation.x = beta;
      f.position.copy(dir.clone().multiplyScalar(E.deck - 0.012).add(new V3(x, yC, 0)));
      f.renderOrder = 4;
      root.add(f);
      firing.push(f);
    }
    // exhaust manifold along the outside of each bank
    const out = new V3(0, -Math.sin(beta), Math.cos(beta)).multiplyScalar(b ? 1 : -1);
    const mp = dir.clone().multiplyScalar(E.deck + 0.05).addScaledVector(out, 0.22).add(new V3(-1.0, yC, 0));
    cyl(hp, 0.065, 2.0, M.exh, mp.x, mp.y, mp.z, 'x', 18);
    for (let k = 0; k < 8; k++) {
      const x = E.throwX[k] + (b ? E.dx : -E.dx);
      const r = cyl(hp, 0.035, 0.16, M.exh, x, 0, 0, 'y', 12);
      r.position.copy(dir.clone().multiplyScalar(E.deck + 0.05).addScaledVector(out, 0.14).add(new V3(x, yC, 0)));
      r.quaternion.setFromUnitVectors(new V3(0, 1, 0), out);
    }
  });
  // aftercooler in the vee
  const ac = piece([0, 0.55, 0]);
  box(ac, 1.9, 0.26, 0.34, M.head, -1.0, yC + 0.55, 0);
  box(ac, 1.85, 0.03, 0.3, M.cover, -1.0, yC + 0.695, 0);
  // two turbochargers at the front, one per bank: turbine and compressor housings, a compressor wheel
  const turbos = [];
  const turboP = piece([-0.5, 0.9, 0]);
  for (const z of [-0.5, 0.5]) {
    cyl(turboP, 0.17, 0.2, M.exh, -2.25, 1.86, z, 'x', 28);
    cyl(turboP, 0.16, 0.17, M.turbo, -2.44, 1.86, z, 'x', 28);
    cyl(turboP, 0.09, 0.14, M.turbo, -2.58, 1.86, z, 'x', 20, true);
    const wheel = new THREE.Group();
    wheel.position.set(-2.6, 1.86, z);
    turboP.add(wheel);
    for (let i = 0; i < 8; i++) {
      const bl = box(wheel, 0.01, 0.075, 0.02, M.steel, 0, 0, 0);
      bl.rotation.x = (i / 8) * Math.PI * 2;
      bl.position.set(0, 0.04 * Math.cos((i / 8) * Math.PI * 2), 0.04 * Math.sin((i / 8) * Math.PI * 2));
    }
    turbos.push(wheel);
    // crossover from the manifold and the exhaust riser
    cyl(turboP, 0.06, 0.4, M.exh, -2.1, 1.7, z * 1.2, 'y', 14);
    cyl(turboP, 0.09, 1.0, M.exh, -2.25, 2.5, z * 0.6, 'y', 18);
  }

  // ------------------------------------------------------------ crankshaft, pistons and rods
  const crank = new THREE.Group();
  crank.position.set(0, yC, 0);
  root.add(crank);
  cyl(crank, 0.07, 2.45, M.crank, -1.0, 0, 0, 'x', 20);
  E.throwX.forEach((x, k) => {
    const ph = E.phi[k];
    const pin = new THREE.Group();
    pin.rotation.x = ph;
    pin.position.x = x;
    crank.add(pin);
    cyl(pin, 0.06, 0.16, M.crank, 0, E.r, 0, 'x', 18);
    for (const dx of [-0.095, 0.095]) {
      box(pin, 0.04, E.r + 0.13, 0.17, M.crank, dx, E.r / 2 - 0.02, 0);
      box(pin, 0.045, 0.12, 0.3, M.crank, dx, -0.1, 0);
    }
  });
  cyl(crank, 0.15, 0.1, M.steel, -2.3, 0, 0, 'x', 28);
  // flywheel with its ring gear
  cyl(crank, 0.55, 0.12, M.steel, 0.1, 0, 0, 'x', 48);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.018, 8, 96), M.pinion);
  ring.rotation.y = Math.PI / 2;
  ring.position.x = 0.1;
  crank.add(ring);

  const pistons = [];
  const rods = [];
  const pGeo = new THREE.CylinderGeometry(E.pistonR, E.pistonR, 0.17, 28);
  const rGeo = new THREE.BoxGeometry(0.045, 1, 0.07);
  for (const c of CYL) {
    const p = sh(new THREE.Mesh(pGeo, M.piston));
    p.rotation.x = c.beta;
    root.add(p);
    pistons.push(p);
    const r = sh(new THREE.Mesh(rGeo, M.rod));
    root.add(r);
    rods.push(r);
  }

  // ------------------------------------------------------------ flywheel housing and two starter motors
  const flyP = piece([0.35, 0, 0]);
  cyl(flyP, 0.64, 0.3, M.fly, 0.14, yC, 0, 'x', 48, true);
  const disc = cyl(flyP, 0.64, 0.02, M.fly, 0.29, yC, 0, 'x', 48);
  void disc;
  const starters = [];
  const starterP = piece([0, -0.2, 0]);
  for (const z of [-0.42, 0.42]) {
    cyl(starterP, 0.085, 0.4, M.starter, -0.25, 0.64, z, 'x', 20);
    cyl(starterP, 0.06, 0.08, M.starter, -0.02, 0.64, z, 'x', 16);
    const pn = new THREE.Group();
    pn.position.set(0.02, 0.64, z);
    starterP.add(pn);
    cyl(pn, 0.04, 0.06, M.pinion, 0, 0, 0, 'x', 12);
    for (let i = 0; i < 6; i++) {
      const t = box(pn, 0.06, 0.012, 0.012, M.pinion, 0, 0, 0);
      t.position.set(0, 0.042 * Math.cos((i / 6) * Math.PI * 2), 0.042 * Math.sin((i / 6) * Math.PI * 2));
      t.rotation.x = (i / 6) * Math.PI * 2;
    }
    starters.push(pn);
    // battery cable
    cyl(starterP, 0.012, 0.5, M.red, -0.25, 0.64, z + (z > 0 ? 0.1 : -0.1), 'y', 8);
  }

  // ------------------------------------------------------------ radiator and fan, belt-driven from the crank nose
  const radP = piece([-1.1, 0, 0]);
  box(radP, 0.22, 2.1, 2.0, M.core, -3.12, 1.45, 0);
  box(radP, 0.26, 0.08, 2.08, M.radFrame, -3.12, 2.52, 0);
  box(radP, 0.26, 0.08, 2.08, M.radFrame, -3.12, 0.4, 0);
  for (const z of [-1.02, 1.02]) box(radP, 0.26, 2.2, 0.06, M.radFrame, -3.12, 1.45, z);
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.05, 10, 64), M.radFrame);
  shroud.rotation.y = Math.PI / 2;
  shroud.position.set(-2.85, 1.45, 0);
  radP.add(shroud);
  const fan = new THREE.Group();
  fan.position.set(-2.85, 1.45, 0);
  radP.add(fan);
  cyl(fan, 0.14, 0.12, M.fan, 0, 0, 0, 'x', 20);
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    g.rotation.x = (i / 8) * Math.PI * 2;
    fan.add(g);
    const bl = box(g, 0.03, 0.74, 0.2, M.fan, 0, 0.5, 0);
    bl.rotation.y = 0.45;
  }
  cyl(radP, 0.03, 0.85, M.steel, -2.55, 1.45, 0, 'x', 10);
  // the belt from crank pulley to fan pulley
  const beltA = box(radP, 0.03, 0.44, 0.012, M.rubber, -2.5, 1.25, 0.15);
  const beltB = box(radP, 0.03, 0.44, 0.012, M.rubber, -2.5, 1.25, -0.15);
  void beltA;
  void beltB;

  // ------------------------------------------------------------ the alternator: frame, stator, rotor with 4 poles, exciter, terminal box
  const altP = piece([1.3, 0, 0]);
  cyl(altP, 0.66, 1.72, M.altFrame, 1.14, yC, 0, 'x', 56, true);
  cyl(altP, 0.66, 0.03, M.altFrame, 2.0, yC, 0, 'x', 56);
  for (const z of [-0.5, 0.5]) box(altP, 1.5, 0.3, 0.14, M.altFrame, 1.14, 0.55, z);
  // stator core and its end windings
  cyl(altP, 0.6, 1.3, M.lam, 1.14, yC, 0, 'x', 48, true);
  for (const x of [0.43, 1.85]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.06, 10, 48), M.copper);
    w.rotation.y = Math.PI / 2;
    w.position.set(x, yC, 0);
    w.castShadow = true;
    altP.add(w);
  }
  // terminal box with the AVR, output cables down the side
  const tb = piece([0, 0.7, 0], altP);
  box(tb, 0.75, 0.5, 0.7, M.altFrame, 1.3, yC + 0.9, 0);
  box(tb, 0.3, 0.2, 0.02, M.cover, 1.3, yC + 0.92, 0.36);
  for (let i = 0; i < 4; i++) {
    cyl(tb, 0.035, 1.05, M.cable, 1.05 + i * 0.17, 1.15, 0.72, 'y', 12);
    cyl(tb, 0.035, 0.38, M.cable, 1.05 + i * 0.17, yC + 0.8, 0.52, 'z', 12);
  }
  // rotor: shaft, core, four salient poles with copper field coils
  const rotorP = piece([2.6, 0, 0]);
  const rotor = new THREE.Group();
  rotor.position.set(0, yC, 0);
  rotorP.add(rotor);
  cyl(rotor, 0.08, 2.15, M.steel, 1.25, 0, 0, 'x', 16);
  cyl(rotor, 0.26, 1.28, M.rotor, 1.14, 0, 0, 'x', 32);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    g.rotation.x = (i / 4) * Math.PI * 2;
    g.position.x = 1.14;
    rotor.add(g);
    box(g, 1.26, 0.2, 0.26, M.copper, 0, 0.33, 0);
    box(g, 1.28, 0.06, 0.34, M.rotor, 0, 0.43, 0);
  }
  // exciter on the end of the shaft
  const exP = piece([3.1, 0, 0]);
  cyl(exP, 0.3, 0.3, M.altFrame, 2.18, yC, 0, 'x', 40, true);
  cyl(exP, 0.3, 0.02, M.altFrame, 2.33, yC, 0, 'x', 40);
  const exR = cyl(rotor, 0.2, 0.2, M.copper, 2.18, 0, 0, 'x', 24);
  void exR;

  // ------------------------------------------------------------ controller and start batteries on the service side
  const ctrlP = piece([0, 0, 0.9]);
  cyl(ctrlP, 0.03, 1.1, M.steel, 1.0, 0.9, 1.05, 'y', 10);
  box(ctrlP, 0.5, 0.6, 0.18, M.ctrl, 1.0, 1.6, 1.05);
  const screen = box(ctrlP, 0.26, 0.16, 0.01, M.screen, 1.0, 1.7, 1.145);
  box(ctrlP, 0.06, 0.06, 0.02, M.red, 1.17, 1.44, 1.145);
  const battP = piece([0, 0, 0.8]);
  for (const x of [-0.95, -0.4]) {
    box(battP, 0.5, 0.26, 0.22, M.batt, x, 0.48, 1.08);
    box(battP, 0.04, 0.03, 0.04, M.red, x + 0.18, 0.625, 1.08);
  }

  // ------------------------------------------------------------ the acoustic enclosure and roof silencer
  const L0 = -3.62;
  const L1 = 2.92;
  const Lc = (L0 + L1) / 2;
  const HZ = 1.3;
  const HY = 3.05;
  const roofP = piece([0, 5.4, 0]);
  box(roofP, L1 - L0, 0.04, 2 * HZ, M.encl, Lc, HY, 0);
  const sideA = piece([0, 0, -2.6]);
  const sideB = piece([0, 3.4, 2.2]);
  for (const [p, z] of [[sideA, -HZ], [sideB, HZ]]) {
    box(p, L1 - L0, HY, 0.04, M.encl, Lc, HY / 2, z);
    // two service doors, outlined
    for (const x0 of [-2.4, 0.4]) {
      for (const [w, h, x, y] of [[1.6, 0.03, x0 + 0.8, 2.45], [1.6, 0.03, x0 + 0.8, 0.25], [0.03, 2.2, x0, 1.35], [0.03, 2.2, x0 + 1.6, 1.35]]) box(p, w, h, 0.012, M.louvre, x, y, z + (z > 0 ? 0.025 : -0.025));
      box(p, 0.04, 0.2, 0.02, M.louvre, x0 + 1.45, 1.3, z + (z > 0 ? 0.03 : -0.03));
    }
  }
  const endR = piece([-1.8, 0, 0]);
  const endA = piece([1.8, 0, 0]);
  for (const [p, x] of [[endR, L0], [endA, L1]]) {
    box(p, 0.04, HY, 2 * HZ, M.encl, x, HY / 2, 0);
    for (let i = 0; i < 11; i++) box(p, 0.03, 0.04, 2.0, M.louvre, x + (x < 0 ? -0.03 : 0.03), 0.5 + i * 0.2, 0);
  }
  const silP = piece([0, 6.2, 0]);
  cyl(silP, 0.36, 2.3, M.silencer, -1.0, HY + 0.45, 0, 'x', 32);
  for (const x of [-2.1, 0.1]) box(silP, 0.1, 0.36, 0.5, M.silencer, x, HY + 0.18, 0);
  cyl(silP, 0.14, 0.9, M.silencer, 0.0, HY + 1.05, 0, 'y', 20);
  cyl(silP, 0.2, 0.03, M.silencer, 0.0, HY + 1.55, 0, 'y', 20);
  // exhaust smoke at the stack
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: smokeMap(), transparent: true, opacity: 0, depthWrite: false}));
    sp.userData.i = i;
    silP.add(sp);
    puffs.push(sp);
  }

  // ------------------------------------------------------------ pose
  const tmpP = new V3();
  const tmpQ = new V3();
  const up = new V3(0, 1, 0);
  const hl = {starter: [M.pinion, M.starter], engine: [M.piston], alt: [M.copper, M.rotor]};
  const update = (s) => {
    const ex = smoother(s.explode ?? 0);
    for (const p of pieces) p.position.copy(p.userData.ex).multiplyScalar(ex);
    const th = s.crank ?? 0;
    crank.rotation.x = th;
    rotor.rotation.x = th;
    CYL.forEach((c, i) => {
      const a = th + E.phi[c.k] - c.beta;
      const d = pinDist(a);
      const dir = banks[c.b];
      tmpP.set(c.x, yC + E.r * Math.cos(th + E.phi[c.k]), E.r * Math.sin(th + E.phi[c.k]));
      tmpQ.set(c.x, yC + d * dir.y, d * dir.z);
      pistons[i].position.copy(tmpQ).addScaledVector(dir, 0.045);
      const r = rods[i];
      r.position.copy(tmpP).add(tmpQ).multiplyScalar(0.5);
      r.scale.y = tmpP.distanceTo(tmpQ);
      r.quaternion.setFromUnitVectors(up, tmpQ.clone().sub(tmpP).normalize());
      // the charge burns for 50° after this cylinder's firing TDC
      const deg = ((((a * 180) / Math.PI + c.offset) % 720) + 720) % 720;
      const burn = s.fuel && deg < 50 ? 1 - deg / 50 : 0;
      firing[i].material.opacity = burn * 0.95;
      firing[i].visible = burn > 0.01;
    });
    fan.rotation.x = th * 0.85;
    const tspin = th * (6 + (s.turbo ?? 0) * 0.25);
    for (const w of turbos) w.rotation.x = tspin;
    const eng = smoother((s.starter ?? 0) * 1.0);
    starters.forEach((pn) => {
      pn.position.x = 0.02 + 0.075 * eng;
      pn.rotation.x = -th * (0.55 / 0.042);
    });
    // exhaust manifolds glow dull red with exhaust temperature
    M.exh.emissiveIntensity = Math.max(0, ((s.exh ?? 25) - 300) / 260) * 0.55;
    M.screen.emissive.set(s.starter > 0.05 || (s.n > 1 && s.P < 5 && !(s.V > 400)) ? '#ffb02e' : s.n > 1 ? '#2fd67a' : '#4aa3ff');
    // x-ray: the enclosure, block, heads and alternator frame go to glass
    const xr = s.xray ?? 0;
    for (const m of [M.encl, M.louvre, M.radFrame, M.core, M.fan, M.silencer]) {
      m.opacity = 1 - 0.9 * xr;
      m.depthWrite = xr < 0.05;
    }
    for (const m of [M.block, M.head, M.cover, M.altFrame, M.fly]) {
      m.opacity = 1 - 0.8 * xr;
      m.depthWrite = xr < 0.05;
    }
    // smoke: puffs rising from the stack
    const sm = s.smoke ?? 0;
    for (const sp of puffs) {
      const k = (((s.t ?? 0) * 0.7 + sp.userData.i / puffs.length) % 1 + 1) % 1;
      sp.position.set(0.0 - k * 0.6, HY + 1.6 + k * 2.2, 0);
      sp.scale.setScalar(0.4 + k * 1.6);
      sp.material.opacity = sm * (1 - k) * 0.85;
      sp.visible = sm > 0.01;
    }
    for (const key in hl)
      for (const m of hl[key]) {
        const on = s.hl === key ? 0.5 + 0.5 * Math.sin((s.t ?? 0) * 6) : 0;
        m.emissive.copy(ACCENT).multiplyScalar(on * 0.4);
      }
    void screen;
  };
  void label;
  return {root, update, M};
}
