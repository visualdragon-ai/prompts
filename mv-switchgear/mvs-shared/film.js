// The tour: a SCRIPT of operator moves (sequences, views, take-apart toggles) and everything as a pure function of
// film time t: the camera, the display toggles, the room rising, the operator's cursor and the labels. The live page
// plays it as its auto tour; run() records it as a film.
import {runSim} from 'teardown-kit/runtime.js';
import {createConsole, DISPLAY} from './console.js';
import {SEQ, stateAt} from './model.js';
import {createStage} from './stage.js';

export const SCRIPT = [
  {t: 0, seq: 'normal', view: 'hero'},
  {t: 2.2, display: 'labels', on: 1},
  {t: 6.0, view: 'side'},
  {t: 6.6, display: 'section', on: 1},
  {t: 10.4, view: 'breaker'},
  {t: 10.9, display: 'xray', on: 1},
  {t: 11.6, display: 'labels', on: 0},
  {t: 12.2, seq: 'fault'},
  {t: 20.6, display: 'labels', on: 1},
  {t: 21.4, view: 'hall'},
  {t: 22.4, seq: 'gridA'},
  {t: 33.0, view: 'side'},
  {t: 33.5, display: 'xray', on: 0},
  {t: 34.0, seq: 'isolate'},
  {t: 43.5, view: 'hero'},
  {t: 47.4, display: 'section', on: 0},
  {t: 48.0, display: 'exploded', on: 1},
  {t: 52.5, display: 'exploded', on: 0},
  {t: 53.2, display: 'orbit', on: 1},
  {t: 53.6, seq: 'normal'},
];
export const DURATION = 58;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'mvs', subtitle: ''}, director: {enabled: false}, watermark: ''};
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
  hero: (u) => ({tx: 0, ty: 1.1, tz: 0.05, az: 36 + 2 * u, el: 13, d: 6.6, sx: 0, sy: -30}),
  front: (u) => ({tx: 0, ty: 1.12, tz: 0, az: 2 + 1.2 * u, el: 5, d: 6.4, sx: 0, sy: -30}),
  side: (u) => ({tx: 0, ty: 1.1, tz: 0, az: 90 + 1.2 * u, el: 6, d: 6.0, sx: 0, sy: -30}),
  breaker: (u) => ({tx: 0.05, ty: 1.2, tz: 0.4, az: 58 + 2 * u, el: 9, d: 2.9, sx: 0, sy: -24}),
  cables: (u) => ({tx: 0.02, ty: 0.85, tz: -0.3, az: 116 + 2 * u, el: 11, d: 4.4, sx: 0, sy: -26}),
  hall: (u) => ({tx: -1.3, ty: 0.2, tz: -5.0, az: 34 + 0.6 * u, el: 36, d: 30, sx: 0, sy: -30}),
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
    const target = v === 'hall' ? 1 : 0;
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
const PARTS = [
  {name: 'PROTECTION RELAY', sub: 'SEES A FAULT, TRIPS THE BREAKER', at: (s, k) => add([-0.15, 2.0, 0.78], [0, 0.55, 0.25], k)},
  {name: 'PRESSURE-RELIEF FLAPS', sub: 'VENT AN INTERNAL ARC UPWARD', at: (s, k) => add([0, 2.26, -0.4], [0, 0.75, -0.1], k)},
  {name: 'MAIN BUSBARS', sub: 'COPPER, RUN THE WHOLE LINEUP', at: () => [0.3, 1.95, -0.3]},
  {name: 'SPOUTS + SHUTTERS', sub: 'SHUTTERS COVER THE LIVE CONTACTS', at: () => [-0.21, 1.43, 0.25]},
  {name: 'VACUUM CIRCUIT BREAKER', sub: 'MAKES AND BREAKS UP TO 25 kA', at: (s, k) => [0.21, 1.5, 0.4 + s.rack * 0.2 + k]},
  {name: 'VACUUM INTERRUPTER', sub: 'CONTACTS PART 11 MM IN VACUUM', at: (s, k) => [0, 1.24, 0.4 + s.rack * 0.2 + k]},
  {name: 'OPERATING MECHANISM', sub: 'STORED SPRINGS, OPENS IN 30 MS', at: (s, k) => [-0.2, 1.05, 0.71 + s.rack * 0.2 + k]},
  {name: 'WITHDRAWABLE TRUCK', sub: 'RACKS 200 MM: SERVICE ↔ TEST', at: (s, k) => [-0.25, 0.77, 0.62 + s.rack * 0.2 + k]},
  {name: 'CURRENT TRANSFORMERS', sub: 'MEASURE CURRENT FOR THE RELAY', at: () => [0.21, 0.98, -0.21]},
  {name: 'EARTHING SWITCH', sub: 'EARTHS THE CABLE FOR WORK', at: () => [0.255, 0.45, -0.56]},
  {name: 'CABLE TERMINATIONS', sub: '11 kV CABLE TO TRANSFORMER T2', at: () => [0, 0.47, -0.44]},
];
const HALL_PARTS = [
  {name: 'GRID A', sub: 'UTILITY SUPPLY, 11 kV', at: (y) => [-6.0, 1.6 + y, 0.1]},
  {name: 'GRID B', sub: 'SECOND, INDEPENDENT SUPPLY', at: (y) => [3.4, 1.6 + y, 0.1]},
  {name: 'MV SWITCHGEAR LINEUP', sub: 'INCOMER · FEEDER · TIE · FEEDER · INCOMER', at: () => [-1.6, 2.26, 0.2]},
  {name: 'THIS PANEL · FEEDER T2', sub: 'THE ONE YOU TOOK APART', at: () => [0, 2.26, 0.5]},
  {name: 'TRANSFORMERS T1 / T2', sub: '11 kV → 415 V · 2.5 MVA', at: (y) => [-3.0, 1.9 + y, -3.5]},
  {name: 'LV SWITCHBOARDS', sub: '415 V DISTRIBUTION', at: (y) => [1.4, 2.1 + y, -5.2]},
  {name: 'UPS + BATTERIES', sub: 'BRIDGE ANY GAP IN SUPPLY', at: (y) => [-3.0, 2.05 + y, -6.8]},
  {name: 'IT RACKS', sub: 'EVERY RACK FED FROM A AND B', at: (y) => [-1.0, 2.0 + y, -10.4]},
];
export function makeLabels(st) {
  return (s, o, hall) => {
    if (o < 0.02) return [];
    const k = smoother(s.explode ?? 0);
    const y = -(1 - smoother(hall)) * 2.9;
    const list = hall > 0.5 ? HALL_PARTS.map((p) => ({p, q: p.at(y)})) : PARTS.map((p) => ({p, q: p.at(s, k)}));
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
    stack(L, 340, 240);
    stack(R, 1030, 240);
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
        st.frame({...s, t, explode, xray: easedDisplay('xray', t), section: easedDisplay('section', t, 1.2), hall}, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        const [vt0, view] = viewAt(t);
        frame(t, {s: {...s, explode}, seq, tau, view, display: disp, hall, labels: easedDisplay('labels', t, 0.5) * ss(vt0 + 1.2, vt0 + 1.8, t), cursor: cursorAt(t)});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
