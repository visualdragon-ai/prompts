// The math. A typical data-centre standby generator set: a 60-litre V16 diesel (bore 159 mm, stroke 190 mm) at
// 1500 rpm driving a 4-pole brushless alternator, 2,500 kVA / 2,000 kWe at 415 V, 50 Hz, in an acoustic enclosure on a
// belly fuel tank. Three of them (N+1) back up a 3.2 MW data hall through a paralleling switchboard and an automatic
// transfer. Every pose, gauge and diagram reads from stateAt(seq, tau): one input drives everything. No three.js here.

export const R = {kVA: 2500, kWe: 2000, V: 415, f: 50, rpm: 1500, poles: 4, cyl: 16, bore: 0.159, stroke: 0.19, rod: 0.36, pf: 0.8};
R.disp = ((R.cyl * Math.PI) / 4) * R.bore * R.bore * R.stroke * 1000; // litres, ≈ 60.4

// ------------------------------------------------------------ engine geometry, metres. x along the crankshaft (radiator at -x)
export const E = {
  yC: 1.05, // crankshaft axis height above the enclosure floor
  r: R.stroke / 2, // crank radius
  l: R.rod, // con-rod length, centre to centre
  bank: 30 * (Math.PI / 180), // 60° vee: each bank ±30° from vertical
  throwX: Array.from({length: 8}, (_, k) => -1.9 + 0.24 * k),
  dx: 0.045, // A and B rods side by side on one crankpin
  phi: [0, 180, 90, 270, 270, 90, 180, 0].map((d) => (d * Math.PI) / 180), // crankpin angles
  pistonR: R.bore / 2,
  deck: R.rod + R.stroke / 2 + 0.127, // cylinder head face, from the crank axis
};
// piston-pin distance from the crank axis along its bank, for crank angle alpha measured from the bank axis
export const pinDist = (alpha) => E.r * Math.cos(alpha) + Math.sqrt(E.l * E.l - E.r * E.r * Math.sin(alpha) * Math.sin(alpha));
// the 16 cylinders: bank A leans to -z, bank B to +z; each fires once per 720°
export const CYL = [];
for (let k = 0; k < 8; k++)
  for (const [b, beta] of [[0, -E.bank], [1, E.bank]]) CYL.push({k, b, beta, x: E.throwX[k] + (b ? E.dx : -E.dx), offset: (k < 4) === (b === 0) ? 0 : 360});

