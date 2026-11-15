// The tour: a SCRIPT of operator moves (sequences, views, take-apart toggles) and everything as a pure function of
// film time t: the camera, the display toggles, the site rising, the operator's cursor and the labels. The live page
// plays it as its auto tour; run() records it as a film.
import {runSim} from 'teardown-kit/runtime.js';
import {createConsole, DISPLAY} from './console.js';
import {crankAt, E, SEQ, stateAt} from './model.js';
import {createStage} from './stage.js';

export const SCRIPT = [
  {t: 0, seq: 'standby', view: 'hero'},
  {t: 2.2, display: 'labels', on: 1},
  {t: 5.0, display: 'xray', on: 1},
  {t: 5.6, seq: 'outage'},
  {t: 6.0, view: 'engine'},
  {t: 9.6, view: 'end'},
  {t: 13.5, view: 'alternator'},
  {t: 17.6, view: 'site'},
  {t: 27.8, seq: 'restore'},
  {t: 34.0, view: 'side'},
  {t: 34.5, display: 'xray', on: 0},
  {t: 35.0, display: 'section', on: 1},
  {t: 43.0, display: 'section', on: 0},
  {t: 43.4, view: 'hero'},
  {t: 43.8, display: 'exploded', on: 1},
  {t: 48.8, display: 'exploded', on: 0},
  {t: 49.4, seq: 'test'},
  {t: 50.2, display: 'orbit', on: 1},
];
export const DURATION = 66;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'genset', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ sequence and toggles at film time t
export const seqAt = (t) => {
  const e = SCRIPT.filter((x) => x.seq && x.t <= t).pop();
  return {seq: e.seq, tau: Math.min(SEQ[e.seq].dur, t - e.t)};
};
export const displayAt = (t) => {
  const out = Object.fromEntries(DISPLAY.map((k) => [k, 0]));
  for (const e of SCRIPT) if (e.display && e.t <= t) out[e.display] = e.on;
  return out;
};
const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -9;
export const easedDisplay = (key, t, dur = 0.8) => {
  const on = displayAt(t)[key];
  const k = ss(lastFlip(key, t), lastFlip(key, t) + dur, t);
  return on ? k : 1 - k;
};

