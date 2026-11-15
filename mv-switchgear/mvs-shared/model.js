// The math. A typical 12 kV air-insulated, metal-clad switchgear panel (IEC 62271-200, LSC2B-PM) with a withdrawable
// vacuum circuit breaker, and the data-centre MV room it lives in: two grid incomers, a bus tie, two transformer
// feeders. Real dimensions in metres, real timings in milliseconds. Every pose, every gauge and the single-line diagram
// read from state(seq, tau): one input drives everything. No three.js in here.

// ------------------------------------------------------------ the panel, metres. Origin: floor, panel centre; +z is the front.
export const P = {
  W: 0.8, // panel width (1250 A class)
  H: 2.25, // height
  D: 1.5, // depth
  zF: 0.75, // front face
  zB: -0.75, // back face
  zWall: 0.09, // partition between the breaker compartment and the rear (busbar + cable) compartments
  yBrk: 0.7, // breaker compartment floor
  yTop: 1.72, // breaker compartment ceiling / LV compartment floor
  yBus: 1.25, // busbar compartment floor / cable compartment ceiling (behind the partition)
  zLV: 0.34, // LV compartment back wall
  phase: [-0.21, 0, 0.21], // pole pitch 210 mm
  ySpU: 1.43, // upper spouts (busbar side)
  ySpL: 0.98, // lower spouts (cable side)
  zSpout: 0.22, // spout mouth
  rack: 0.2, // racking travel service ↔ test, 200 mm
  stroke: 0.011, // vacuum interrupter contact stroke, 11 mm
  yGap: 1.24, // contact face height inside the interrupter
  barY: 1.95, // main busbar height
  barZ: [-0.12, -0.3, -0.48], // L1, L2, L3 main bars
};

export const RATING = {Ur: 12, Un: 11, Ir: 1250, Ik: 25, tk: 3, f: 50, pf: 0.95};

// ------------------------------------------------------------ the room. Panel order in the lineup; the hero panel is FEEDER T2.
export const LINEUP = [
  {key: 'incA', name: 'INCOMER A', sub: 'FROM GRID A'},
  {key: 'f1', name: 'FEEDER T1', sub: 'TO TRANSFORMER T1'},
  {key: 'tie', name: 'BUS TIE', sub: 'JOINS BUS A + B'},
  {key: 'f2', name: 'FEEDER T2', sub: 'TO TRANSFORMER T2'},
  {key: 'incB', name: 'INCOMER B', sub: 'FROM GRID B'},
];
export const HERO = 3;
export const IT_LOAD = 3.6; // MW of IT load, split over the A and B cords of every rack

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
// a breaker's contact travel: 1 closed, 0 open; moves over `d` seconds of sequence time
const opens = (t0, d, t) => 1 - ss(t0, t0 + d, t);
const closes = (t0, d, t) => ss(t0, t0 + d, t);

const BASE = () => ({
  grid: [1, 1],
  brk: [1, 1, 0, 1, 1],
  rack: 0, // hero truck: 0 service, 1 test
  earth: 0, // hero earthing switch: 0 open, 1 closed
  door: 0, // hero breaker door: 0 shut, 1 open
  fault: 0, // cable fault on feeder T2
  arc: 0, // arc inside the hero's vacuum interrupters
  trip: '', // protection relay flag
  hl: '', // the part doing the work now
});

