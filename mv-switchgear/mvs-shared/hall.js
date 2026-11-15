// The data-centre MV room around the hero panel: the other four panels of the lineup, the two grid intakes, the
// transformers, LV switchboards, UPS with batteries and two rows of dual-corded IT racks, joined by cable routes whose
// dashes run with the power that model.solve() says is flowing. update(s, e, k, t) poses it; k (0..1) raises the room.
import * as THREE from 'three';
import {HERO, LINEUP, P} from './model.js';
import {buildPanel} from './panel.js';

const V3 = THREE.Vector3;
export const COL = {grid: '#1f9d63', cordA: '#d2463a', cordB: '#2f6fd1', dead: '#c3c7cb', fault: '#ff2a1a', bat: '#f0a020'};
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

const FLOW_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLOW_FRAG = /* glsl */ `uniform float uTime; uniform float uLive; uniform float uFlow; uniform float uLen; uniform vec3 uCol; uniform vec3 uOff; varying vec2 vUv;
  void main(){
    float x = vUv.x * uLen;
    float d = fract(x / 0.45 - uTime);
    float dash = smoothstep(0.0, 0.08, d) * (1.0 - smoothstep(0.42, 0.5, d));
    vec3 c = mix(uOff, uCol, uLive * (0.55 + 0.45 * mix(1.0, dash, step(0.001, uFlow))));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// panel x in the lineup: the hero (FEEDER T2) sits at the origin
export const panelX = (i) => (i - HERO) * P.W;

export function buildHall() {
  const root = new THREE.Group();
  const room = new THREE.Group();
  root.add(room);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.6, metalness: 0.1, ...o});
  const box = (parent, w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const cyl = (parent, r, h, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  const rod = (parent, a, b, mat, r = 0.012) => {
    const A = new V3(...a);
    const B = new V3(...b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 8), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
    parent.add(m);
    return m;
  };

  // ------------------------------------------------------------ the rest of the lineup
  const others = LINEUP.map((p, i) => {
    if (i === HERO) return null;
    const pn = buildPanel({name: p.name, sub: '11 kV · 1250 A'});
    root.add(pn.root);
    return pn;
  });

  // ------------------------------------------------------------ equipment
  const M = {
    kiosk: std('#8f9a8c'),
    tx: std('#7f8b92', {metalness: 0.3, roughness: 0.5}),
    lv: std('#d4d6d2'),
    ups: std('#2d3136', {roughness: 0.5}),
    rack: std('#1f2226', {roughness: 0.55}),
    bush: std('#5b4c3e'),
    line: std('#9aa0a6'),
    ledA: new THREE.MeshStandardMaterial({color: '#111', emissive: COL.grid, emissiveIntensity: 1.6}),
    statA: new THREE.MeshStandardMaterial({color: '#111', emissive: COL.grid, emissiveIntensity: 1.8}),
    statB: new THREE.MeshStandardMaterial({color: '#111', emissive: COL.grid, emissiveIntensity: 1.8}),
    dropA: std(COL.cordA, {emissive: COL.cordA, emissiveIntensity: 0.3}),
    dropB: std(COL.cordB, {emissive: COL.cordB, emissiveIntensity: 0.3}),
    fence: std('#b9bec2', {metalness: 0.6, roughness: 0.4}),
  };
  const ROOM = {txA: [-3.0, -3.5], txB: [1.4, -3.5], lvA: [-3.0, -5.2], lvB: [1.4, -5.2], upsA: [-3.0, -6.8], upsB: [1.4, -6.8], gridA: [-6.0, 0.1], gridB: [3.4, 0.1]};
  // grid intakes: a fenced utility kiosk
  for (const [x, z] of [ROOM.gridA, ROOM.gridB]) {
    box(room, 1.3, 1.5, 0.9, M.kiosk, x, 0.75, z);
    box(room, 1.36, 0.06, 0.96, M.lv, x, 1.53, z);
    for (const sx of [-0.9, 0.9]) box(room, 0.02, 1.0, 1.6, M.fence, x + sx, 0.5, z);
  }
  // transformers 11 kV / 415 V, 2.5 MVA: tank, radiator fins, HV bushings
  for (const [x, z] of [ROOM.txA, ROOM.txB]) {
    box(room, 1.3, 1.5, 0.9, M.tx, x, 0.85, z);
    for (let i = 0; i < 7; i++) {
      box(room, 0.03, 1.2, 0.3, M.tx, x - 0.54 + i * 0.18, 0.8, z + 0.6);
      box(room, 0.03, 1.2, 0.3, M.tx, x - 0.54 + i * 0.18, 0.8, z - 0.6);
    }
    for (let i = 0; i < 3; i++) cyl(room, 0.05, 0.3, M.bush, x - 0.3 + i * 0.3, 1.75, z + 0.2);
    for (let i = 0; i < 4; i++) cyl(room, 0.04, 0.22, M.bush, x - 0.36 + i * 0.24, 1.71, z - 0.25);
    box(room, 1.4, 0.1, 1.0, M.line, x, 0.05, z);
  }
  // LV switchboards
  for (const [x, z] of [ROOM.lvA, ROOM.lvB]) {
    box(room, 2.2, 2.1, 0.6, M.lv, x, 1.05, z);
    for (let i = 1; i < 5; i++) box(room, 0.01, 2.0, 0.01, M.line, x - 1.1 + i * 0.44, 1.05, z + 0.305);
  }
  // UPS modules and battery strings, a status strip on top that turns amber on battery
  const stat = [];
  for (const [[x, z], st] of [[ROOM.upsA, M.statA], [ROOM.upsB, M.statB]]) {
    box(room, 1.0, 2.0, 0.8, M.ups, x - 0.75, 1.0, z);
    box(room, 1.4, 2.0, 0.8, M.ups, x + 0.5, 1.0, z);
    for (let i = 0; i < 6; i++) box(room, 1.3, 0.02, 0.01, M.line, x + 0.5, 0.35 + i * 0.28, z + 0.405);
    box(room, 2.3, 0.05, 0.02, st, x - 0.05, 1.9, z + 0.41);
    stat.push(st);
  }
  // IT racks, two rows facing a cold aisle, with A (red) and B (blue) overhead feeds and a drop to every rack
  const RX = [];
  for (let i = 0; i < 9; i++) RX.push(-3.9 + i * 0.64);
  const ROWZ = [-8.6, -10.4];
  const ledGeo = new THREE.BoxGeometry(0.4, 0.012, 0.01);
  for (const rz of ROWZ)
    for (const x of RX) {
      box(room, 0.6, 2.0, 1.0, M.rack, x, 1.0, rz);
      const face = rz > -9.5 ? rz - 0.505 : rz + 0.505;
      for (let j = 0; j < 6; j++) {
        const led = new THREE.Mesh(ledGeo, M.ledA);
        led.position.set(x, 0.4 + j * 0.27, face);
        room.add(led);
      }
      const fz = rz > -9.5 ? rz - 0.42 : rz + 0.42;
      rod(room, [x - 0.12, 2.35, -9.25], [x - 0.12, 2.0, fz], M.dropA);
      rod(room, [x + 0.12, 2.55, -9.55], [x + 0.12, 2.0, fz], M.dropB);
    }

  // ------------------------------------------------------------ cable routes with running dashes
  const flows = {};
  const path = (key, pts, col, r = 0.035) => {
    const curve = new THREE.CurvePath();
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new V3(...pts[i]);
      const b = new V3(...pts[i + 1]);
      curve.add(new THREE.LineCurve3(a, b));
      len += a.distanceTo(b);
    }
    const geo = new THREE.TubeGeometry(curve, Math.max(8, Math.round(len * 12)), r, 8, false);
    const mat = new THREE.ShaderMaterial({
      vertexShader: FLOW_VERT,
      fragmentShader: FLOW_FRAG,
      uniforms: {uTime: {value: 0}, uLive: {value: 0}, uFlow: {value: 0}, uLen: {value: len}, uCol: {value: new THREE.Color(col)}, uOff: {value: new THREE.Color(COL.dead)}},
    });
    const m = new THREE.Mesh(geo, mat);
    room.add(m);
    flows[key] = {mat, phase: 0, col: new THREE.Color(col)};
  };
  const y = 0.04;
  const xs = LINEUP.map((_, i) => panelX(i));
  path('gA', [[ROOM.gridA[0] + 0.65, y, ROOM.gridA[1]], [xs[0], y, ROOM.gridA[1]], [xs[0], y, -0.43]], COL.grid, 0.05);
  path('gB', [[ROOM.gridB[0] - 0.65, y, ROOM.gridB[1]], [xs[4], y, ROOM.gridB[1]], [xs[4], y, -0.43]], COL.grid, 0.05);
  path('f1', [[xs[1], y, -0.43], [xs[1], y, -2.0], [ROOM.txA[0], y, -2.0], [ROOM.txA[0], y, ROOM.txA[1] + 0.75]], COL.grid, 0.05);
  path('f2', [[xs[3], y, -0.43], [xs[3], y, -2.0], [ROOM.txB[0], y, -2.0], [ROOM.txB[0], y, ROOM.txB[1] + 0.75]], COL.grid, 0.05);
  path('lA', [[ROOM.txA[0], y, ROOM.txA[1] - 0.75], [ROOM.lvA[0], y, ROOM.lvA[1] + 0.3]], COL.grid, 0.06);
  path('lB', [[ROOM.txB[0], y, ROOM.txB[1] - 0.75], [ROOM.lvB[0], y, ROOM.lvB[1] + 0.3]], COL.grid, 0.06);
  path('uA', [[ROOM.lvA[0], y, ROOM.lvA[1] - 0.3], [ROOM.upsA[0], y, ROOM.upsA[1] + 0.4]], COL.grid, 0.06);
  path('uB', [[ROOM.lvB[0], y, ROOM.lvB[1] - 0.3], [ROOM.upsB[0], y, ROOM.upsB[1] + 0.4]], COL.grid, 0.06);
  path('iA', [[ROOM.upsA[0] + 0.2, 2.0, ROOM.upsA[1] - 0.2], [ROOM.upsA[0] + 0.2, 2.35, ROOM.upsA[1] - 0.2], [ROOM.upsA[0] + 0.2, 2.35, -9.25], [-4.3, 2.35, -9.25], [RX[8] + 0.3, 2.35, -9.25]], COL.cordA, 0.045);
  path('iB', [[ROOM.upsB[0] + 0.2, 2.0, ROOM.upsB[1] - 0.2], [ROOM.upsB[0] + 0.2, 2.55, ROOM.upsB[1] - 0.2], [ROOM.upsB[0] + 0.2, 2.55, -9.55], [RX[8] + 0.3, 2.55, -9.55], [-4.3, 2.55, -9.55]], COL.cordB, 0.045);

  // ------------------------------------------------------------ pose
  let lastT = 0;
  const update = (s, e, k, t) => {
    const kk = smoother(k);
    room.visible = kk > 0.002;
    room.position.y = -(1 - kk) * 2.9;
    others.forEach((pn, i) => {
      if (!pn) return;
      pn.root.visible = kk > 0.002;
      const side = i < HERO ? -1 : 1;
      pn.root.position.set(panelX(i) + side * (1 - kk) * 6, 0, 0);
      pn.update({brk: s.brk[i], t, xray: 0});
    });
    const dt = Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    const set = (key, live, flow, col) => {
      const f = flows[key];
      f.phase += dt * flow * 1.6;
      f.mat.uniforms.uTime.value = f.phase;
      f.mat.uniforms.uLive.value = live ? 1 : 0;
      f.mat.uniforms.uFlow.value = flow;
      f.mat.uniforms.uCol.value.copy(col ?? f.col);
    };
    const flowOf = (amps) => (amps > 1 ? Math.min(2.2, 0.6 + amps / 160) : 0);
    const faultCol = new THREE.Color(COL.fault);
    set('gA', s.grid[0], flowOf(e.I[0]));
    set('gB', s.grid[1], flowOf(e.I[4]), s.fault ? faultCol : null);
    set('f1', e.busA && e.c[1], flowOf(e.I[1]));
    set('f2', e.busB && e.c[3], s.fault ? 3 : flowOf(e.I[3]), s.fault ? faultCol : null);
    set('lA', e.t1, flowOf(e.I[1]));
    set('lB', e.t2, flowOf(e.I[3]));
    set('uA', e.t1, flowOf(e.I[1]));
    set('uB', e.t2, flowOf(e.I[3]));
    // the UPS output never stops: from mains, or from the battery when its side is down
    set('iA', true, 1.0 + (e.loadA > 0 ? e.loadA / 3 : 0.4), e.t1 ? null : new THREE.Color(COL.bat));
    set('iB', true, 1.0 + (e.loadB > 0 ? e.loadB / 3 : 0.4), e.t2 ? null : new THREE.Color(COL.bat));
    stat[0].emissive.set(e.t1 ? COL.grid : COL.bat);
    stat[1].emissive.set(e.t2 ? COL.grid : COL.bat);
    M.ledA.emissiveIntensity = 1.2 + 0.5 * Math.sin(t * 9.3) * Math.sin(t * 3.1);
  };
  return {root, update, ROOM, RX, ROWZ, others};
}