// ------------------------------------------------------------ views, u = seconds on the view
export const VIEW_FN = {
  hero: (u) => ({tx: -0.4, ty: 1.5, tz: 0, az: 32 + 1.6 * u, el: 16, d: 15.5, sx: 0, sy: -30}),
  side: (u) => ({tx: -0.35, ty: 1.45, tz: 0, az: 2 + 1.0 * u, el: 7, d: 12.5, sx: 0, sy: -30}),
  end: (u) => ({tx: -1.0, ty: 1.5, tz: 0, az: 268 + 1.5 * u, el: 12, d: 9.5, sx: 0, sy: -30}),
  engine: (u) => ({tx: -1.0, ty: 1.45, tz: 0, az: -28 + 2 * u, el: 26, d: 9, sx: 0, sy: -26}),
  alternator: (u) => ({tx: 1.2, ty: 1.15, tz: 0, az: 50 + 2 * u, el: 14, d: 7.8, sx: 0, sy: -26}),
  site: (u) => ({tx: 4.6, ty: 0, tz: -2.6, az: 26 + 0.5 * u, el: 38, d: 40, sx: 0, sy: -30}),
};
const VIEWS_AT = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
export const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + (((b.az - a.az + 540) % 360) - 180) * k : a[key] + (b[key] - a[key]) * k;
  return o;
};
export const viewAt = (t) => VIEWS_AT.filter(([a]) => a <= t).pop();
export const camAt = (t, orbit = 0) => {
  let i = 0;
  while (i < VIEWS_AT.length - 1 && VIEWS_AT[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS_AT[i][1]](t - VIEWS_AT[i][0]);
  let o = cur;
  if (i > 0) {
    const k = ss(VIEWS_AT[i][0], VIEWS_AT[i][0] + 1.8, t);
    if (k < 1) o = blend(VIEW_FN[VIEWS_AT[i - 1][1]](t - VIEWS_AT[i - 1][0]), cur, k);
  }
  if (orbit > 0) o = {...o, az: o.az + 12 * Math.max(0, t - lastFlip('orbit', t)) * orbit};
  return o;
};
// how far the data hall has risen: follows the hall view in and out
export const hallAt = (t) => {
  let k = 0;
  for (let i = 0; i < VIEWS_AT.length; i++) {
    const [t0, v] = VIEWS_AT[i];
    if (t0 > t) break;
    const was = k;
    const target = v === 'site' ? 1 : 0;
    k = was + (target - was) * ss(t0 + 0.2, t0 + 1.8, t);
  }
  return k;
};

// ------------------------------------------------------------ the operator's pointer
const REST = [[860, 450], [760, 400], [940, 500], [820, 360]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).flatMap((e) => {
    const out = [];
    if (e.seq) out.push({t: e.t, spot: ui.spots[e.seq]});
    if (e.view) out.push({t: e.t + (e.seq ? 0.35 : 0), spot: ui.spots[e.view]});
    if (e.display) out.push({t: e.t, spot: ui.spots[e.display]});
    return out;
  });
  const WP = [[0, 900, 600]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot], [e.t + 0.22, ...e.spot]);
    WP.push([e.t + 1.4, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ labels
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const yC = E.yC;
const dB = [0, Math.cos(E.bank), Math.sin(E.bank)];
const PARTS = [
  {name: 'EXHAUST SILENCER', sub: 'CUTS EXHAUST NOISE AT THE ROOF', at: (k) => add([-1.0, 3.5, 0.36], [0, 6.2, 0], k)},
  {name: 'RADIATOR + FAN', sub: 'COOLS THE ENGINE, FAN DRIVEN OFF THE CRANK', at: (k) => add([-3.12, 2.2, 0.7], [-1.1, 0, 0], k)},
  {name: 'TURBOCHARGERS', sub: 'EXHAUST SPINS THEM, THEY PACK IN AIR', at: (k) => add([-2.44, 1.86, 0.5], [-0.5, 0.9, 0], k)},
  {name: 'AFTERCOOLER', sub: 'COOLS THE CHARGE AIR', at: (k) => add([-1.2, yC + 0.69, 0], [0, 0.55, 0], k)},
  {name: 'CYLINDER HEADS', sub: '16 HEADS, ONE PER CYLINDER', at: (k) => add([-0.4, yC + dB[1] * (E.deck + 0.2), dB[2] * (E.deck + 0.2)], dB.map((v) => v * 0.55), k)},
  {name: 'PISTONS + CON RODS', sub: 'BORE 159 MM, STROKE 190 MM', at: () => [-0.85, yC + 0.4, 0.22]},
  {name: 'CRANKSHAFT', sub: '8 THROWS, TWO RODS ON EACH', at: () => [-1.6, yC, 0.1]},
  {name: 'FLYWHEEL + STARTERS', sub: 'TWO 24 V STARTERS CRANK IT', at: (k) => add([-0.25, 0.64, 0.5], [0, -0.2, 0], k)},
  {name: 'BELLY FUEL TANK', sub: '3,300 L: ABOUT 12 H AT HALF LOAD', at: () => [-1.8, 0.2, 0.95]},
  {name: 'START BATTERIES', sub: '24 V, KEPT ON CHARGE', at: (k) => add([-0.68, 0.6, 1.08], [0, 0, 0.8], k)},
  {name: 'CONTROLLER', sub: 'STARTS ON GRID FAILURE, SYNCHRONISES', at: (k) => add([1.0, 1.75, 1.15], [0, 0, 0.9], k)},
  {name: 'TERMINAL BOX', sub: 'OUTPUT CABLES, 3,478 A AT 415 V', at: (k) => add([1.3, yC + 1.15, 0.36], [1.3, 0.7, 0], k)},
  {name: 'ALTERNATOR STATOR', sub: 'WHERE THE POWER IS MADE', at: (k) => add([0.8, yC + 0.62, 0.25], [1.3, 0, 0], k)},
  {name: 'ROTOR', sub: '4 POLES × 1500 RPM = 50 HZ', at: (k) => add([1.4, yC + 0.42, 0.12], [2.6, 0, 0], k)},
  {name: 'EXCITER', sub: 'BRUSHLESS, FED BY THE AVR', at: (k) => add([2.2, yC + 0.3, 0.1], [3.1, 0, 0], k)},
];
const HALL_PARTS = [
  {name: 'THIS SET · G1', sub: '2,000 KWE STANDBY', at: () => [-0.3, 3.6, 1.0]},
  {name: 'GENERATOR YARD', sub: 'THREE SETS, N+1', at: (y) => [-0.3, 3.4 + y, -7.2]},
  {name: 'BULK FUEL TANK', sub: 'DAYS OF FUEL, PUMPED TO EACH SET', at: (y) => [-7.0, 2.8 + y, -3.6]},
  {name: 'PARALLELING SWITCHBOARD', sub: 'SYNCHRONISES THE SETS ONTO ONE BUS', at: (y) => [5.0, 2.4 + y, -5.5]},
  {name: 'LOAD BANK', sub: 'A DUMMY LOAD FOR THE MONTHLY TEST', at: (y) => [5.6, 2.1 + y, 3.8]},
  {name: 'GRID + TRANSFORMER', sub: 'THE NORMAL SUPPLY', at: (y) => [10.0, 1.8 + y, 1.6]},
  {name: 'MAIN SWITCHBOARD + ATS', sub: 'PICKS THE GRID OR THE GENERATORS', at: (y) => [10.0, 2.3 + y, -4.5]},
  {name: 'UPS', sub: 'BRIDGES THE 10 S START ON BATTERY', at: (y) => [12.6, 2.1 + y, -3.6]},
  {name: 'IT RACKS', sub: '3.2 MW THAT MUST NEVER STOP', at: (y) => [16.1, 2.1 + y, -7.0]},
];
export function makeLabels(st) {
  return (s, o, hall) => {
    if (o < 0.02) return [];
    const k = smoother(s.explode ?? 0);
    const y = -(1 - smoother(hall)) * 4.4;
    const list = hall > 0.5 ? HALL_PARTS.map((p) => ({p, q: p.at(y)})) : PARTS.map((p) => ({p, q: p.at(k)}));
    const pts = list
      .map(({p, q}) => ({p, at: st.project(...q)}))
      .filter((x) => x.at && x.at[0] > 360 && x.at[0] < 1240 && x.at[1] > 96 && x.at[1] < 740);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let yy = 100;
      for (const c of col) {
        yy = Math.max(yy, Math.min(712, c.at[1] - 12));
        out.push({name: c.p.name, sub: c.p.sub, at: c.at, label: [x, yy], w, o});
        yy += 36;
      }
    };
    stack(L, 340, 250);
    stack(R, 1020, 250);
    return out;
  };
}

export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (t, f) => {
    ui.update({
      s: f.s,
      seq: f.seq,
      tau: f.tau,
      view: f.view,
      display: f.display,
      paused: f.paused ?? false,
      callouts: labels(f.s, f.labels, f.hall),
      cursor: f.cursor,
      t,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    return {
      resize,
      render(t) {
        const {seq, tau} = seqAt(t);
        const s = stateAt(seq, tau);
        const disp = displayAt(t);
        const hall = hallAt(t);
        const cam = camAt(t, disp.orbit);
        const explode = easedDisplay('exploded', t, 1.0);
        st.frame({...s, t, crank: crankAt(seq, tau), explode, xray: easedDisplay('xray', t), section: easedDisplay('section', t, 1.2), hall}, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        const [vt0, view] = viewAt(t);
        frame(t, {s: {...s, explode}, seq, tau, view, display: disp, hall, labels: easedDisplay('labels', t, 0.5) * ss(vt0 + 1.2, vt0 + 1.8, t), cursor: cursorAt(t)});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