// ------------------------------------------------------------ the four sequences, functions of tau (seconds into the sequence)
export const SEQ = {
  normal: {
    dur: 8,
    label: 'NORMAL',
    sub: 'BOTH GRIDS IN',
    clock: (t) => t * 1000,
    state: () => BASE(),
    phases: [
      [0, 'TWO GRID SUPPLIES, TIE OPEN'],
      [2, 'EACH FEEDER SUPPLIES ONE TRANSFORMER'],
      [4, 'UPS A AND UPS B SHARE THE IT LOAD'],
      [6, 'EVERY RACK HAS AN A AND A B CORD'],
    ],
  },
  gridA: {
    dur: 10,
    label: 'GRID A FAILS',
    sub: 'AUTO TRANSFER',
    clock: (t) => t * 1000,
    state: (t) => {
      const s = BASE();
      s.grid[0] = t < 1 ? 1 : 0;
      s.brk[0] = opens(1.6, 0.3, t);
      s.brk[2] = closes(3.4, 0.3, t);
      if (t > 1.3 && t < 2) s.trip = '27 UNDERVOLTAGE';
      if (t >= 2 && t < 3.4) s.trip = 'TRANSFER: BUS A DEAD';
      return s;
    },
    phases: [
      [0, 'NORMAL: BOTH GRIDS IN'],
      [1, 'GRID A LOST: BUS A DEAD'],
      [1.3, 'UPS A ON BATTERY, B CORDS CARRY THE RACKS'],
      [1.6, 'UNDERVOLTAGE RELAY OPENS INCOMER A'],
      [2.2, 'TRANSFER LOGIC CHECKS BUS A IS DEAD'],
      [3.4, 'BUS TIE CLOSES: GRID B FEEDS BOTH BUSES'],
      [4.4, 'T1 BACK ON, UPS A RETURNS TO MAINS'],
      [6.5, 'THE RACKS NEVER LOST POWER'],
    ],
  },
  fault: {
    dur: 9,
    label: 'CABLE FAULT',
    sub: 'BREAKER TRIPS',
    // 1 s of normal, then the 60 ms event at 1/50 speed over 3 s, then real time again
    clock: (t) => (t < 1 ? 0 : t < 4 ? (t - 1) * 20 : 60 + (t - 4) * 1000),
    slow: (t) => (t >= 1 && t < 4 ? 50 : 1),
    state: (t) => {
      const s = BASE();
      const ms = SEQ.fault.clock(t);
      const on = t >= 1;
      // fault at 0 ms; relay trips at 15 ms; contacts part at 45 ms; arc out at the current zero, 55 ms; open at 60 ms
      s.fault = on && ms < 55 ? 1 : 0;
      s.brk[HERO] = on ? 1 - Math.min(1, Math.max(0, (ms - 45) / 15)) : 1;
      s.arc = on && ms >= 45 && ms < 55 ? 1 : 0;
      if (on && ms >= 15) s.trip = ms < 2000 ? '50 OVERCURRENT TRIP' : '50 TRIP · LOCKED OUT';
      if (on && ms >= 15 && ms < 60) s.hl = 'breaker';
      if (on && ms < 15) s.hl = 'cable';
      return s;
    },
    phases: [
      [0, 'NORMAL: FEEDER T2 CARRIES 99 A'],
      [1, '0 MS: CABLE INSULATION FAILS, 21 kA FLOWS'],
      [1.75, '15 MS: RELAY SEES IT, TRIP COIL FIRES'],
      [3.25, '45 MS: CONTACTS PART, ARC BURNS IN VACUUM'],
      [3.75, '55 MS: CURRENT ZERO, ARC OUT, FAULT CLEARED'],
      [4.4, 'FEEDER T2 OPEN, REST OF THE ROOM UNTOUCHED'],
      [6, 'UPS B ON BATTERY, A CORDS CARRY THE RACKS'],
    ],
  },
  isolate: {
    dur: 13,
    label: 'ISOLATE & EARTH',
    sub: 'MAKE IT SAFE',
    clock: (t) => t * 1000,
    state: (t) => {
      const s = BASE();
      s.brk[HERO] = opens(0.6, 0.3, t);
      s.rack = ss(1.8, 4.8, t);
      s.earth = ss(6.2, 7.6, t);
      s.door = ss(9.2, 10.8, t);
      s.hl = t > 0.4 && t < 1.2 ? 'breaker' : t > 1.6 && t < 5.0 ? 'truck' : t > 5.0 && t < 6.1 ? 'shutter' : t > 6.1 && t < 8 ? 'earth' : '';
      return s;
    },
    phases: [
      [0, 'FEEDER T2 IN SERVICE'],
      [0.5, 'OPEN THE BREAKER'],
      [1.6, 'RACK THE TRUCK OUT 200 MM TO TEST'],
      [4.8, 'SHUTTERS DROP OVER THE LIVE SPOUTS'],
      [6, 'INTERLOCK RELEASED: CLOSE THE EARTHING SWITCH'],
      [8, 'CABLE EARTHED, BUSBARS STILL LIVE BEHIND THE SHUTTERS'],
      [9.2, 'ONLY NOW CAN THE DOOR OPEN'],
    ],
  },
};
export const SEQS = ['normal', 'gridA', 'fault', 'isolate'];
export const phaseAt = (seq, t) => SEQ[seq].phases.filter(([a]) => a <= t).pop()[1];

