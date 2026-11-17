// "Where does the heat go?" — a Whiteboard Explainer about cooling towers in data centres.
// One continuous board, no hands. A magnet is one watt of heat; we follow it from a server rack to the sky.
// All times are seconds. VO start times live in VO; drawings hang off spoken words via atS/atE(id, word).
import * as W from './engine/wb.js';
import { clamp, lerp, TAU, mulberry } from '/core/lib.js';

const { INK } = W;
export const VO = {
  v01: 1.0, v02: 3.6, v03: 7.2, v04: 14.6, v05: 18.0, v06: 21.8, v07: 26.0, v08: 30.4, v09: 35.6, v10: 38.0,
  v11: 44.0, v12: 49.4, v13: 54.4, v14: 60.4, v15: 63.2, v16: 66.0, v17: 68.8, v18: 72.2, v19: 84.0,
};
export const END = 90.0;
const Q = new URLSearchParams(location.search);

export async function build() {
  await W.loadFont('tech', 'fonts/EMSTech.json');
  const words = await (await fetch('voices/words.json')).json();
  const lines = await (await fetch('lines.json')).json();
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const at = (id, w, k = 0, which = 1) => {
    let n = 0; for (const x of words[id]) if (norm(x[0]).startsWith(norm(w)) && n++ === k) return VO[id] + Math.max(0, x[which]);
    throw new Error(`word ${w} not in ${id}`);
  };
  const atS = (id, w, k = 0) => at(id, w, k, 1), atE = (id, w, k = 0) => at(id, w, k, 2);
  const voEnd = id => VO[id] + words[id][words[id].length - 1][2];

  const tl = new W.Timeline();
  const K = new W.Pen('black', INK.black, { park: [2200, 1320] });
  const B = new W.Pen('blue', INK.blue, { park: [2100, 1450] });
  const O = new W.Pen('orange', INK.orange, { park: [2350, 1150] });
  const B2 = new W.Pen('blue2', INK.blue, { park: [1700, 1480], label: 'blue' });
  const PENS = [K, B, O, B2];
  const T = W.text;
  const D = (pen, shapes, a, b, o = {}) => tl.draw(pen, shapes, a, { by: b, ...o });
  const keep = arr => { for (const s of [arr].flat(9)) s.keep = true; return arr; };

  // ghost marks: residue of earlier meetings on this board
  const ghosts = [], gR = mulberry(2026);
  for (let i = 0; i < 40; i++) {
    const x = gR() * 7600 + 200, y = gR() * 4100 + 200, k = gR();
    const o = { w: 12, alpha: .05 + gR() * .05, color: gR() < .25 ? '#8aa0c8' : '#9aa0a8' };
    if (k < .32) ghosts.push(...T(['sprint 4', 'pump B?', 'Q3 plan', 'rack 12', '18 kW', 'thu 2pm', 'v2 > v1', 'todo', 'ok!'][i % 9], x, y, { h: 50 + gR() * 40, ...o }));
    else if (k < .55) ghosts.push(W.circle(x, y, 40 + gR() * 110, o));
    else if (k < .8) ghosts.push(...W.arrow(x, y, x + (gR() - .5) * 500, y + (gR() - .5) * 300, o));
    else ghosts.push(W.line(x, y, x + 200 + gR() * 500, y + (gR() - .5) * 80, o));
  }

  // ───────── layout (world units)
  const RK = { x: 840, y: 2820, w: 420, h: 700 };            // server rack
  const M0 = [1050, 3060];                                   // where the watt is born
  const CR = { x: 2250, y: 2930, w: 380, h: 520 };           // cooling unit (CRAH)
  const CH = { x: 3700, y: 2900, w: 480, h: 560 };           // chiller
  const TW = { cx: 6150, top: 700, bot: 1460 };              // cooling tower cross-section
  // the watt's route (magnet path = orange trail), in legs
  const LEG1 = [M0, [1330, 3132], [2250, 3132], [2440, 3020]];
  const LEG2 = [[2440, 3020], [2700, 3005], [3650, 3005], [3940, 3180]];
  const LEG3 = [[3940, 3180], [4250, 2960], [5130, 2960], [5130, 910], [5520, 880]];
  const LEG4 = [[5520, 880], [6150, 760], [6150, 560], [6150, 150]];
  const offsetPts = (pts, dy) => pts.map(([x, y]) => [x, y + dy]);

  // the watt's trail (orange dashes, never erased); the pen leads, the magnet follows
  const trail = pts => keep(W.dashed(offsetPts(pts, 0), { w: 8, dash: 34, gap: 26, smooth: 2 }));
  const slides = [];
  const slide = (pts, t0, t1) => { slides.push({ pts, t0, t1 }); D(O, trail(pts), t0 - .25, t1 - .25, { travel: 8000, minGap: .005, maxGap: .015 }); tl.cue(t0, 'slide', { dur: t1 - t0 }); tl.cue(t1, 'magnet', { big: 0 }); };
  // ═════════ A · ONE WATT (0–14)
  tl.cue(0.25, 'cap', { pen: 'orange' });
  const tDrop = 0.55;
  tl.cue(tDrop + .3, 'magnet', { big: 1 });
  D(O, T('1 watt', 1300, 3085, { h: 64 }), atS('v01', 'one') - .05, atE('v01', 'heat') + .1);
  // the rack is drawn around the magnet
  const rack = [...W.rect(RK.x, RK.y, RK.w, RK.h, { w: 11 })];
  for (let k = 1; k < 7; k++) rack.push(W.line(RK.x + 12, RK.y + k * 100, RK.x + RK.w - 12, RK.y + k * 100, { w: 6 }));
  const leds = [];
  for (let k = 0; k < 7; k++) {
    const y = RK.y + 50 + k * 100;
    if (k !== 2) { leds.push(W.line(RK.x + 40, y, RK.x + 200, y, { w: 5 })); }
    leds.push(W.circle(RK.x + RK.w - 60, y, 9, { w: 5 }), W.circle(RK.x + RK.w - 100, y, 9, { w: 5 }));
  }
  rack.push(W.line(RK.x + 40, RK.y + RK.h, RK.x + 40, RK.y + RK.h + 40, { w: 8 }), W.line(RK.x + RK.w - 40, RK.y + RK.h, RK.x + RK.w - 40, RK.y + RK.h + 40, { w: 8 }));
  D(K, rack, VO.v02 + .1, VO.v02 + 1.9, { minGap: .02, maxGap: .06 });
  D(K, leds, VO.v02 + 1.95, atS('v02', 'question') - .1, { minGap: .015, maxGap: .04 });
  D(K, [W.roundRect(470, 2690, 280, 170, 50, { w: 8 }), W.line(640, 2860, 760, 2930, { w: 8 }), ...T('?', 610, 2820, { h: 110 })], atS('v02', 'question'), voEnd('v02') + .25);
  // heat rising off the rack, the number
  const squig = x => W.curve([...Array(9)].map((_, i) => [x + Math.sin(i * 1.4) * 22, RK.y - 30 - i * 26]), { w: 8 });
  D(O, [squig(950), squig(1050), squig(1150)], atS('v03', 'heat') - .1, atE('v03', 'heat') + .35, { minGap: .04 });
  D(O, T('100 kW+', 1380, 2930, { h: 120 }), atS('v03', 'hundred') - .1, atE('v03', 'kilo') + .15);
  D(K, T('per AI rack', 1390, 2995, { h: 50 }), atE('v03', 'kilo') + .2, atE('v03', 'kilo') + .9);

  // ═════════ TITLE (14.6)
  D(K, T('Where does the heat go?', 600, 2500, { h: 120, w: 12 }), VO.v04 - .1, VO.v04 + 2.9, { minGap: .02, maxGap: .06 });
  D(O, W.curve([[590, 2560], [1200, 2548], [1800, 2566], [2240, 2545]], { w: 14, over: 24 }), VO.v04 + 3.0, VO.v04 + 3.6);

  // ═════════ B · THE JOURNEY (18–35)
  slide(LEG1, atS('v05', 'carries') - .1, atE('v05', 'unit') + .3);
  // air → cooling unit
  D(K, W.arrow(1280, 3170, 2230, 3170, { w: 9, head: 30 }), VO.v05 + .1, atE('v05', 'air') + .6);
  D(K, T('air', 1660, 3240, { h: 52 }), atE('v05', 'air') + .65, atE('v05', 'air') + 1.0);
  const crah = [...W.rect(CR.x, CR.y, CR.w, CR.h, { w: 10 })];
  for (let k = 0; k < 4; k++) crah.push(W.line(CR.x + 40, CR.y + 40 + k * 26, CR.x + CR.w - 40, CR.y + 40 + k * 26, { w: 5 }));
  const fc = [CR.x + CR.w / 2, CR.y + 330];
  crah.push(W.circle(fc[0], fc[1], 110, { w: 8 }));
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3; crah.push(W.curve([[fc[0], fc[1]], [fc[0] + Math.cos(a + .5) * 60, fc[1] + Math.sin(a + .5) * 60], [fc[0] + Math.cos(a) * 92, fc[1] + Math.sin(a) * 92]], { w: 7 })); }
  D(K, crah, atE('v05', 'air') + 1.05, atE('v05', 'unit') + .1, { minGap: .02, maxGap: .05 });
  D(K, T('cooling unit', fc[0], CR.y - 40, { h: 55, align: 'center' }), atE('v05', 'unit') + .15, atE('v05', 'unit') + .95);
  slide(LEG2, atS('v06', 'warms'), atE('v06', 'chiller') + .2);
  // chilled water loop (blue) → chiller
  const loopTop = W.arrow(CR.x + CR.w, 3060, CH.x - 10, 3060, { w: 10, head: 28 });
  const loopBot = W.arrow(CH.x, 3360, CR.x + CR.w + 10, 3360, { w: 10, head: 28 });
  D(B, [loopTop, loopBot], atS('v06', 'loop') - .3, atE('v06', 'water') + .1);
  D(B, T('chilled water', 2730, 3235, { h: 50 }), atE('v06', 'water') + .1, atS('v06', 'chiller') + .1);
  const chiller = [...W.rect(CH.x, CH.y, CH.w, CH.h, { w: 10 }), W.roundRect(CH.x + 40, CH.y + 60, CH.w - 80, 150, 60, { w: 8 }), W.roundRect(CH.x + 40, CH.y + 350, CH.w - 80, 150, 60, { w: 8 })];
  D(K, chiller, atS('v06', 'chiller') - .5, voEnd('v06') + .5, { minGap: .02, maxGap: .05 });
  D(K, T('chiller', CH.x + CH.w / 2, CH.y - 40, { h: 55, align: 'center' }), voEnd('v06') + .55, voEnd('v06') + 1.0);
  slide(LEG3, atS('v07', 'hands'), atE('v07', 'roof') + .4);
  // condenser loop climbs to the roof (the pen leads the camera)
  const supply = [[CH.x + CH.w, 3010], [5200, 3010], [5200, 960], [5600, 960]];
  const ret = [[5560, 1440], [5060, 1440], [5060, 3310], [CH.x + CH.w + 10, 3310]];
  const pipeS = W.poly(supply.flat(), { w: 10, wav: 600 }), pipeR = W.poly(ret.flat(), { w: 10, wav: 600 });
  D(B, pipeS, VO.v07 + .3, atE('v07', 'roof') - .2, { speed: 3000 });
  D(B2, T('condenser water', 4300, 3200, { h: 46 }), atS('v07', 'second') - .1, atE('v07', 'loop') + .3);
  D(K, [W.line(4500, 1650, 7900, 1655, { w: 9 }), ...T('roof', 4520, 1610, { h: 60 })], atS('v07', 'roof') - .4, voEnd('v07') + .4);
  D(B2, pipeR, voEnd('v07') + .45, VO.v08 + .3, { speed: 6000 });
  // cold days: the chiller rests (wide shot)
  const flake = []; const fx = 4760, fy = 2560;
  for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; flake.push(W.line(fx - Math.cos(a) * 120, fy - Math.sin(a) * 120, fx + Math.cos(a) * 120, fy + Math.sin(a) * 120, { w: 14 })); }
  D(B, flake, atS('v08', 'cold') - .05, atE('v08', 'days') + .1);
  D(K, [W.line(CH.x - 30, CH.y - 30, CH.x + CH.w + 30, CH.y + CH.h + 30, { w: 16 }), W.line(CH.x + CH.w + 30, CH.y - 30, CH.x - 30, CH.y + CH.h + 30, { w: 16 })], atS('v08', 'switch') - .05, atE('v08', 'off') + .05);
  D(B, T('cold days: chiller OFF', 3200, 2700, { h: 110, w: 12 }), atE('v08', 'off') + .1, atS('v08', 'alone') + .3);

  // ═════════ C · INSIDE THE TOWER (35.6–59.4)
  const shell = [W.line(5650, TW.top, 6650, TW.top, { w: 11 }), W.line(6650, TW.top, 6760, TW.bot, { w: 11 }), W.line(6760, TW.bot, 5540, TW.bot, { w: 11 }), W.line(5540, TW.bot, 5650, TW.top, { w: 11 }),
    ...W.rect(5900, 610, 500, 90, { w: 10 }), W.line(5620, TW.bot, 5620, 1650, { w: 9 }), W.line(6680, TW.bot, 6680, 1650, { w: 9 })];
  D(K, shell, VO.v09 + .1, voEnd('v09') + .1, { minGap: .02, maxGap: .05 });
  D(K, T('cooling tower', 6450, 585, { h: 64 }), voEnd('v09') + .15, voEnd('v09') + 1.0);
  D(O, T('35°C', 5250, 1065, { h: 62 }), atS('v10', 'warm') - .05, atE('v10', 'water') + .1);
  const spray = [W.line(5600, 960, 6550, 960, { w: 14, bow: .002 })];
  for (let k = 0; k < 6; k++) { const x = 5700 + k * 160; spray.push(W.poly([x - 18, 975, x, 1000, x + 18, 975], { w: 6, jitter: .3 })); }
  D(B, spray, atS('v10', 'sprayed') - .15, atE('v10', 'sprayed') + .1, { minGap: .02 });
  const drops = []; const dR = mulberry(7);
  for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) { const x = 5690 + k * 160 + (dR() - .5) * 60, y = 1015 + j * 14; drops.push(W.line(x, y, x + (dR() - .5) * 12, y + 22, { w: 6, kind: 'dash' })); }
  D(B, drops, atE('v10', 'sprayed') + .14, atS('v10', 'honey') + .35, { minGap: .005, maxGap: .015 });
  D(K, W.hatch([[5665, 1060], [6640, 1060], [6668, 1250], [5636, 1250]], { spacing: 30, angle: -.9, w: 6, alpha: .5 }), atS('v10', 'honey'), atE('v10', 'fill') + .05);
  D(K, T('fill', 5430, 1185, { h: 54 }), atE('v10', 'fill') + .08, atE('v10', 'fill') + .4);
  const fall = []; for (let k = 0; k < 14; k++) { const x = 5660 + k * 72 + (dR() - .5) * 30, y = 1275 + (k % 3) * 30; fall.push(W.line(x, y, x, y + 30, { w: 6, kind: 'dash' })); }
  D(B2, fall, atE('v10', 'fill') + .1, atS('v10', 'fan') + .2, { minGap: .005, maxGap: .015 });
  D(K, [W.arc(6150, 655, 190, 0, TAU + .2, { ry: 24, w: 7 }), W.circle(6150, 655, 14, { w: 7 }), ...T('fan', 5880, 668, { h: 50, align: 'right' })], atS('v10', 'fan') - .2, atE('v10', 'fan') + .05, { minGap: .02 });
  const louv = []; for (let k = 0; k < 4; k++) { const y = 1300 + k * 38; louv.push(W.line(5560, y, 5610, y + 26, { w: 6 }), W.line(6740, y, 6690, y + 26, { w: 6 })); }
  D(K, louv, atE('v10', 'fan') + .1, atS('v10', 'air') - .05, { minGap: .01 });
  D(K, [W.arrow(5250, 1400, 5850, 1330, { w: 8, head: 26, curve: [5560, 1440] }), W.arrow(7050, 1400, 6450, 1330, { w: 8, head: 26, curve: [6740, 1440] }), W.arrow(6150, 1390, 6150, 800, { w: 8, head: 26 })],
    atS('v10', 'air'), voEnd('v10') + .2, { minGap: .02 });
  D(B, W.curve([[5570, 1418], [5800, 1404], [6050, 1424], [6300, 1406], [6550, 1424], [6740, 1410]], { w: 8 }), voEnd('v10') + .25, voEnd('v10') + .6);
  // evaporation: vapour leaves through the fan, carrying heat
  const vap = x => W.curve([...Array(8)].map((_, i) => [x + Math.sin(i * 1.3 + x) * 18, 590 - i * 20]), { w: 7 });
  D(B, [vap(5990), vap(6150), vap(6310)], atS('v11', 'evap') - .05, atE('v11', 'evap') + .15, { minGap: .03 });
  D(O, [W.curve([[6060, 560], [6075, 530], [6055, 500], [6072, 470]], { w: 7 }), W.curve([[6240, 560], [6255, 530], [6235, 500], [6252, 470]], { w: 7 })], atS('v11', 'heat') - .05, atE('v11', 'heat') + .25);
  D(B, T('29°C', 5250, 1420, { h: 62 }), atE('v11', 'away') + .1, atE('v11', 'away') + .55);
  // one in a hundred
  const GX = 6880, GY = 760, GS = 38, dots = [];
  for (let i = 0; i < 100; i++) dots.push(W.circle(GX + (i % 10) * GS, GY + Math.floor(i / 10) * GS, 8, { w: 5, lap: .1 }));
  D(K, T('100 drops of water', GX, GY - 50, { h: 46 }), VO.v12 - .6, VO.v12 - .15);
  D(K, dots, VO.v12 - .1, VO.v12 + .95, { minGap: .003, maxGap: .006 });
  const d1 = [GX + 9 * GS, GY];
  D(O, [W.circle(d1[0], d1[1], 26, { w: 7 }), ...W.arrow(d1[0] + 22, d1[1] - 26, d1[0] + 150, d1[1] - 150, { w: 7, head: 22 })], VO.v12 + 1.0, VO.v12 + 1.5);
  D(O, T('1% vapour', d1[0] + 120, d1[1] - 175, { h: 46 }), VO.v12 + 1.55, atS('v12', 'rest') + .15);
  D(B, W.hatch([[GX - 20, GY - 20], [GX + 9.5 * GS, GY - 20], [GX + 9.5 * GS, GY + 9.5 * GS], [GX - 20, GY + 9.5 * GS]], { spacing: 26, w: 6, alpha: .35 }), atS('v12', 'rest') + .2, atS('v12', 'six') - .1);
  D(B, T('the rest: 6°C cooler', GX, 1200, { h: 60 }), atS('v12', 'six') - .05, atE('v12', 'cooler') + .2);
  // like sweat, and cheaper than air cooling
  const SF = [7720, 860];
  const fig = [W.circle(SF[0], SF[1] - 45, 42, { w: 7 }), W.line(SF[0], SF[1], SF[0], SF[1] + 150, { w: 7 }), W.poly([SF[0] - 70, SF[1] + 30, SF[0], SF[1] + 60, SF[0] + 70, SF[1] + 30], { w: 7 }),
    W.poly([SF[0] - 50, SF[1] + 250, SF[0], SF[1] + 150, SF[0] + 50, SF[1] + 250], { w: 7 })];
  D(K, fig, VO.v13 + .05, atS('v13', 'sweat') - .05, { minGap: .02 });
  const dropShape = (x, y, s) => W.poly([x, y, x + s * .45, y + s * .75, x + s * .3, y + s * 1.05, x, y + s * 1.15, x - s * .3, y + s * 1.05, x - s * .45, y + s * .75, x, y], { w: 5, smooth: 2 });
  D(B, [dropShape(SF[0] - 75, SF[1] - 95, 34), dropShape(SF[0] + 72, SF[1] - 80, 30), dropShape(SF[0] + 60, SF[1] - 10, 24)], atS('v13', 'sweat'), atE('v13', 'sweat') + .2);
  D(K, T('like sweat', SF[0] - 140, SF[1] - 120, { h: 44 }), atE('v13', 'sweat') + .22, atS('v13', 'far') - .1);
  D(K, T('less power than air cooling', GX, 1330, { h: 50 }), atS('v13', 'far') - .05, atE('v13', 'alone') + .15);
  D(B, W.text('✓', GX + 830, 1335, { h: 62 }), atE('v13', 'alone') + .2, atE('v13', 'alone') + .5);

  // ═════════ D · LIFT-OFF (60.4–64.8): the watt leaves as vapour
  const tLift0 = voEnd('v14') + .25, tLift1 = VO.v15 + 1.6;
  tl.cue(tLift0, 'magnetOff'); tl.cue(tLift0 + .1, 'rise', { dur: tLift1 - tLift0 });
  D(B, T('sky', 6320, 330, { h: 96 }), atS('v15', 'sky') - .1, atE('v15', 'sky') + .3);

  // the lift-off trail: wavy, up through the fan into the sky
  const upPts = [[5560, 860], [5900, 790], [6150, 740], [6150, 600]];
  for (let i = 1; i <= 8; i++) upPts.push([6150 + Math.sin(i * 1.2) * 40, 600 - i * 55]);
  D(O, keep(W.dashed(upPts, { w: 8, dash: 30, gap: 24, smooth: 2 })), tLift0 + .1, tLift1 - .3, { travel: 8000, minGap: .005, maxGap: .015 });

  // ═════════ E · THE WATER BILL (66–78)
  D(K, T('the water bill', 5850, 2150, { h: 90, w: 10 }), VO.v16 + .05, atE('v16', 'bill') + .35);
  D(B, W.curve([[5840, 2190], [6200, 2182], [6560, 2196]], { w: 10, over: 20 }), atE('v16', 'bill') + .4, atE('v16', 'bill') + .8);
  const bigDrop = W.poly([6000, 2290, 6130, 2520, 6150, 2640, 6080, 2740, 6000, 2760, 5920, 2740, 5850, 2640, 5870, 2520, 6000, 2290], { w: 11, smooth: 2 });
  D(B, [bigDrop, W.hatch([[6000, 2330], [6110, 2530], [6125, 2640], [6060, 2720], [5940, 2720], [5875, 2640], [5890, 2530]], { spacing: 26, w: 6, alpha: .4 })], atS('v17', 'evap') - .1, atS('v17', 'millions') - .05);
  D(B, T('millions of litres a day', 6250, 2420, { h: 70 }), atS('v17', 'millions') - .05, atE('v17', 'day') + .25);
  D(K, T('WUE = litres per kWh', 6250, 2585, { h: 60 }), atS('v18', 'measure') - .05, atE('v18', 'hour') + .2);
  D(B, T('+ recycled water', 6250, 2745, { h: 60 }), atS('v18', 'turn') - .05, atE('v18', 'water') + .3);

  // ═════════ F · WIPE TO ONE LINE (78–90)
  const tWipe = voEnd('v18') + 1.1, wipeDur = 3.8;
  const wipePath = []; for (let k = 0, y = 280; y <= 3900; k++, y += 420) wipePath.push(...(k % 2 ? [[7750, y], [250, y]] : [[250, y], [7750, y]]));   // horizontal passes, overlapping bands
  tl.erase(wipePath, tWipe, wipeDur, { width: 560, strength: .93 });
  D(K, T('chip → water → sky', 3300, 2250, { h: 200, w: 18, align: 'center' }), VO.v19 - .15, voEnd('v19') + .2, { minGap: .02, maxGap: .05 });
  const endUnder = W.curve([[4170, 2325], [4390, 2315], [4610, 2330]], { w: 16, over: 20 });
  D(O, endUnder, voEnd('v19') + .3, voEnd('v19') + .8);
  const tCap = voEnd('v19') + 1.6;
  tl.cue(tCap, 'capOn', { pen: 'orange' });
  tl.end();

  // ───────── the magnet: one watt of heat
  const polyAt = (pts, u) => {                       // point at fraction u of a polyline's length
    const L = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
    let s = clamp(u) * tot;
    for (let i = 0; i < L.length; i++) { if (s <= L[i] || i === L.length - 1) { const f = clamp(s / (L[i] || 1)); return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]; } s -= L[i]; }
  };
  const ss = u => u * u * (3 - 2 * u);
  const magnetAt = t => {
    if (t < tDrop) return null;
    if (t < tDrop + .3) { const u = (t - tDrop) / .3; return { x: M0[0], y: M0[1], lift: (1 - u) ** 2 * 1.4, a: clamp(u * 3) }; }
    for (const s of slides) {
      if (t >= s.t0 && t <= s.t1) { const u = (t - s.t0) / (s.t1 - s.t0), [x, y] = polyAt(s.pts, ss(u)); return { x, y, lift: .14 * Math.sin(Math.PI * clamp(u * 6)) + .1 * Math.sin(Math.PI * u), a: 1 }; }
    }
    let last = M0;
    for (const s of slides) if (t > s.t1) last = s.pts[s.pts.length - 1];
    if (t >= tLift0) {
      const u = clamp((t - tLift0) / (tLift1 - tLift0)), [x, y] = polyAt(LEG4, ss(u));
      return { x, y, lift: Math.min(1.6, u * 2.2), a: 1 - clamp((u - .62) / .38), rise: u };
    }
    return { x: last[0], y: last[1], lift: 0, a: 1 };
  };
  function drawHeatMagnet(ctx, m, c) {
    const [sx, sy] = W.toScreen(c, m.x, m.y), r = 66 * c.z * (1 + m.lift * .12), up = m.lift * 34 * c.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = m.a;
    ctx.save(); ctx.filter = `blur(${(6 + m.lift * 16) * c.z}px)`; ctx.fillStyle = `rgba(60,30,20,${.34 - m.lift * .12})`;
    ctx.beginPath(); ctx.ellipse(sx + (8 + up * .9) * 1, sy + (12 + up * 1.1), r * 1.02, r * .96, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(sx, sy - up);
    const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r * 1.05);
    g.addColorStop(0, '#f8b497'); g.addColorStop(.5, INK.orange); g.addColorStop(1, '#9e4529');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,240,.95)'; ctx.lineWidth = r * .13; ctx.lineCap = 'round';
    for (const dx of [-.34, 0, .34]) {               // three heat squiggles
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const v = i / 12, x = dx * r + Math.sin(v * TAU * 1.1 + dx * 4) * r * .1, y = r * (.42 - v * .84); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-r * .42, -r * .55, r * .22, r * .1, -.6, 0, TAU); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ───────── camera: a route ridden left to right, then up
  const cam = new W.Camera([
    [0, 1150, 3060, 1.6], [3.8, 1150, 3060, 1.6, 0, 'l'],
    [7.0, 1250, 3150, 1.0], [13.9, 1262, 3150, 1.0, 0, 'l'],          // pull back: one watt among 100 kW
    [15.0, 1400, 2820, .95], [17.6, 1405, 2820, .95, 0, 'l'],          // the question
    [21.0, 2050, 3150, 1.0], [21.6, 2100, 3150, 1.0, 0, 'l'],          // ride the route
    [25.2, 3300, 3150, 1.0], [26.2, 3550, 3140, 1.0, 0, 'l'],
    [28.0, 4600, 2950, .95, 0, 's'], [30.2, 5000, 1600, .9, 0, 'o'],     // climb to the roof
    [30.5, 5000, 1600, .9, 0, 'l'],
    [31.8, 3350, 2250, .38], [35.2, 3360, 2250, .38, 0, 'l'],          // wide: the whole loop, chiller resting
    [36.8, 6150, 1030, .88], [48.6, 6150, 1020, .92, 0, 'l'],          // into the tower, slow push
    [49.6, 7030, 1020, 1.0], [59.6, 7030, 1020, 1.0, 0, 'l'],          // the hundred drops, the sweat
    [60.6, 5900, 1000, 1.0], [tLift0, 5900, 1000, 1.0, 0, 'l'],        // back to our watt
    [tLift1, 6150, 620, .9, 0, 'io'], [tLift1 + .3, 6150, 620, .9, 0, 'l'],   // crane up with it
    [66.3, 6650, 2480, 1.0], [tWipe - .8, 6660, 2480, 1.02, 0, 'l'],   // what it leaves behind
    [tWipe + .9, 3550, 1900, .33], [END, 3550, 1900, .336, 0, 'l'],    // pull out; the wipe; one line survives
  ]);
  tl.cue(0, 'cams', { moves: [[3.8, 7.0], [13.9, 15.0], [17.6, 21.0], [26.2, 30.2], [30.5, 31.8], [35.2, 36.8], [48.6, 49.6], [59.6, 60.6], [tLift0, tLift1], [64.9, 66.3], [tWipe - .8, tWipe + .9]] });

  const board = new W.Board(tl, { ghosts });
  board.objs.push({ draw: (ctx, t, c) => { const m = magnetAt(t); if (m && m.a > 0) drawHeatMagnet(ctx, m, c); } });
  board.objs.push({ draw: (ctx, t, c) => { for (const e of tl.erasers) W.drawEraser(ctx, e, t, c); } });
  if (!Q.has('nopens')) board.objs.push({ draw: (ctx, t, c) => { for (const p of PENS) W.drawMarker(ctx, p, W.penPose(p, t, cam), c, t); } });

  // ───────── subtitles (split at clauses; digits on screen, words in the voice)
  const subs = [];
  for (const L of lines) {
    const ws = words[L.id].map(w => [w[0], Math.max(0, w[1]), w[2]]), t0 = VO[L.id], text = L.sub || L.text;
    const cum = [0]; ws.forEach(w => cum.push(cum[cum.length - 1] + w[0].length + 1)); const tot = cum[cum.length - 1];
    const timeAt = f => { const c = f * tot; let i = 0; while (i < ws.length - 1 && cum[i + 1] <= c) i++; const u = clamp((c - cum[i]) / (cum[i + 1] - cum[i])); return lerp(ws[i][1], ws[i][2], u); };
    const parts = text.match(/[^,.?:]+[,.?:…]*\s*/g).reduce((acc, p) => {
      const last = acc[acc.length - 1];
      if (last != null && ((last + p).trim().length <= 62 || ((last.trim().length < 24 || p.trim().length < 24) && (last + p).trim().length <= 88))) acc[acc.length - 1] += p; else acc.push(p); return acc; }, []);
    let c0 = 0;
    for (const p of parts) {
      const f0 = c0 / text.length, f1 = (c0 + p.trimEnd().length) / text.length; c0 += p.length;
      subs.push({ id: L.id, t0: t0 + (f0 === 0 ? ws[0][1] : timeAt(f0)) - .05, t1: t0 + (f1 >= .999 ? ws[ws.length - 1][2] : timeAt(f1)) + .45, text: p.trim() });
    }
  }
  for (let i = 0; i < subs.length - 1; i++) {         // a clause too short to read joins the next clause of the same line
    if (subs[i].id === subs[i + 1].id && subs[i + 1].t0 - subs[i].t0 < 2.0) { subs[i].t1 = subs[i + 1].t1; subs[i].text += ' ' + subs[i + 1].text; subs.splice(i + 1, 1); i--; }
  }
  for (let i = 0; i < subs.length; i++) {             // hold each caption ≥ 1.8 s unless the next one needs the slot
    const nx = i + 1 < subs.length ? subs[i + 1].t0 - .04 : 1e9;
    subs[i].t1 = Math.min(Math.max(subs[i].t1, subs[i].t0 + 1.8), nx);
  }
  board.overlays.push({
    draw: (ctx, t) => {
      const s = subs.find(s => t >= s.t0 && t < s.t1); if (!s) return;
      const a = Math.min(1, (t - s.t0) / .12, (s.t1 - t) / .12);
      ctx.font = '44px AD';
      let rows = [s.text];
      if (ctx.measureText(s.text).width > 1250) {
        const ws = s.text.split(' '); let best = 1, bd = 1e9;
        for (let i = 1; i < ws.length; i++) { const d = Math.abs(ctx.measureText(ws.slice(0, i).join(' ')).width - ctx.measureText(ws.slice(i).join(' ')).width); if (d < bd) { bd = d; best = i; } }
        rows = [ws.slice(0, best).join(' '), ws.slice(best).join(' ')];
      }
      const w = Math.max(...rows.map(r => ctx.measureText(r).width)) + 64, h = 70 + (rows.length - 1) * 52, y0 = 1038 - h;
      ctx.globalAlpha = a * .9; ctx.fillStyle = '#fdfcf8'; ctx.shadowColor = 'rgba(30,30,40,.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
      ctx.beginPath(); ctx.roundRect(960 - w / 2, y0, w, h, 14); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.globalAlpha = a;
      ctx.fillStyle = INK.orange; ctx.fillRect(960 - w / 2 + 22, y0 + h - 12, 36, 4);
      ctx.fillStyle = '#23262c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      rows.forEach((r, i) => ctx.fillText(r, 960, y0 + 37 + i * 52));
    }
  });
  if (Q.has('nosubs')) board.overlays.length = 0;

  // ───────── frame render with camera motion blur on fast moves
  const off = new OffscreenCanvas(1920, 1080), oc = off.getContext('2d');
  function render(ctx, t) {
    const dt = 1 / 24, a = cam.at(t), b = cam.at(Math.max(0, t - dt));
    const sp = Math.hypot((a.x - b.x) * a.z, (a.y - b.y) * a.z) + Math.abs(Math.log(a.z / b.z)) * 900;
    const N = sp > 14 ? Math.min(12, Math.ceil(sp * .5 / 4)) : 1;
    if (N === 1) { board.render(ctx, t, cam); return; }
    const ov = board.overlays; board.overlays = [];
    for (let i = 0; i < N; i++) { board.render(oc, t - dt * .5 * i / (N - 1), cam); ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(off, 0, 0); }
    ctx.globalAlpha = 1; board.overlays = ov;
    for (const o of ov) { ctx.save(); o.draw(ctx, t); ctx.restore(); }
  }

  const ev = [...tl.ev, ...Object.entries(VO).map(([id, t]) => ({ t, type: 'vo', id }))].sort((a, b) => a.t - b.t);
  for (const e of ev) if (e.x != null) { const c = cam.at(e.t), [px, py] = W.toScreen(c, e.x, e.y); e.pan = +clamp((px - 960) / 1400, -.7, .7).toFixed(2); e.z = +c.z.toFixed(2); e.on = px > -100 && px < 2020 && py > -100 && py < 1180 ? 1 : 0; }
  return { dur: END, render, ev, subs, cues: { tDrop, tLift0, tLift1, tWipe, wipeDur, tCap, sil: [[voEnd('v13') + .15, VO.v14 - .1], [voEnd('v18') + .1, tWipe]] } };
}
