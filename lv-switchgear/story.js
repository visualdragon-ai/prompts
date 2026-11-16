// Timeline: single source of truth for picture, sound, subtitles. 96 BPM → beat .625 s, bar 2.5 s.
export const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
export const DUR = 61.25;
export const b = n => n * BEAT;                       // beat n → seconds

// narration: id, start, displayed text
export const VO = [
  ['v01', 1.0, 'A data center never sleeps. Neither can its power.'],
  ['v02', 6.25, 'Electricity arrives from the grid, and a transformer steps it down to about 400 volts.'],
  ['v03', 14.375, 'Then it meets the low-voltage switchgear.'],
  ['v04', 20.625, 'Inside, a main breaker lets power onto heavy copper busbars.'],
  ['v05', 26.25, 'Feeder breakers share it out: to the UPS, the cooling, the server racks.'],
  ['v06', 31.875, 'When a cable faults, only the breaker closest to it trips.'],
  ['v07', 36.25, 'Everything else stays on.'],
  ['v08', 39.375, 'And if the grid goes dark?'],
  ['v09', 42.0, 'The UPS batteries hold the servers while the generator starts.'],
  ['v10', 47.5, 'The switchgear changes source, never connecting both at once, and power flows again.'],
  ['v11', 54.375, 'Switch. Protect. Transfer. Every second, of every day.'],
];

// key events (seconds, all on the beat grid)
export const T = {
  hookClack: b(1),                 // 0.625  spread-1 breaker snaps ON
  rise1: 5.0,                      // spread 1 world pops up around the switchboard
  flow1: [6.25, 12.5],             // current travels pylon → racks
  sign: 14.375,                    // title sign drops
  turn: [17.5, 19.375],            // page turn
  rise2: 19.0,                     // spread 2 pops up
  mainClose: 20.625,               // MAIN closes
  busGlow: 21.875,                 // busbars energise
  feeders: [27.5, 28.125, 28.75, 29.375],   // UPS1, UPS2, COOLING, LIGHTS close, one per beat (GEN stays open)
  fault: 31.25, trip: 31.875,      // zap on the LIGHTS cable; LIGHTS breaker trips
  outage: 38.125,                  // utility lost: silence + graphite wash
  upsOn: 41.875,                   // UPS carries the racks
  genStart: 43.75,                 // generator pops up, starts
  mainOpen: 48.125, lock: 48.75, genClose: 49.375,   // open transition with interlock
  lightsReset: 51.875,
  fold2: 53.125,                     // ending: everything folds except the lineup
};
// spread index active at time t is decided by the page turn
export const voCues = durs => VO.map(([id, t0, text]) => ({ id, t0, t1: t0 + (durs[id] || 2), text }));
