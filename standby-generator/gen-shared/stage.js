// The stage: a pale, cool studio on a paving grid, soft sun shadows, an environment for the metal. frame(state, cam)
// poses the hero set and the site around it and draws one frame.
import * as THREE from 'three';
import {buildGenset, SECTION_PLANE} from './genset.js';
import {buildSite} from './site.js';

const V3 = THREE.Vector3;
export const BG = '#eceeec';
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e4e6e3';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#cfd3d0';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 253);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(200 / 1.2, 200 / 1.2);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 50, 110);
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 200);

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e6e9e8');
    const panel = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.97, 0.99, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(12, 12, new V3(0, 14, 2), 2.2);
    panel(3, 14, new V3(-12, 4, 6), 2.6);
    panel(3, 14, new V3(12, 4, -4), 1.8);
    panel(18, 2, new V3(0, 2, 14), 1.4);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c9ccca', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.9;
    pm.dispose();
  }
  const SUN_DIR = new V3(0.45, 0.85, 0.55).normalize();
  const sun = new THREE.DirectionalLight('#fffaf2', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.003;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9cdca', 0.75));
  // a soft fill from the front so the panel face never goes flat grey
  const fill = new THREE.DirectionalLight('#eef4ff', 0.6);
  fill.position.set(-3, 2, 6);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({map: floorTexture(), roughness: 0.9}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const hero = buildGenset({clip: true, label: 'G1'});
  scene.add(hero.root);
  const hall = buildSite();
  scene.add(hall.root);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  let lastExt = 0;
  // st: model state + {explode, xray, section, hall, t}; cam: {tx, ty, tz, az, el (radians), d, sx, sy}
  const frame = (st0, cam0) => {
    // the room view shows the panel whole; the exploded view pulls the camera back to fit the parts
    const hk = smoother(st0.hall ?? 0);
    const st = {...st0, section: (st0.section ?? 0) * (1 - hk), xray: (st0.xray ?? 0) * (1 - hk)};
    const cam = {...cam0, d: cam0.d * (1 + 0.55 * smoother(st0.explode ?? 0))};
    const sec = smoother(st.section ?? 0);
    SECTION_PLANE.constant = sec < 0.001 ? 10 : 1.4 - 1.4 * sec;
    hero.update(st);
    hall.update(st, st.e, st.hall ?? 0, st.t ?? 0);
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    // the shadow box grows with the room
    const ext = 5.5 + 13 * smoother(st.hall ?? 0);
    if (Math.abs(ext - lastExt) > 1e-3) {
      Object.assign(sun.shadow.camera, {left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 80});
      sun.shadow.camera.updateProjectionMatrix();
      lastExt = ext;
    }
    const c = new V3(cam.tx, 0, cam.tz).multiplyScalar(smoother(st.hall ?? 0));
    sun.target.position.copy(c);
    sun.position.copy(c).addScaledVector(SUN_DIR, 30);
    sun.target.updateMatrixWorld();
    renderer.render(scene, camera);
  };
  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({shadow}) => {
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  return {renderer, scene, camera, hero, hall, resize, frame, project, size, setQuality};
}