// ------------------------------------------------------------ the electrical solve: who is live, who carries what
const conducts = (travel, arc) => travel > 0.5 || arc > 0;
export function solve(s) {
  const c = s.brk.map((v, i) => conducts(v, i === HERO ? s.arc : 0));
  let busA = !!(s.grid[0] && c[0]);
  let busB = !!(s.grid[1] && c[4]);
  if (c[2]) busA = busB = busA || busB;
  const t1 = busA && c[1];
  const t2 = busB && c[3] && !s.fault;
  // dual-corded racks: the IT load moves to whichever side still has mains; the UPS rides through the gap on battery
  const loadA = t1 ? (t2 ? IT_LOAD / 2 : IT_LOAD) : 0;
  const loadB = t2 ? (t1 ? IT_LOAD / 2 : IT_LOAD) : 0;
  const amps = (mw) => (mw * 1e6) / (Math.sqrt(3) * RATING.Un * 1e3 * RATING.pf);
  const I = [0, amps(loadA), 0, amps(loadB), 0];
  const faultI = s.fault && busB && c[3] ? 21300 : 0;
  if (faultI) I[HERO] = faultI;
  // incomers: each carries its own bus; with the tie closed the live one carries both
  const aLive = s.grid[0] && c[0];
  const bLive = s.grid[1] && c[4];
  const sumA = I[1];
  const sumB = I[3];
  if (c[2]) {
    if (aLive && bLive) I[0] = I[4] = (sumA + sumB) / 2;
    else if (aLive) I[0] = sumA + sumB;
    else if (bLive) I[4] = sumA + sumB;
    I[2] = aLive && !bLive ? sumB : bLive && !aLive ? sumA : Math.abs(sumA - sumB) / 2;
  } else {
    I[0] = aLive ? sumA : 0;
    I[4] = bLive ? sumB : 0;
  }
  const vA = busA ? RATING.Un : 0;
  const vB = busB ? (s.fault && c[3] ? RATING.Un * 0.18 : RATING.Un) : 0;
  return {
    c,
    busA,
    busB,
    t1,
    t2,
    loadA,
    loadB,
    I,
    vA: c[2] && s.fault && busA ? vB : vA,
    vB,
    upsA: t1 ? 'MAINS' : 'BATTERY',
    upsB: t2 ? 'MAINS' : 'BATTERY',
    racks: 1, // dual cords + UPS: the IT load never drops in any of these sequences
    gap: (1 - s.brk[HERO]) * P.stroke * 1000,
  };
}

export const stateAt = (seq, tau) => {
  const S = SEQ[seq];
  const s = S.state(Math.min(S.dur, Math.max(0, tau)));
  return {...s, e: solve(s), ms: S.clock(tau), slow: S.slow ? S.slow(tau) : 1};
};

// the hero breaker's position words: [title, sub, colour key]
export const heroWords = (s) => {
  const b = s.brk[HERO];
  const pos = s.rack < 0.01 ? 'IN SERVICE' : s.rack > 0.99 ? 'IN TEST POSITION' : 'RACKING';
  if (s.arc) return ['Interrupting', 'ARC BURNING IN VACUUM', 'fault'];
  if (s.fault) return ['Fault on the cable', '21.3 kA THROUGH THE BREAKER', 'fault'];
  if (b > 0.999) return ['Breaker closed', pos, 'ok'];
  if (b < 0.001) return [s.earth > 0.99 ? 'Open, racked out, earthed' : 'Breaker open', s.earth > 0.99 ? 'SAFE TO WORK ON THE CABLE' : pos, s.earth > 0.99 ? 'safe' : 'open'];
  return ['Contacts moving', pos, 'move'];
};