// the visual crank runs 20× slower than the real engine so the pistons can be followed (1500 rpm → 75 rpm on screen)
export const SLOW = 20;
export const SITE_LOAD = 3200; // kW of IT load
export const SETS = 3;
export const SHARE = SITE_LOAD / SETS; // each running set's share

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoother = (x) => {
  const u = clamp01(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
// the governor's response to a load step: a dip that peaks ~0.6 s after the step and recovers in ~3 s
const dip = (t, t0) => {
  const x = (t - t0) / 0.6;
  return x <= 0 ? 0 : x * Math.exp(1 - x);
};

const BASE = () => ({
  n: 0, // engine speed, real rpm
  starter: 0, // starter pinion engaged 0..1
  fuel: 0, // injection on
  V: 0,
  P: 0, // kW this set delivers
  util: 1, // utility supply live
  Ub: 1, // utility main breaker 0..1
  Gb: 0, // generator breaker onto the generator bus
  Mb: 0, // generator bus → main switchboard
  LB: 0, // load-bank breaker
  cool: 40, // coolant °C, kept warm by the block heater
  exh: 25,
  smoke: 0,
  hl: '',
  trip: '',
});
// engine speed after the start: crank at 180 rpm, fire, run up to 1500 with a small overshoot
const runUp = (t, t0) => {
  if (t < t0) return 0;
  if (t < t0 + 0.5) return 180 * ss(t0, t0 + 0.5, t);
  if (t < t0 + 1.0) return 180;
  return 180 + 1320 * ss(t0 + 1.0, t0 + 6.2, t) + 28 * Math.sin(Math.PI * clamp01((t - t0 - 5.8) / 1.4));
};
const derived = (s) => {
  s.oil = s.n > 60 ? 0.6 + 3.9 * clamp01(s.n / 1500) : 0;
  s.turbo = s.n > 60 && s.fuel ? 9 + 26 * (s.n / 1500) + 32 * (s.P / R.kWe) : s.n > 0 ? 4 * (s.n / 1500) : 0;
  s.batt = 27.2 - 8.6 * s.starter + (s.fuel && s.n > 900 ? 0.9 : 0);
  s.fuelRate = s.fuel ? 22 + 0.245 * s.P : 0; // L/h, ≈ 0.25 L per kWh plus idle
  s.f = (s.n * R.poles) / 120;
  return s;
};

// ------------------------------------------------------------ the four sequences, functions of tau (seconds into the sequence)
export const SEQ = {
  standby: {
    dur: 8,
    label: 'STANDBY',
    sub: 'GRID ON, SET READY',
    clock: (t) => t,
    state: () => BASE(),
    phases: [
      [0, 'GRID FEEDS THE DATA HALL'],
      [2, 'BLOCK HEATER HOLDS THE COOLANT AT 40 °C'],
      [4, 'CHARGER HOLDS THE START BATTERIES AT 27 V'],
      [6, 'CONTROLLER IN AUTO, WATCHING THE GRID'],
    ],
  },
  outage: {
    dur: 22,
    label: 'GRID FAILS',
    sub: 'START & TAKE LOAD',
    clock: (t) => t,
    state: (t) => {
      const s = BASE();
      s.util = t < 0.5 ? 1 : 0;
      s.Ub = 1 - ss(0.6, 0.8, t);
      s.starter = ss(1.5, 1.7, t) * (1 - ss(3.0, 3.2, t));
      s.fuel = t > 2.6 ? 1 : 0;
      s.P = SHARE * ss(9.5, 12.5, t);
      s.n = runUp(t, 1.6) - 42 * dip(t, 9.6) * (t > 9.5 ? 1 : 0);
      s.V = R.V * ss(5.0, 8.0, t) - 26 * dip(t, 9.6);
      s.Gb = ss(9.0, 9.15, t);
      s.Mb = ss(9.25, 9.4, t);
      s.cool = 40 + 8 * ss(3, 22, t);
      s.exh = 25 + 190 * ss(2.6, 6, t) + 240 * ss(9.5, 16, t);
      s.smoke = Math.max(ss(2.6, 2.9, t) * (1 - ss(3.6, 5.0, t)), 0.6 * ss(9.6, 9.9, t) * (1 - ss(10.6, 12, t)));
      s.hl = t > 1.5 && t < 3.2 ? 'starter' : t > 2.6 && t < 8 ? 'engine' : t > 8 && t < 9.5 ? 'alt' : '';
      return derived(s);
    },
    phases: [
      [0, 'NORMAL: GRID FEEDS THE HALL'],
      [0.5, 'GRID LOST: UPS BATTERIES CARRY THE RACKS'],
      [0.6, 'UTILITY MAIN BREAKER OPENS'],
      [1.5, 'CONTROLLER CONFIRMS THE OUTAGE, CRANKS ALL 3 SETS'],
      [2.6, 'FUEL ON: IT FIRES AT 180 RPM'],
      [3.1, 'STARTERS DROP OUT, RUNNING UP TO 1500 RPM'],
      [8.0, 'READY: 415 V, 50 HZ IN UNDER 10 S'],
      [9.0, 'SETS SYNCHRONISE AND CLOSE ON THE GENERATOR BUS'],
      [9.5, 'UPS WALKS THE LOAD ON OVER 3 S'],
      [12.5, 'EACH SET CARRIES 1,067 KW, UPS RECHARGING'],
      [16, 'THE RACKS NEVER LOST POWER'],
    ],
  },
  restore: {
    dur: 18,
    label: 'GRID RETURNS',
    sub: 'HAND BACK & STOP',
    // real time: the 5-minute stability wait and the 5-minute cool-down run 100× faster
    clock: (t) => (t < 1.5 ? t : t < 4.5 ? 1.5 + (t - 1.5) * 100 : t < 6 ? 301.5 + (t - 4.5) : t < 11 ? 303 + (t - 6) * 60 : 603 + (t - 11)),
    fast: (t) => (t >= 1.5 && t < 4.5 ? 100 : t >= 6 && t < 11 ? 60 : 1),
    state: (t) => {
      const s = BASE();
      s.util = t >= 0.5 ? 1 : 0;
      s.Ub = ss(4.5, 4.6, t);
      s.Mb = 1 - ss(4.9, 5.0, t);
      s.Gb = 1 - ss(5.6, 5.7, t);
      s.P = SHARE * (1 - ss(4.5, 4.95, t));
      s.fuel = t < 11.5 ? 1 : 0;
      s.n = t < 11.5 ? 1500 + 22 * dip(t, 4.9) : 1500 * Math.pow(1 - ss(11.5, 15.5, t), 1.3);
      s.V = R.V * (1 - ss(11.5, 12.3, t)) + 14 * dip(t, 4.9);
      s.cool = 48 - 3 * ss(6, 16, t);
      s.exh = 25 + 190 * (1 - ss(11.5, 17, t)) + 240 * (1 - ss(5, 10, t));
      s.hl = t > 4.4 && t < 5.8 ? 'alt' : t > 11.5 && t < 15 ? 'engine' : '';
      return derived(s);
    },
    phases: [
      [0, 'SETS CARRYING THE HALL'],
      [0.5, 'GRID BACK: CONTROLLER WAITS FOR IT TO BE STABLE'],
      [1.5, '5 MIN STABLE (SHOWN 100× FAST)'],
      [4.5, 'CLOSED TRANSITION: GRID AND SETS PARALLEL FOR 100 MS'],
      [5.0, 'GENERATOR BREAKERS OPEN, LOAD BACK ON THE GRID'],
      [6, 'COOL-DOWN RUN UNLOADED, 5 MIN (60× FAST)'],
      [11.5, 'FUEL OFF, THE ENGINE RUNS DOWN'],
      [15.5, 'BACK IN AUTO, READY FOR THE NEXT OUTAGE'],
    ],
  },
  test: {
    dur: 18,
    label: 'LOAD-BANK TEST',
    sub: 'MONTHLY RUN',
    clock: (t) => t,
    state: (t) => {
      const s = BASE();
      s.starter = ss(0.5, 0.7, t) * (1 - ss(2.0, 2.2, t));
      s.fuel = t > 1.6 ? 1 : 0;
      const steps = [[8.5, 500], [11, 500], [13.5, 500]];
      s.P = steps.reduce((a, [t0, kw]) => a + kw * ss(t0, t0 + 0.15, t), 0);
      s.n = runUp(t, 0.6) - steps.reduce((a, [t0]) => a + 30 * dip(t, t0 + 0.05), 0);
      s.V = R.V * ss(4.0, 7.0, t) - steps.reduce((a, [t0]) => a + 18 * dip(t, t0 + 0.05), 0);
      s.Gb = ss(8.0, 8.15, t);
      s.LB = ss(8.2, 8.35, t);
      s.cool = 40 + 10 * ss(2, 18, t);
      s.exh = 25 + 190 * ss(1.6, 5, t) + 0.17 * s.P;
      s.smoke = Math.max(ss(1.6, 1.9, t) * (1 - ss(2.6, 4.0, t)), ...steps.map(([t0]) => 0.45 * ss(t0, t0 + 0.2, t) * (1 - ss(t0 + 0.8, t0 + 2, t))));
      s.hl = t > 0.5 && t < 2.2 ? 'starter' : t > 8.4 && t < 15 ? 'engine' : '';
      return derived(s);
    },
    phases: [
      [0, 'MONTHLY TEST: THE GRID KEEPS FEEDING THE HALL'],
      [0.5, 'MANUAL START'],
      [1.6, 'FIRES, RUNS UP'],
      [7.0, 'AT SPEED: 415 V, 50 HZ'],
      [8.0, 'CLOSE ONTO THE PORTABLE LOAD BANK'],
      [8.5, '25 % LOAD: 500 KW'],
      [11, '50 % LOAD: 1,000 KW'],
      [13.5, '75 % LOAD: 1,500 KW, FREQUENCY DIP INSIDE ISO 8528 G3'],
      [15.5, 'LOGGED: THE SET IS PROVEN BEFORE IT IS NEEDED'],
    ],
  },
};
SEQ.standby.state = () => derived(BASE());
export const SEQS = ['standby', 'outage', 'restore', 'test'];
export const phaseAt = (seq, t) => SEQ[seq].phases.filter(([a]) => a <= t).pop()[1];

// ------------------------------------------------------------ the electrical picture
export function solve(s) {
  const gen = s.V > 380 && s.fuel;
  const genBus = gen && s.Gb > 0.5;
  const util = s.util && s.Ub > 0.5;
  const msb = util || (genBus && s.Mb > 0.5);
  return {
    gen,
    genBus,
    utilOn: util,
    msb,
    ups: msb ? (util ? 'MAINS' : 'GENERATOR') : 'BATTERY',
    lb: genBus && s.LB > 0.5,
    racks: 1,
  };
}

// ------------------------------------------------------------ the visual crank angle, integrated once per sequence
const DT = 1 / 240;
const TABLE = {};
for (const k of SEQS) {
  const S = SEQ[k];
  const A = [0];
  for (let i = 1; i * DT <= S.dur + 0.5; i++) {
    const n = S.state(Math.min(S.dur, (i - 0.5) * DT)).n;
    A.push(A[i - 1] + ((n / 60) * 2 * Math.PI * DT) / SLOW);
  }
  TABLE[k] = A;
}
export const crankAt = (seq, t) => {
  const A = TABLE[seq];
  const u = Math.max(0, Math.min(A.length - 2, t / DT));
  const i = Math.floor(u);
  return A[i] + (A[i + 1] - A[i]) * (u - i);
};

export const stateAt = (seq, tau) => {
  const S = SEQ[seq];
  const t = Math.min(S.dur, Math.max(0, tau));
  const s = S.state(t);
  return {...s, e: solve(s), clk: S.clock(t), fast: S.fast ? S.fast(t) : 1};
};

export const words = (s) => {
  if (s.starter > 0.05) return ['Cranking', `STARTERS ENGAGED · BATTERY ${s.batt.toFixed(1)} V`, 'move'];
  if (s.n < 1) return ['Standby', 'AUTO · WARM · READY TO START', 'idle'];
  if (!s.fuel) return ['Running down', `${s.n.toFixed(0)} RPM · FUEL OFF`, 'move'];
  if (s.P > 5) return ['On load', `${s.P.toFixed(0)} KW · ${s.LB > 0.5 ? 'LOAD BANK' : 'DATA HALL'}`, 'ok'];
  if (s.V > 400 && Math.abs(s.n - 1500) < 40) return ['Running, no load', 'AT SPEED · READY TO ACCEPT LOAD', 'ok'];
  return ['Running up', `${s.n.toFixed(0)} RPM · ${s.V.toFixed(0)} V`, 'move'];
};
