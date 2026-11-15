// The data-centre site around the hero set: two more sets in the generator yard (N+1), the bulk fuel tank with its
// lines, the paralleling switchboard, a load bank, and the building: grid intake and transformer, the main switchboard
// with the automatic transfer, the UPS and two rows of racks. Cable routes run dashes where power flows.
// update(s, e, k, t) poses it; k (0..1) raises the site.
import * as THREE from 'three';
import {buildGenset} from './genset.js';

const V3 = THREE.Vector3;
export const COL = {util: '#2f6fd1', gen: '#e39a1c', it: '#1f9d63', dead: '#c3c7cb', bat: '#d9a400', fuel: '#7a5a2e'};
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const FLOW_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLOW_FRAG = /* glsl */ `uniform float uTime; uniform float uLive; uniform float uFlow; uniform float uLen; uniform vec3 uCol; uniform vec3 uOff; varying vec2 vUv;
  void main(){
    float d = fract(vUv.x * uLen / 0.7 - uTime);
    float dash = smoothstep(0.0, 0.08, d) * (1.0 - smoothstep(0.42, 0.5, d));
    vec3 c = mix(uOff, uCol, uLive * (0.55 + 0.45 * mix(1.0, dash, step(0.001, uFlow))));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
export const SET_Z = [0, -3.6, -7.2];

export function buildSite() {
  const root = new THREE.Group();
  const room = new THREE.Group();
  root.add(room);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.6, metalness: 0.1, ...o});
  const box = (p, w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    p.add(m);
    return m;
  };
  const M = {
    slab: std('#d3d6d3', {roughness: 0.9}),
    wall: std('#c9ccc8'),
    tank: std('#cfd2cd', {metalness: 0.3, roughness: 0.45}),
    bund: std('#b4b8b4'),
    swbd: std('#d8dad6'),
    kiosk: std('#8f9a8c'),
    tx: std('#7f8b92', {metalness: 0.3, roughness: 0.5}),
    ups: std('#2d3136'),
    rack: std('#1f2226'),
    lb: std('#5b6168'),
    grille: std('#9aa0a6'),
    led: new THREE.MeshStandardMaterial({color: '#111', emissive: COL.it, emissiveIntensity: 1.5}),
    upsStat: new THREE.MeshStandardMaterial({color: '#111', emissive: COL.it, emissiveIntensity: 1.8}),
    lbGlow: new THREE.MeshStandardMaterial({color: '#3a2a20', emissive: '#ff5a1a', emissiveIntensity: 0}),
  };
  // the two other sets in the yard
  const others = [1, 2].map((i) => {
    const g = buildGenset({label: `G${i + 1}`});
    g.root.position.z = SET_Z[i];
    root.add(g.root);
    return g;
  });
  // yard slab
  box(room, 9.4, 0.06, 11.4, M.slab, -0.35, 0.03, -3.6);
  // bulk fuel tank in its bund, fuel lines to each set
  const T = {x: -7.0, z: -3.6};
  box(room, 2.8, 0.5, 7.4, M.bund, T.x, 0.25, T.z);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 6.4, 32), M.tank);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(T.x, 1.65, T.z);
  tank.castShadow = true;
  room.add(tank);
  for (const z of [T.z - 2.2, T.z + 2.2]) box(room, 1.6, 0.6, 0.3, M.bund, T.x, 0.6, z);
  // paralleling switchboard (the generator bus)
  const PS = {x: 5.0, z: -3.6};
  box(room, 1.0, 2.3, 9.0, M.swbd, PS.x, 1.15, PS.z);
  for (let i = 1; i < 10; i++) box(room, 0.012, 2.2, 0.012, M.grille, PS.x - 0.505, 1.15, PS.z - 4.5 + i * 0.9);
  // load bank (trailer-mounted)
  const LBp = {x: 5.6, z: 3.8};
  box(room, 2.4, 1.6, 1.4, M.lb, LBp.x, 1.2, LBp.z);
  box(room, 2.0, 0.04, 1.0, M.lbGlow, LBp.x, 2.02, LBp.z);
  box(room, 2.6, 0.3, 1.5, M.bund, LBp.x, 0.25, LBp.z);
  // the building: a slab and low cut-away walls
  const B = {x0: 8.0, x1: 19.0, z0: 3.0, z1: -10.2};
  box(room, B.x1 - B.x0, 0.08, B.z0 - B.z1, M.slab, (B.x0 + B.x1) / 2, 0.04, (B.z0 + B.z1) / 2);
  box(room, B.x1 - B.x0, 0.6, 0.2, M.wall, (B.x0 + B.x1) / 2, 0.3, B.z1);
  box(room, 0.2, 0.6, B.z0 - B.z1, M.wall, B.x0, 0.3, (B.z0 + B.z1) / 2);
  box(room, 0.2, 0.6, B.z0 - B.z1, M.wall, B.x1, 0.3, (B.z0 + B.z1) / 2);
  // grid intake and transformer
  const GK = {x: 10.0, z: 6.0};
  box(room, 1.3, 1.5, 0.9, M.kiosk, GK.x, 0.75, GK.z);
  const TX = {x: 10.0, z: 1.6};
  box(room, 1.6, 1.7, 1.1, M.tx, TX.x, 0.85, TX.z);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) box(room, 0.03, 1.3, 0.3, M.tx, TX.x - 0.6 + i * 0.24, 0.8, TX.z + s * 0.7);
  // main switchboard with the automatic transfer
  const MSB = {x: 10.0, z: -3.6};
  box(room, 0.9, 2.2, 4.4, M.swbd, MSB.x, 1.1, MSB.z);
  for (let i = 1; i < 6; i++) box(room, 0.012, 2.1, 0.012, M.grille, MSB.x + 0.455, 1.1, MSB.z - 2.2 + i * 0.73);
  // UPS with batteries
  const UPS = {x: 12.6, z: -3.6};
  box(room, 1.0, 2.0, 3.6, M.ups, UPS.x, 1.0, UPS.z);
  box(room, 0.02, 0.06, 3.4, M.upsStat, UPS.x + 0.51, 1.85, UPS.z);
  // racks: two rows along z
  const RZ = [];
  for (let i = 0; i < 10; i++) RZ.push(-8.7 + i * 0.64);
  const ledGeo = new THREE.BoxGeometry(0.01, 0.012, 0.4);
  for (const rx of [15.0, 17.2])
    for (const z of RZ) {
      box(room, 1.0, 2.0, 0.6, M.rack, rx, 1.0, z);
      const fx = rx < 16 ? rx + 0.505 : rx - 0.505;
      for (let j = 0; j < 6; j++) {
        const l = new THREE.Mesh(ledGeo, M.led);
        l.position.set(fx, 0.4 + j * 0.27, z);
        room.add(l);
      }
    }

  // ------------------------------------------------------------ routes
  const flows = {};
  const path = (key, pts, col, r = 0.06) => {
    const curve = new THREE.CurvePath();
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new V3(...pts[i]);
      const b = new V3(...pts[i + 1]);
      curve.add(new THREE.LineCurve3(a, b));
      len += a.distanceTo(b);
    }
    const mat = new THREE.ShaderMaterial({
      vertexShader: FLOW_VERT,
      fragmentShader: FLOW_FRAG,
      uniforms: {uTime: {value: 0}, uLive: {value: 0}, uFlow: {value: 0}, uLen: {value: len}, uCol: {value: new THREE.Color(col)}, uOff: {value: new THREE.Color(COL.dead)}},
    });
    room.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, Math.round(len * 6)), r, 8, false), mat));
    flows[key] = {mat, phase: 0};
  };
  const y = 0.1;
  SET_Z.forEach((z, i) => path(`g${i}`, [[2.95, y, z + 0.5], [PS.x - 0.5, y, z + 0.5]], COL.gen, 0.08));
  SET_Z.forEach((z, i) => path(`f${i}`, [[T.x + 1.1, y, z - 0.3], [-3.7, y, z - 0.3]], COL.fuel, 0.04));
  path('lb', [[PS.x, y, PS.z + 4.5], [PS.x, y, LBp.z - 0.7]], COL.gen, 0.08);
  path('gm', [[PS.x + 0.5, y, MSB.z], [MSB.x - 0.45, y, MSB.z]], COL.gen, 0.1);
  path('ut', [[GK.x, y, GK.z - 0.45], [TX.x, y, TX.z + 0.55]], COL.util, 0.08);
  path('um', [[TX.x, y, TX.z - 0.55], [MSB.x, y, MSB.z + 2.2]], COL.util, 0.1);
  path('mu', [[MSB.x + 0.45, y, MSB.z], [UPS.x - 0.5, y, UPS.z]], COL.it, 0.1);
  path('ui', [[UPS.x, 2.0, UPS.z], [UPS.x, 2.4, UPS.z], [16.1, 2.4, UPS.z], [16.1, 2.4, -8.9], [16.1, 2.4, -2.5]], COL.it, 0.06);

  let lastT = 0;
  const update = (s, e, k, t) => {
    const kk = smoother(k);
    room.visible = kk > 0.002;
    room.position.y = -(1 - kk) * 4.4;
    others.forEach((g, i) => {
      g.root.visible = kk > 0.002;
      g.root.position.y = -(1 - kk) * 4.4;
      g.update({...s, crank: (s.crank ?? 0) + 0.7 * (i + 1), explode: 0, xray: 0, hl: ''});
    });
    const dt = Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    const set = (key, live, flow, col) => {
      const f = flows[key];
      f.phase += dt * flow * 1.4;
      f.mat.uniforms.uTime.value = f.phase;
      f.mat.uniforms.uLive.value = live ? 1 : 0;
      f.mat.uniforms.uFlow.value = flow;
      if (col) f.mat.uniforms.uCol.value.set(col);
    };
    const fl = (kw) => (kw > 2 ? 0.6 + kw / 900 : 0);
    for (let i = 0; i < 3; i++) {
      set(`g${i}`, e.gen, e.genBus ? fl(s.P) : 0);
      set(`f${i}`, s.fuel, s.fuel ? 0.4 + s.fuelRate / 300 : 0);
    }
    set('lb', e.lb, e.lb ? fl(s.P * 3) : 0);
    set('gm', e.genBus && s.Mb > 0.5, e.genBus && s.Mb > 0.5 ? fl(s.P * 3) : 0);
    set('ut', s.util, e.utilOn ? 2.4 : 0);
    set('um', e.utilOn, e.utilOn ? 2.4 : 0);
    set('mu', e.msb, e.msb ? 2.4 : 0);
    set('ui', true, 2.0, e.msb ? COL.it : COL.bat);
    M.upsStat.emissive.set(e.msb ? COL.it : COL.bat);
    M.lbGlow.emissiveIntensity = e.lb ? (s.P / 1500) * 1.6 : 0;
    M.led.emissiveIntensity = 1.1 + 0.5 * Math.sin(t * 9.3) * Math.sin(t * 3.1);
  };
  return {root, update, T, PS, LBp, GK, TX, MSB, UPS};
}
