// The standby set the figure draws, and what it does after the mains fails.
// Pure: no DOM, no kit. The build reads it for the caption and the page runs
// the same functions every frame, so the readout, the panel display, the hot
// cables and the rain-cap flap all come from one clock.

export const SET = {
  kva: 2500,
  pf: 0.8,
  volts: 400,
  hz: 50,
  rpm: 1500,
  poles: 4,
  cylinders: 16,
  load: 1600,
  litresPerKwh: 0.265,
  battery: 24,
  crankRpm: 150,
  coolant: 40,
};
SET.kw = SET.kva * SET.pf;
SET.amps = (SET.kva * 1000) / (Math.sqrt(3) * SET.volts);
SET.burn = SET.load * SET.litresPerKwh;

// Seconds after the mains fails. NFPA 110 Level 1, Type 10: the set must be
// on load within 10 s.
export const T = {
  detect: 1.0,
  crank: 1.0,
  fire: 2.6,
  rated: 7.2,
  excite: 4.8,
  ready: 8.0,
  transfer: 8.8,
  cool: 3.0,
  coast: 4.2,
};

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const bump = (tau, rise) => (tau <= 0 ? 0 : (tau / rise) * Math.exp(1 - tau / rise));

export function hzOf(rpm) {
  return (rpm * SET.poles) / 120;
}

// The run after a mains failure at t = 0. `stop` is the time the mains came
// back (Infinity while it is still out).
export function stateAt(t, stop = Infinity) {
  if (t < 0) return idle();
  let rpm = 0;
  let phase = "mains lost";
  if (t >= T.crank && t < T.fire) {
    rpm = SET.crankRpm * smooth(T.crank, T.crank + 0.35, t);
    phase = "cranking";
  } else if (t >= T.fire) {
    const run = smooth(T.fire, T.rated, t);
    rpm = SET.crankRpm + (SET.rpm - SET.crankRpm) * (1 - Math.pow(1 - run, 2.2)) + 22 * bump(t - T.rated + 0.6, 0.5);
    phase = t < T.excite ? "running up" : t < T.ready ? "voltage building" : "ready";
  }
  const volts = SET.volts * smooth(T.excite, T.ready, t);
  let kw = t >= T.transfer ? SET.load * smooth(T.transfer, T.transfer + 0.25, t) : 0;
  if (t >= T.transfer) {
    rpm -= 46 * bump(t - T.transfer, 0.45);
    phase = "on load";
  }
  if (t >= stop) {
    const since = t - stop;
    kw *= 1 - smooth(0, 0.3, since);
    phase = "cooling down";
    if (since > T.cool) {
      rpm *= Math.exp(-(since - T.cool) / (T.coast / 3.2));
      phase = "stopping";
    }
    if (since > T.cool + T.coast) return idle();
  }
  const hz = hzOf(rpm);
  const cranking = phase === "cranking";
  const gas = rpm < SET.crankRpm * 1.05 && !cranking ? 0 : (rpm / SET.rpm) * (0.22 + 0.78 * (kw / SET.kw)) + (cranking ? 0.04 : 0);
  return { t, phase, rpm, hz, volts, kw, cranking, gas: clamp(gas), onLoad: kw > 1, done: false };
}

function idle() {
  return { t: -1, phase: "standby", rpm: 0, hz: 0, volts: 0, kw: 0, cranking: false, gas: 0, onLoad: false, done: true };
}

// The rain-cap flap: shut at rest, lifted by the exhaust stream.
export function flapOf(gas) {
  return 82 * Math.pow(clamp(gas), 0.6);
}

export function fuelHours(litres) {
  return litres / SET.burn;
}
