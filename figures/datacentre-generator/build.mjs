import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../.claude/skills/anatomy/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../.claude/skills/anatomy/kit/tube.mjs";
import * as A from "../../.claude/skills/anatomy/kit/audit.mjs";
import { kitScript } from "../../.claude/skills/anatomy/scripts/inline-kit.mjs";
import { SET, T, fuelHours } from "./genset.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = join(HERE, "..", "..", ".claude", "skills", "anatomy", "kit");
const THEME = process.argv.includes("--dark") ? "dark" : "light";

// World units are 2 cm. x runs along the set (radiator at +x), y across it, z up.
const W = 640;
const H = 440;
const AZIMUTH = 62;
const ELEVATION = 30;

const PLINTH = { x: -192, y: -80, w: 384, d: 170, r: 3 };
const PLINTH_H = 10;
const TANK = { x: -160, y: -54, w: 312, d: 108, r: 2 };
const TANK_H = 24;
const RAIL_Y = [38, 48];
const RAIL_Z = [24, 34];
const MOUNT_TOP = 42;
const CZ = 84;
const CYL = Array.from({ length: 8 }, (_, i) => 8 + 12.5 * i);
const POST = { x: 168, y: 66, half: 3 };
const ROOF = [158, 164];
const SIL = { x0: -170, x1: -44, y: -46, z: 198, r: 20 };
const BEARERS = [-150, -66];

const PIECES = {
  engine: { name: "Diesel engine", say: `V${SET.cylinders} diesel · ${SET.rpm.toLocaleString("en-US")} rpm · ${Math.round(SET.kw / 0.95).toLocaleString("en-US")} kW at the flywheel`, move: [0, 0, 0] },
  alternator: { name: "Alternator", say: `alternator · ${SET.kva.toLocaleString("en-US")} kVA · ${SET.volts} V · ${Math.round(SET.amps).toLocaleString("en-US")} A a phase`, move: [-60, 0, 8] },
  radiator: { name: "Radiator and fan", say: "radiator and fan · about 1.3 MW of engine heat to air at full load", move: [70, 0, 0] },
  silencer: { name: "Exhaust silencer", say: "exhaust silencer · twin turbos into one pipe · rain cap lifts with the gas", move: [0, 0, 52] },
  tank: { name: "Base fuel tank and mounts", say: "", move: [0, 0, 0] },
  batteries: { name: "Starter batteries", say: `starter batteries · four 12 V blocks · ${SET.battery} V to the starter`, move: [0, 26, 0] },
  heater: { name: "Jacket-water heater", say: `jacket-water heater · keeps the coolant at ${SET.coolant} °C so the set starts in seconds`, move: [0, 22, 0] },
  panel: { name: "Control panel", say: "control panel · starts, watches and protects the set", move: [0, 24, 0] },
  stand: { name: "Enclosure frame", say: "", move: [0, 0, 0] },
};
const ORDER = ["engine", "alternator", "radiator", "silencer", "tank", "batteries", "heater", "panel"];
const STAGGER = ["silencer", "radiator", "alternator", "panel", "batteries", "heater", "engine", "tank", "stand"];
const SPRING = { stagger: 0.04, stiffness: 64, damping: 14.2, substeps: 4 };

const apartPoints = (corners, move) => corners.map((p) => G.add3(p, move));
const P = k.fitProjection(
  [
    ...k.boxCorners(PLINTH, -PLINTH_H, 0),
    [-POST.x, -POST.y, ROOF[1]],
    [POST.x, -POST.y, ROOF[1]],
    [POST.x, POST.y, ROOF[1]],
    [-POST.x, POST.y, ROOF[1]],
    [SIL.x0 + 14, SIL.y, SIL.z + 40 + PIECES.silencer.move[2]],
    ...apartPoints([[214, -48, 150], [214, 48, 34]], [0, 0, 0]),
    ...apartPoints([[-152, -40, 124], [-152, 40, 44]], PIECES.alternator.move),
  ],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const f2 = (v) => Math.round(v * 100) / 100;
const FADE = [0.04, 0.42];

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const record = R.solid;
const { nameFor } = R;

function put(piece, ref, svg, { bias = 0, shapes = [], name, route, chunk, attrs = "" } = {}) {
  return R.put({ piece, ride: piece, at: ref, bias, svg, move: PIECES[piece].move, shapes, name: name ?? nameFor(`${piece}.item`), route, chunk, attrs });
}

const XF = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const YF = (x, z) => G.frameOf([x, 0, z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);

function box(piece, name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.6, steps = 3, bevel = 0, extra = "", inner = "", bias = 0, owner } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  const id = nameFor(name);
  const shape = record(A.slab(plan, z0, z1 - z0, { name: id, owner }, steps));
  put(piece, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, { bias, name: id, shapes: [shape] });
  return shape;
}

// A prism along x whose section is a convex polygon in (y, z).
function prismX(piece, name, poly, x0, x1, style = {}, { extra = "", inner = "", bias = 0, owner } = {}) {
  const id = nameFor(name);
  const shape = record(A.prism(XF, poly, x0, x1, { name: id, owner }));
  const cy = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  put(piece, [(x0 + x1) / 2, cy, cz], S(G.prismOf(XF, poly, x0, x1, P), { tone: "mid", ...style, inner }) + extra, { bias, name: id, shapes: [shape] });
  return shape;
}

function turned(piece, name, F, profile, style = {}, { extra = "", inner = "", bias = 0, owner, steps, bevel = 0, rims, smooth } = {}) {
  const soft = smooth ?? (profile.some((p) => p[2]) ? { rows: 4 } : false);
  const paths = G.solidOf(profile, F, P, { bevel, smooth: soft, ...(steps ? { steps } : {}), ...(rims ? { rims } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const id = nameFor(name);
  const shape = record(A.solid(F, profile, { name: id, owner, curve: soft && !soft.slope ? profile : undefined }));
  put(piece, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner }) + extra, { bias, name: id, shapes: [shape] });
  return shape;
}

function disc(piece, name, F, s0, s1, r, style = {}, options = {}) {
  return turned(piece, name, F, [[s0, r], [s1, r]], style, options);
}

function ball(piece, name, c, r, style = {}, { bias = 0, owner } = {}) {
  const id = nameFor(name);
  const shape = record(A.ball(c, r, { name: id, owner }));
  put(piece, c, S(G.sphereOf(c, r, P, { steps: 36 }), { tone: "mid", ...style }), { bias, name: id, shapes: [shape] });
  return shape;
}

function padOn(piece, name, host, point, outward, a, h, { tone = "mid", bias = 0.1, owner, ring = false } = {}) {
  const inside = (p) => A.sdf(host, p) < 0;
  const axis = G.unit3(outward);
  const F = G.frameAlong(point, axis);
  const start = (angle) => {
    let lo = -2.5 * a;
    let hi = h;
    if (!inside(G.pointOf(F, lo, a, angle))) return 0;
    for (let step = 0; step < 40; step++) {
      const mid = (lo + hi) / 2;
      if (inside(G.pointOf(F, mid, a, angle))) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const low = Math.min(...Array.from({ length: 48 }, (_, index) => start((index / 48) * Math.PI * 2)));
  const id = nameFor(name);
  const face = ring && G.dot3(axis, V) > 0.15 ? Ln(G.circleOf(F, h, a * 0.55, P, 16), { tone: "faint" }) : "";
  put(piece, G.add3(point, G.mul3(axis, h / 2)), S(G.saddleOf(F, a, start, h, P), { tone }) + face, { bias, name: id, shapes: [record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: [host] }))] });
  return G.add3(point, G.mul3(axis, h));
}

function flangeAt(piece, name, centre, axis, r, thick, { bolts = 8, tone = "mid", owner, bias = 0 } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor(name);
  const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
  const face = Math.abs(G.dot3(F.a, V)) > 0.12 && bolts ? Dots(G.dotsOf(F, towards, r * 0.76, bolts, P, { all: true }), { size: 0.4, tone: "mid" }) : "";
  put(piece, centre, S(G.disc(-thick / 2, thick / 2, r, F, P), { tone }) + face, { bias, name: id, shapes: [record(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
}

const ROUTES = [];
function tubeItems(piece, name, route, r, { tone = "mid", bias = 0, maxLength = 16, spacing, gaps = [], caps = true, rims, free = [false, false], limp = false, owner, hot = false } = {}) {
  const id = nameFor(name);
  R.route(id, route, r, { owner: owner ?? id, limp, gaps, rims, free, piece, move: PIECES[piece].move, ride: piece });
  ROUTES.push({ id, piece, hot });
  tubePieces(route, r, P, { maxLength, spacing: spacing ?? Math.max(0.7, Math.min(2, r * 0.4)), gaps, caps }).forEach((part, index) =>
    put(piece, part.mid, tubeSvg(part, { tone }), { bias, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)], attrs: hot ? ` data-route="${id}"` : "" }),
  );
  return id;
}

function pipe(piece, name, control, r, { bend = 2.6, tone = "mid", flanges = [true, true], flangeR = 1.5, bands = [], bellows = null, free, bias = 0, maxLength = 18 } = {}) {
  const line = G.fillet(control, Math.max(r * bend, 3), r > 3 ? 18 : 10, { P, tube: r });
  const total = G.pathLength(line);
  const collars = [];
  [[0, -1], [total, 1]].forEach(([along, sign], index) => {
    if (!flanges[index]) return;
    const thick = Math.max(0.9, r * 0.5);
    const tangent = G.tangentAlong(line, along);
    collars.push({ kind: "flange", centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * flangeR, thick, gap: sign < 0 ? [0, thick] : [total - thick, total] });
  });
  const ring = (along, radius, thick, kind) => collars.push({ kind, centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius, thick, gap: [along - thick / 2, along + thick / 2] });
  for (const share of bands) ring(total * share, r * 1.2, Math.max(0.8, r * 0.45), "band");
  if (bellows) {
    const [from, to, count] = bellows;
    for (let index = 0; index < count; index++) ring(total * (from + ((to - from) * index) / (count - 1)), r * 1.24, Math.max(0.6, r * 0.22), "bellows");
  }
  const id = tubeItems(piece, name, line, r, { tone, bias, maxLength, gaps: collars.map(({ gap }) => gap), free, rims: flanges.map((on) => (on ? r * flangeR : r)) });
  for (const { kind, centre, tangent, radius, thick } of collars) flangeAt(piece, `${id}.${kind}`, centre, tangent, radius, thick, { bolts: kind === "flange" && r > 2.5 ? 8 : 0, tone: kind === "bellows" ? "lo" : "mid", owner: id, bias });
  return line;
}

const CABLES = [];
function cable(piece, name, points, r, { tone = "mid", bend = 3, shells = [false, false], free, hot = false, bias = 0.1 } = {}) {
  const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
  const total = G.pathLength(route);
  const SHELL = Math.max(1.6, r * 2.4);
  const gaps = [...(shells[0] ? [[0, SHELL]] : []), ...(shells[1] ? [[total - SHELL, total]] : [])];
  const id = tubeItems(piece, name, route, r, { tone, bias, maxLength: 14, spacing: Math.max(0.6, Math.min(1.4, r)), gaps, free, limp: true, rims: shells.map((on) => (on ? r * 1.8 : r)), hot });
  CABLES.push(id);
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    if (shells[index]) {
      const F = G.frameAlong(end, tangent);
      const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
      put(piece, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 1.8, F, P, { bevel: 0.2 }), { tone: "mid" }), { bias: bias + 0.1, name: `${id}.shell${index}`, shapes: [record(A.disc(F, s0, s1, r * 1.8, { name: `${id}.shell${index}`, owner: id }))] });
    } else {
      const size = Math.max(0.5, r * KS * 0.9);
      put(piece, end, Dots([at(end)], { size, tone: "hi" }), { bias: bias + 0.15, name: `${id}.end${index}`, shapes: [A.ball(end, size / KS, { name: `${id}.end${index}`, owner: id })] });
    }
  });
  return route;
}

function planeMatrix(o, ex, ey) {
  const p0 = at(o);
  const px = at(G.add3(o, ex));
  const py = at(G.add3(o, ey));
  const v = (x) => x.toFixed(4);
  return `matrix(${v(px[0] - p0[0])} ${v(px[1] - p0[1])} ${v(py[0] - p0[0])} ${v(py[1] - p0[1])} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)})`;
}
// Points on the vertical face y = Y, in (x, z).
const onY = (Y, pts) => pts.map(([x, z]) => [x, Y, z]);
const faceRect = (Y, x0, x1, z0, z1) => path3(onY(Y, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]), true);
const roundOnY = (Y, x0, x1, z0, z1, r = 1.2) => path3(onY(Y, k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 3)), true);
const roundOnX = (X, y0, y1, z0, z1, r = 1.2) => path3(k.roundedPlan({ x: y0, y: z0, w: y1 - y0, d: z1 - z0, r }, 3).map(([y, z]) => [X, y, z]), true);

// ---------------------------------------------------------------- plinth
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PLINTH, -PLINTH_H, PLINTH_H, P)}"/>`);
back.push(S(k.slabOf(PLINTH, -PLINTH_H, PLINTH_H, P, 3, 1.2), { tone: "lo", inner: Ln(k.sideSeam(PLINTH, -3, P, 3), { tone: "faint" }) }));
record(A.slab(PLINTH, -PLINTH_H, PLINTH_H, { name: "stand.plinth", ground: true }, 3));
back.push(Ln(k.planOutline(k.insetPlan(PLINTH, 4), 0, P, 3), { tone: "faint" }));
const ANCHORS = [[-180, 74], [-180, -70], [180, 74], [180, -70], [-40, 80], [60, 80]];
back.push(Ln(ANCHORS.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 14)).join(""), { tone: "lo" }), Dots(ANCHORS.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
// A painted walkway line and a floor ruler along the near edge, in 50 cm steps.
const STRIP = { x: -150, y: PLINTH.y + PLINTH.d - 7, w: 300, d: 4.5, r: 0.8 };
back.push(S(k.slabOf(STRIP, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(STRIP.x + 2.5, STRIP.x + STRIP.w - 2.5, 5, 5, STRIP.y, 0.5, [1.6, 3.2], P);
back.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));

// ---------------------------------------------------------------- base tank, skid and mounts
const tankSeam = Ln(k.sideSeam(TANK, 12, P, 3), { tone: "faint" });
box("tank", "tank.body", [TANK.x, TANK.y, 0], [TANK.x + TANK.w, TANK.y + TANK.d, TANK_H], { tone: "mid" }, { r: TANK.r, bevel: 0.6, inner: tankSeam, extra: Dots([-150, -100, -50, 0, 50, 100, 140].map((x) => at([x, 54, 21])), { size: 0.4, tone: "lo" }) });
const FILL = [-52, 54, 12];
disc("tank", "tank.fill-neck", G.frameAlong(FILL, [0, 1, 0]), 0, 4, 4.2, { tone: "mid" });
{
  const F = G.frameAlong(FILL, [0, 1, 0]);
  disc("tank", "tank.fill-cap", F, 4, 7, 5.4, { tone: "hi" }, { extra: Faded(G.ribsOf(F, 4, 7, 5.4, 30, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) + Ln(G.circleOf(F, 7, 2.2, P, 20), { tone: "faint" }), bias: 0.1 });
}
const GAUGE = [100, 54, 12];
{
  const F = G.frameOf(GAUGE, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const face = 2.4;
  const r = 6.4;
  const tick = (deg, r0, r1) => {
    const a = (deg * Math.PI) / 180;
    return path3([G.pointOf(F, face, r0, a), G.pointOf(F, face, r1, a)]);
  };
  const ticksD = [-130, -65, 0, 65, 130].map((deg) => tick(deg - 90, r - 1.2, r - 2.6)).join("");
  const needle = 0.95;
  disc("tank", "tank.gauge", F, 0, face, r, { tone: "hi" }, {
    extra: Ln(G.circleOf(F, face, r - 1.2, P, 40), { tone: "lo" }) + Ln(ticksD, { tone: "mid" }) + Ln(path3([G.pointOf(F, face, 0.8, (-130 + 260 * needle - 90) * (Math.PI / 180) + Math.PI), G.pointOf(F, face, r - 1.8, (-130 + 260 * needle - 90) * (Math.PI / 180))]), { tone: "hi", free: true }) + Dots([at(G.pointOf(F, face, 0, 0))], { size: 0.6, tone: "hi" }),
    bias: 0.1,
  });
}
{
  // Tank data plate: capacity and fuel grade, as rule lines.
  const face = TANK.y + TANK.d;
  const plate = [-138, -112, 6, 18];
  box("tank", "tank.plate", [plate[0], face, plate[2]], [plate[1], face + 0.5, plate[3]], { tone: "hi" }, {
    r: 0.3,
    extra: Ln(path3([[plate[0] + 2.4, face + 0.5, 15], [plate[1] - 5, face + 0.5, 15]]) + path3([[plate[0] + 2.4, face + 0.5, 12.4], [plate[1] - 2.4, face + 0.5, 12.4]]) + path3([[plate[0] + 2.4, face + 0.5, 9.8], [plate[1] - 9, face + 0.5, 9.8]]), { tone: "lo", free: true }) + Dots([at([plate[0] + 1.2, face + 0.5, 7.2]), at([plate[1] - 1.2, face + 0.5, 16.8])], { size: 0.4 }),
  });
}
disc("tank", "tank.drain", G.frameAlong([-140, 54, 3.5], [0, 1, 0]), 0, 1.8, 1.8, { tone: "mid" });
box("tank", "tank.vent", [110.8, 49.8, TANK_H], [113.2, 52.2, 58], { tone: "mid" }, { r: 1.2, steps: 4 });
turned("tank", "tank.vent-cap", G.frameAlong([112, 51, 58], [0, 0, 1]), [[0, 3.4], [1.4, 3.4], [2.6, 2.2], [3.2, 0]], { tone: "mid" });
for (const x of [66, 73]) disc("tank", "tank.port", G.frameAlong([x, TANK.y + TANK.d, 16], [0, 1, 0]), 0, 1.6, 2.2, { tone: "mid" }, { owner: `fuel${x}` });

for (const [y0, y1] of [RAIL_Y, [-RAIL_Y[1], -RAIL_Y[0]]]) {
  const rail = { x: -158, y: y0, w: 306, d: y1 - y0, r: 0.6 };
  box("tank", "tank.rail", [rail.x, y0, RAIL_Z[0]], [rail.x + rail.w, y1, RAIL_Z[1]], { tone: "mid" }, {
    bevel: 0.4,
    inner: Ln(k.sideSeam(rail, RAIL_Z[0] + 2.2, P, 3) + k.sideSeam(rail, RAIL_Z[1] - 2.2, P, 3), { tone: "faint" }),
    extra: y0 > 0 ? Ln([-150, 140].map((x) => roundOnY(y1, x - 4, x + 4, 26.6, 31.4, 2)).join(""), { tone: "lo" }) : "",
  });
}
const MOUNTS = [0, 90, -128, -66].flatMap((x) => [-43, 43].map((y) => [x, y]));
for (const [x, y] of MOUNTS) {
  box("tank", "tank.mount-plate", [x - 6, y - 5, RAIL_Z[1]], [x + 6, y + 5, RAIL_Z[1] + 1.2], { tone: "lo" }, { extra: Dots([at([x - 4.4, y + 3.4, RAIL_Z[1] + 1.2]), at([x + 4.4, y + 3.4, RAIL_Z[1] + 1.2])], { size: 0.4 }) });
  const F = G.frameAlong([x, y, RAIL_Z[1] + 1.2], [0, 0, 1]);
  turned("tank", "tank.mount-rubber", F, [[0, 4], [1, 4], [2.6, 3.3, 1], [4.2, 4]], { tone: "lo" });
  disc("tank", "tank.mount-cap", F, 4.2, MOUNT_TOP - RAIL_Z[1] - 1.2, 4.6, { tone: "mid" });
}

// ---------------------------------------------------------------- engine
const EO = "engine";
box("engine", "engine.pan", [-26, -24, 48], [106, 24, 64], { tone: "mid" }, { r: 2, inner: Ln(k.sideSeam({ x: -26, y: -24, w: 132, d: 48, r: 2 }, 62, P, 3), { tone: "faint" }), owner: EO });
disc("engine", "engine.pan-plug", G.frameAlong([60, 24, 51], [0, 1, 0]), 0, 1.2, 1.4, { tone: "mid" });
const DOORS = CYL.map((x) => roundOnY(30, x - 4.6, x + 4.6, 88, 97.6, 1.6)).join("");
const DOOR_BOLTS = CYL.flatMap((x) => [[x - 3.4, 30, 89.3], [x + 3.4, 30, 89.3], [x - 3.4, 30, 96.3], [x + 3.4, 30, 96.3]]);
box("engine", "engine.block", [-30, -30, 64], [104, 30, 100], { tone: "mid" }, { r: 1.2, bevel: 0.5, owner: EO, extra: Ln(DOORS, { tone: "lo" }) + Dots(DOOR_BOLTS.map(at), { size: 0.4, tone: "lo" }) });
box("engine", "engine.front-cover", [104, -30, 42], [112, 30, 112], { tone: "mid" }, { r: 2, bevel: 0.4, owner: EO, extra: Dots([[112, 26, 46], [112, 26, 108], [112, -26, 108]].map(at), { size: 0.4 }) });
for (const x of [0, 90]) {
  box("engine", "engine.foot", [x - 5, 30, MOUNT_TOP], [x + 5, 48, 50], { tone: "mid" }, { owner: EO, extra: Dots([at([x - 2.6, 43, 50]), at([x + 2.6, 43, 50])], { size: 0.4 }) });
  box("engine", "engine.foot-web", [x - 5, 30, 50], [x + 5, 33, 64], { tone: "mid" }, { owner: EO });
  box("engine", "engine.foot", [x - 5, -48, MOUNT_TOP], [x + 5, -30, 50], { tone: "mid" }, { owner: EO });
}

// The two banks of a 60° V, eight cylinders each, heads and rocker covers on top.
const bank = (side) => {
  const b = [side * 12, 96];
  const d = [side * 0.5, 0.866];
  const n = [0.866 * side, -0.5];
  const p = (along, across) => [b[0] + d[0] * along + n[0] * across, b[1] + d[1] * along + n[1] * across];
  return { p, d, n };
};
const order = (poly) => {
  const signed = poly.reduce((a, [x, y], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    return a + x * y2 - x2 * y;
  }, 0);
  return signed > 0 ? poly : [...poly].reverse();
};
for (const side of [-1, 1]) {
  const B = bank(side);
  const at100 = (across) => {
    const [y, z] = B.p(0, across);
    const t = (100 - z) / B.d[1];
    return [y + B.d[0] * t, 100];
  };
  const [yi, zi] = B.p(0, -13);
  const atY1 = [side * 1, zi + (side * 1 - yi) / B.d[0] * B.d[1]];
  prismX("engine", "engine.bank", order([[side * 1, 100], at100(13), B.p(30, 13), B.p(30, -13), atY1]), 2, 102, { tone: "mid" }, { owner: EO });
  for (const x of CYL) {
    prismX("engine", "engine.head", order([B.p(30, -12), B.p(30, 12), B.p(37, 12), B.p(37, -12)]), x - 5.8, x + 5.8, { tone: "mid" }, { owner: EO });
    const top = 41.5;
    const cover = order([B.p(37, -10), B.p(37, 10), B.p(top - 1, 10), B.p(top, 8.6), B.p(top, -8.6), B.p(top - 1, -10)]);
    const bolts = [-6.6, 6.6].flatMap((across) => [-3.4, 3.4].map((dx) => {
      const [y, z] = B.p(top, across);
      return [x + dx, y, z];
    }));
    const [cy, cz] = B.p(top, 0);
    const lid = path3([[x - 4.8, cy, cz], [x + 4.8, cy, cz]].map(([px, py, pz]) => [px, py, pz]));
    prismX("engine", "engine.rocker-cover", cover, x - 5, x + 5, { tone: "hi" }, { owner: EO, extra: Dots(bolts.map(at), { size: 0.4, tone: "mid" }) + Ln(lid, { tone: "faint" }) });
  }
}
// The exhaust manifolds lie in the V under one heat shield.
{
  const B = bank(1);
  const inner = (z) => {
    const [y0, z0] = B.p(0, -13);
    const [y1, z1] = B.p(30, -13);
    return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
  };
  const lo = 110;
  const hi = 125.5;
  const poly = order([[-inner(lo), lo], [inner(lo), lo], [inner(hi), hi], [-inner(hi), hi]]);
  const ribs = [10, 30, 50, 70, 90].map((x) => path3([[x, -inner(hi), hi], [x, inner(hi), hi]])).join("");
  prismX("engine", "engine.heat-shield", poly, -10, 100, { tone: "lo" }, { owner: EO, extra: Ln(ribs, { tone: "faint" }) });
}
box("engine", "engine.turbo-pedestal", [-26, -14, 100], [-10, 14, 124], { tone: "mid" }, { owner: EO, r: 1 });
// Twin turbochargers face each other across a ball crossover that feeds the exhaust up.
const XO = [-18, 0, 132];
ball("engine", "engine.crossover", XO, 6.5, { tone: "mid" }, { owner: EO });
// Turbine and compressor housings are sine bulges, shaded from their own slope.
const BULGES = [[8.6, 17.4, 6.4, 8.6], [20.4, 29.4, 7.2, 9.6]];
const bulgeAt = (s) => BULGES.find(([s0, s1]) => s > s0 && s < s1);
const turboSlope = (s) => {
  const b = bulgeAt(s);
  if (!b) return 0;
  const [s0, s1, r0, r1] = b;
  return ((r1 - r0) * Math.PI) / (s1 - s0) * Math.cos((Math.PI * (s - s0)) / (s1 - s0));
};
const bulge = ([s0, s1, r0, r1]) => Array.from({ length: 17 }, (_, i) => {
  const s = s0 + ((s1 - s0) * i) / 16;
  return [s, r0 + (r1 - r0) * Math.sin((Math.PI * i) / 16)];
});
const TURBO = [[5.12, 4], [8.6, 4], ...bulge(BULGES[0]), [17.4, 4], [20.4, 4], ...bulge(BULGES[1]), [29.4, 5], [33, 5]];
for (const side of [-1, 1]) {
  const F = G.frameOf(XO, [0, side, 0], [0, 0, 1], [1, 0, 0]);
  turned("engine", "engine.turbo", F, TURBO, { tone: "hi" }, { smooth: { slope: turboSlope, rows: 4 }, owner: EO, inner: Ln(G.arcOf(F, 13, 8.6, P) + G.arcOf(F, 25, 9.6, P), { tone: "faint" }) });
  const filter = [[33, 6], [36, 6], [36, 9.4], [53, 9.4], [53, 8.4], [54.6, 0]];
  turned("engine", "engine.air-filter", F, filter, { tone: "mid" }, { owner: EO, inner: Ln([39, 44, 49].map((s) => G.arcOf(F, s, 9.4, P)).join(""), { tone: "faint" }) });
}
const nozzleTop = XO[2] + Math.sqrt(6.5 ** 2 - 5 ** 2);
disc("engine", "engine.exhaust-stub", G.frameAlong([XO[0], XO[1], nozzleTop - 0.4], [0, 0, 1]), 0, 140 - nozzleTop + 0.4, 5, { tone: "mid" }, { owner: EO });
flangeAt("engine", "engine.exhaust-stub-flange", [XO[0], XO[1], 139.3], [0, 0, 1], 7.6, 1.4, { owner: EO });
disc("engine", "engine.flywheel-housing", G.frameAlong([-40, 0, CZ], [1, 0, 0]), 0, 10, 46, { tone: "mid" }, { owner: EO, extra: Dots(G.dotsOf(G.frameAlong([-40, 0, CZ], [1, 0, 0]), 10, 43, 24, P, { fade: FADE }), { size: 0.4 }) });
const STARTER = G.frameAlong([-30, 31, 58], [1, 0, 0]);
turned("engine", "engine.starter", STARTER, [[0, 5.4], [2, 5.4], [2, 5], [16, 5], [18, 4.2]], { tone: "hi" }, { owner: EO, inner: Ln(G.arcOf(STARTER, 9, 5, P), { tone: "faint" }) });
disc("engine", "engine.solenoid", G.frameAlong([-28, 38.5, 58], [1, 0, 0]), 0, 10, 2.5, { tone: "mid" }, { owner: EO });
disc("engine", "engine.starter-stud", G.frameAlong([-23, 41, 58], [0, 1, 0]), 0, 1.6, 1.8, { tone: "hi" }, { owner: EO });
box("engine", "engine.ecm", [-24, 30, 72], [-6, 36, 94], { tone: "hi" }, { owner: EO, r: 1, bevel: 0.4, extra: Ln(roundOnY(36, -21.6, -8.4, 75, 91, 1.4), { tone: "faint" }) + Dots([[-22.6, 36, 73.4], [-7.4, 36, 73.4], [-22.6, 36, 92.6], [-7.4, 36, 92.6]].map(at), { size: 0.4 }) });
disc("engine", "engine.ecm-plug", G.frameAlong([-15, 36, 82], [0, 1, 0]), 0, 2.4, 2.8, { tone: "mid" }, { owner: EO });
box("engine", "engine.oil-filter-head", [2, 30, 74], [38, 37, 80], { tone: "mid" }, { owner: EO });
for (const x of [8, 20, 32]) {
  const F = G.frameAlong([x, 34.5, 74], [0, 0, -1]);
  turned("engine", "engine.oil-filter", F, [[0, 3.4], [1.2, 4.2], [16, 4.2], [17.4, 3.4], [18, 0]], { tone: "hi" }, { owner: EO, inner: Ln(G.arcOf(F, 3, 4.2, P), { tone: "faint" }) });
}
box("engine", "engine.fuel-filter-head", [62, 30, 82], [84, 38, 88], { tone: "mid" }, { owner: EO });
for (const x of [68, 78]) {
  const F = G.frameAlong([x, 34, 82], [0, 0, -1]);
  turned("engine", "engine.fuel-filter", F, [[0, 3.2], [1, 3.8], [16, 3.8], [17.2, 3], [17.8, 0]], { tone: "hi" }, { owner: EO });
}
for (const [x, z] of [[46, 70], [58, 84]]) disc("engine", "engine.heater-port", G.frameAlong([x, 30, z], [0, 1, 0]), 0, 2, 2.2, { tone: "mid" }, { owner: EO });
disc("engine", "engine.ground-stud", G.frameAlong([100, 24, 52], [0, 1, 0]), 0, 1.6, 1.8, { tone: "hi" }, { owner: EO });
const PUMP = G.frameAlong([112, 24, 50], [1, 0, 0]);
turned("engine", "engine.water-pump", PUMP, [[0, 6.5], [5, 6.5], [5, 4.5], [7, 4.5]], { tone: "mid" }, { owner: EO });
disc("engine", "engine.fan-hub", G.frameAlong([112, 0, 92], [1, 0, 0]), 0, 6, 8, { tone: "mid" }, { owner: EO, extra: Dots(G.dotsOf(G.frameAlong([112, 0, 92], [1, 0, 0]), 6, 5.2, 6, P, { all: true }), { size: 0.4 }) });
disc("engine", "engine.thermostat", G.frameAlong([108, 0, 112], [0, 0, 1]), 0, 6, 4.4, { tone: "mid" }, { owner: EO });

// ---------------------------------------------------------------- alternator
const AO = "alt";
const ALT = G.frameOf([-46, 0, CZ], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
disc("alternator", "alt.adaptor", ALT, 0, 6, 44, { tone: "mid" }, { owner: AO, extra: Dots(G.dotsOf(ALT, 0, 41.5, 20, P, { fade: FADE }), { size: 0.4 }) });
disc("alternator", "alt.de-ring", ALT, 6, 12, 42, { tone: "hi" }, { owner: AO });
disc("alternator", "alt.nde-ring", ALT, 88, 94, 42, { tone: "hi" }, { owner: AO, extra: Dots(G.dotsOf(ALT, 91, 42, 28, P, { fade: FADE }), { size: 0.4 }) });
turned("alternator", "alt.frame", ALT, [[12, 40], [88, 40]], { tone: "hi" }, {
  owner: AO,
  inner: Ln(G.arcOf(ALT, 50, 40, P), { tone: "faint" }),
  extra: Faded(G.ribsOf(ALT, 16, 30, 40, 64, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }),
});
turned("alternator", "alt.end-bracket", ALT, [[94, 36], [99, 35], [103, 30.5], [106, 21], [107.6, 0]], { tone: "mid" }, { owner: AO });
for (const x of [-128, -66]) {
  box("alternator", "alt.bearer", [x - 5, -48, MOUNT_TOP], [x + 5, 48, 44.4], { tone: "mid" }, { owner: AO, extra: Dots([at([x - 2.6, 43, 44.4]), at([x + 2.6, 43, 44.4])], { size: 0.4 }) });
}
for (const x of [-62, -128]) box("alternator", "alt.lug", [x - 3, -2, 124], [x + 3, 2, 131], { tone: "mid" }, { owner: AO, r: 1.5, steps: 6 });
const TB = { x0: -108, x1: -80, y0: 40, y1: 61, z0: 64, z1: 104 };
{
  const face = TB.y1;
  const bolts = [[TB.x0 + 2, TB.z0 + 2], [TB.x1 - 2, TB.z0 + 2], [TB.x0 + 2, TB.z1 - 2], [TB.x1 - 2, TB.z1 - 2]].map(([x, z]) => at([x, face, z]));
  const lid = roundOnY(face, TB.x0 + 1.4, TB.x1 - 1.4, TB.z0 + 1.4, TB.z1 - 1.4, 1.6);
  const breaker = roundOnY(face, TB.x0 + 6, TB.x1 - 6, TB.z0 + 18, TB.z1 - 5, 1);
  const window = faceRect(face, TB.x0 + 9, TB.x1 - 9, TB.z0 + 27, TB.z1 - 9);
  const plate = faceRect(face, TB.x0 + 6, TB.x1 - 6, TB.z0 + 5, TB.z0 + 13);
  const rules = path3([[TB.x0 + 8, face, TB.z0 + 8.6], [TB.x1 - 12, face, TB.z0 + 8.6]]) + path3([[TB.x0 + 8, face, TB.z0 + 7], [TB.x1 - 16, face, TB.z0 + 7]]);
  box("alternator", "alt.terminal-box", [TB.x0, TB.y0, TB.z0], [TB.x1, TB.y1, TB.z1], { tone: "mid" }, {
    owner: AO,
    r: 1,
    bevel: 0.5,
    extra: Ln(lid, { tone: "faint" }) + Ln(breaker + plate, { tone: "lo" }) + Ln(window, { tone: "faint" }) + Ln(rules, { tone: "lo", free: true }) + Dots(bolts, { size: 0.45 }) + k.faceTextSvg(planeMatrix([TB.x0 + 8, face, TB.z0 + 10.6], [1, 0, 0], [0, 0, -1]), `${SET.kva} kVA`, { size: 1.9, tone: "mid" }),
  });
  box("alternator", "alt.breaker-handle", [(TB.x0 + TB.x1) / 2 - 1.6, TB.y1, TB.z0 + 21], [(TB.x0 + TB.x1) / 2 + 1.6, TB.y1 + 2.6, TB.z0 + 26], { tone: "hi" }, { owner: AO, r: 0.6 });
}
const PHASES = [-104, -97, -90, -83];
const PHASE_Y = 57.6;
for (const x of PHASES) disc("alternator", "alt.gland", G.frameAlong([x, PHASE_Y, TB.z0], [0, 0, -1]), 0, 1.6, 3.2, { tone: "mid" }, { owner: AO });

// ---------------------------------------------------------------- radiator
const RO = "rad";
const RX = [128, 144];
for (const side of [-1, 1]) box("radiator", "rad.side", [RX[0], side > 0 ? 42 : -48, RAIL_Z[1]], [RX[1], side > 0 ? 48 : -42, 148], { tone: "mid" }, { owner: RO, extra: Dots([40, 80, 120].map((z) => at([RX[1], side * 45, z])), { size: 0.4 }) });
box("radiator", "rad.bottom-tank", [RX[0], -42, RAIL_Z[1]], [RX[1], 42, 56], { tone: "mid" }, { owner: RO, inner: Ln(k.sideSeam({ x: RX[0], y: -42, w: 16, d: 84, r: 0.6 }, 52, P, 3), { tone: "faint" }) });
{
  const fins = [];
  for (let y = -40; y <= 40; y += 2.5) fins.push(path3([[RX[1] - 2, y, 56], [RX[1] - 2, y, 134]]));
  const rows = [];
  for (let z = 62; z < 134; z += 9) rows.push(path3([[RX[1] - 2, -42, z], [RX[1] - 2, 42, z]]));
  box("radiator", "rad.core", [RX[0] + 2, -42, 56], [RX[1] - 2, 42, 134], { tone: "lo" }, { owner: RO, r: 0.2, extra: Ln(fins.join(""), { tone: "faint" }) + Ln(rows.join(""), { tone: "lo" }) });
}
box("radiator", "rad.top-tank", [RX[0], -42, 134], [RX[1], 42, 146], { tone: "mid" }, { owner: RO, bevel: 0.4, inner: Ln(k.sideSeam({ x: RX[0], y: -42, w: 16, d: 84, r: 0.6 }, 138, P, 3), { tone: "faint" }) });
disc("radiator", "rad.filler-neck", G.frameAlong([136, 20, 146], [0, 0, 1]), 0, 3, 3, { tone: "mid" }, { owner: RO });
{
  const F = G.frameAlong([136, 20, 149], [0, 0, 1]);
  disc("radiator", "rad.cap", F, 0, 2.6, 4.2, { tone: "hi" }, { owner: RO, extra: Faded(G.ribsOf(F, 0, 2.6, 4.2, 26, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) });
}
const SHROUD = G.frameAlong([118, 0, 92], [1, 0, 0]);
{
  const paths = G.lathe([[0, 40], [0, 42], [10, 42], [10, 40]], SHROUD, P, { steps: 96 });
  const id = nameFor("rad.shroud");
  put("radiator", G.add3(SHROUD.o, [5, 0, 0]), S(paths, { tone: "mid" }), { name: id, shapes: [record(A.ring(SHROUD, 0, 10, 40, 42, { name: id, owner: RO }))] });
}
box("radiator", "rad.sight-glass", [RX[1], 26, 138], [RX[1] + 1, 32, 143], { tone: "hi" }, { owner: RO, r: 0.6 });

// Coolant hoses, carried by the radiator: top hose from the thermostat, bottom hose to the pump.
pipe("radiator", "rad.top-hose", [[108, 0, 118], [108, 0, 140], [RX[0], 0, 140]], 3, { flangeR: 1.35, bands: [0.12, 0.9], free: [true, false] });
pipe("radiator", "rad.bottom-hose", [[119, 24, 50], [RX[0], 24, 50]], 3, { flangeR: 1.35, bands: [0.5], free: [true, false] });

// ---------------------------------------------------------------- jacket-water heater
const HEAT = G.frameAlong([42, 43, 44], [1, 0, 0]);
const heaterBody = turned("heater", "heater.body", HEAT, [[0, 0], [0, 4.4], [0.8, 5], [19.2, 5], [20, 4.4], [20, 0]], { tone: "hi" }, { owner: "heater", inner: Ln(G.arcOf(HEAT, 10, 5, P), { tone: "faint" }) });
box("heater", "heater.box", [50, 47.6, 40.6], [56, 50, 47.4], { tone: "mid" }, { owner: "heater", r: 0.6 });
for (const x of [46, 58]) box("heater", "heater.saddle", [x - 2, 39, RAIL_Z[1]], [x + 2, 47, 39], { tone: "mid" }, { owner: "heater" });
for (const [x, z] of [[46, 70], [58, 84]]) {
  const top = padOn("heater", "heater.pad", heaterBody, [x, 43, 48.4], [0, 0, 1], 2.6, 2, { owner: "heater" });
  pipe("heater", "heater.hose", [top, [x, 43, z], [x, 32, z]], 1.6, { flangeR: 1.4, free: [false, true] });
}

// ---------------------------------------------------------------- fuel lines (tank to filter head)
for (const [x, z, name] of [[66, 85, "tank.fuel-supply"], [73, 86, "tank.fuel-return"]]) {
  const BALL = 2.6;
  const c = [x, TANK.y + TANK.d + 1.6 + Math.sqrt(BALL ** 2 - 2.2 ** 2), 16];
  ball("tank", `${name}-elbow`, c, BALL, { tone: "mid" }, { owner: `fuel${x}` });
  const y = c[1];
  pipe("tank", name, [[x, y, c[2] + Math.sqrt(BALL ** 2 - 0.95 ** 2)], [x, y, z], [x, 38, z]], 0.95, { flangeR: 1.6, flanges: [false, true], bands: [0.4] });
}

// ---------------------------------------------------------------- silencer on the roof
const SO = "sil";
const SILF = G.frameOf([SIL.x1, SIL.y, SIL.z], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
const silLen = SIL.x1 - SIL.x0;
// A flat-ended drum: the inlet comes in through the end facing the engine.
const silShape = turned("silencer", "sil.body", SILF, [[0, SIL.r - 1.6], [1.6, SIL.r], [silLen - 1.6, SIL.r], [silLen, SIL.r - 1.6]], { tone: "hi" }, { owner: SO, inner: Ln([1.6, 30, 63, 96, silLen - 1.6].map((s) => G.arcOf(SILF, s, SIL.r, P)).join(""), { tone: "faint" }), extra: Dots(G.dotsOf(SILF, 0, SIL.r - 3.4, 16, P, { all: true }), { size: 0.4 }) + Ln(G.circleOf(SILF, 0, 9.5, P, 48), { tone: "faint" }) });
disc("silencer", "sil.inlet", G.frameAlong([SIL.x1, SIL.y, SIL.z], [1, 0, 0]), 0, 6, 6, { tone: "mid" }, { owner: SO });
flangeAt("silencer", "sil.inlet-flange", [SIL.x1 + 6.7, SIL.y, SIL.z], [1, 0, 0], 8.4, 1.4, { owner: SO });
disc("silencer", "sil.drain", G.frameAlong([SIL.x0 + 10, SIL.y, SIL.z - SIL.r + 0.4], [0, 0, -1]), 0, 2.4, 1.6, { tone: "mid" }, { owner: SO });
const TAIL = [-152, SIL.y];
const tailTop = padOn("silencer", "sil.outlet-pad", silShape, [TAIL[0], TAIL[1], SIL.z + SIL.r - 1], [0, 0, 1], 6.4, 2.6, { owner: SO });
disc("silencer", "sil.tailpipe", G.frameAlong(tailTop, [0, 0, 1]), 0, 16, 5, { tone: "mid" }, { owner: SO, inner: Ln(G.arcOf(G.frameAlong(tailTop, [0, 0, 1]), 4, 5, P), { tone: "faint" }) });
const CAP_Z = tailTop[2] + 16;
box("silencer", "sil.hinge", [TAIL[0] - 6.6, TAIL[1] - 1.6, CAP_Z - 3], [TAIL[0] - 5, TAIL[1] + 1.6, CAP_Z + 0.6], { tone: "mid" }, { owner: SO, r: 0.4 });
const FLAP = { hinge: [TAIL[0] - 5, TAIL[1], CAP_Z + 0.6], r: 5.8, t: 0.7 };
const flapFrame = (deg) => {
  const a = (deg * Math.PI) / 180;
  const axis = [-Math.sin(a), 0, Math.cos(a)];
  const along = [Math.cos(a), 0, Math.sin(a)];
  return { F: G.frameAlong(G.add3(FLAP.hinge, G.mul3(along, FLAP.r)), axis), axis };
};
const flapPaths = (deg) => G.disc(0, FLAP.t, FLAP.r, flapFrame(deg).F, P, { steps: 40 });
{
  const { F } = flapFrame(0);
  const id = nameFor("sil.flap");
  put("silencer", F.o, `<g data-part="flap">${S(flapPaths(0), { tone: "hi" })}</g>`, { name: id, bias: 0.3, shapes: [record(A.disc(F, 0, FLAP.t, FLAP.r, { name: id, owner: SO }))] });
}

// Exhaust: crossover stub up through bellows and over to the silencer inlet.
{
  // The turn toward the silencer happens inside a cast elbow, so it never pinches on screen.
  const ELBOW = [XO[0], SIL.y, SIL.z];
  const EB = 7;
  const rim = Math.sqrt(EB ** 2 - 5 ** 2);
  ball("silencer", "sil.elbow", ELBOW, EB, { tone: "mid" }, { owner: SO });
  pipe("silencer", "sil.exhaust", [[XO[0], 0, 140], [XO[0], 0, SIL.z], [XO[0], SIL.y + rim, SIL.z]], 5, { bend: 2.4, flangeR: 1.52, flanges: [true, false], bellows: [0.14, 0.4, 7], free: [true, false], maxLength: 14 });
  pipe("silencer", "sil.tail-in", [[XO[0] - rim, SIL.y, SIL.z], [SIL.x1 + 7.4, SIL.y, SIL.z]], 5, { flangeR: 1.52, flanges: [false, true], maxLength: 14 });
}

// ---------------------------------------------------------------- enclosure frame and roof bearers
for (const [x, y] of [[-POST.x, -POST.y], [POST.x, -POST.y], [-POST.x, POST.y], [POST.x, POST.y]]) {
  box("stand", "stand.post", [x - POST.half, y - POST.half, 1.2], [x + POST.half, y + POST.half, ROOF[0]], { tone: "mid" }, {
    r: 0.4,
    extra: Dots([at([x - 2, y + POST.half, 6]), at([x + 2, y + POST.half, 6])], { size: 0.4 }),
  });
  box("stand", "stand.post-foot", [x - 5.4, y - 5.4, 0], [x + 5.4, y + 5.4, 1.2], { tone: "lo" }, { r: 0.4 });
}
for (const x of [-POST.x, POST.x]) box("stand", "stand.end-beam", [x - POST.half, -POST.y - POST.half, ROOF[0]], [x + POST.half, POST.y + POST.half, ROOF[1]], { tone: "mid" }, { r: 0.4, bevel: 0.3 });
box("stand", "stand.far-beam", [-POST.x + POST.half, -POST.y - POST.half, ROOF[0]], [POST.x - POST.half, -POST.y + POST.half, ROOF[1]], { tone: "mid" }, { r: 0.4 });
for (const y of [SIL.y - 12, SIL.y + 12]) box("stand", "stand.purlin", [-POST.x + POST.half, y - 3, ROOF[0]], [POST.x - POST.half, y + 3, ROOF[1]], { tone: "mid" }, { r: 0.4, bevel: 0.3 });
for (const x of BEARERS) box("stand", "stand.cradle", [x - 4.4, SIL.y - 17, ROOF[1]], [x + 4.4, SIL.y + 17, SIL.z - SIL.r], { tone: "lo" }, { r: 0.6, extra: Dots([-14, 14].flatMap((y) => [at([x - 2.6, SIL.y + y, SIL.z - SIL.r]), at([x + 2.6, SIL.y + y, SIL.z - SIL.r])]), { size: 0.4 }) });

// ---------------------------------------------------------------- output cables to the switchgear
box("stand", "stand.trench-plate", [-110, 54.3, 0], [-77, 61.5, 1.2], { tone: "lo" }, { r: 0.4, extra: Dots([at([-108.4, 60.3, 1.2]), at([-78.6, 60.3, 1.2])], { size: 0.4 }) });
for (const x of PHASES) {
  cable("stand", "stand.phase", [[x, PHASE_Y, 1.2], [x, PHASE_Y, TB.z0 - 1.6]], 1.7, { tone: "mid", shells: [true, true], free: [false, true], hot: true });
}

// ---------------------------------------------------------------- starter batteries
const TRAY = { x: 20, y: 62, w: 68, d: 18, r: 0.8 };
box("batteries", "bat.tray", [TRAY.x, TRAY.y, 0], [TRAY.x + TRAY.w, TRAY.y + TRAY.d, 2], { tone: "lo" }, { r: 0.8 });
const BATS = [0, 1, 2, 3].map((i) => 22 + 16.5 * i);
BATS.forEach((x0, i) => {
  const plan = { x: x0, y: 64, w: 15, d: 14, r: 0.8 };
  box("batteries", "bat.case", [x0, 64, 2], [x0 + 15, 78, 15], { tone: "mid" }, { r: 0.8, inner: Ln(k.sideSeam(plan, 13, P, 3), { tone: "faint" }), extra: Ln(roundOnY(78, x0 + 2.4, x0 + 12.6, 4, 10, 0.6), { tone: "faint" }) });
  box("batteries", "bat.lid", [x0 + 0.4, 64.4, 15], [x0 + 14.6, 77.6, 16.4], { tone: "mid" }, { r: 0.6, extra: Dots([0, 1, 2, 3, 4, 5].map((j) => at([x0 + 2.2 + j * 2.12, 74.2, 16.4])), { size: 0.45, tone: "lo" }) });
  for (const dx of [3.5, 11.5]) disc("batteries", "bat.post", G.frameAlong([x0 + dx, 67.5, 16.4], [0, 0, 1]), 0, 1.8, 1.1, { tone: "hi" });
  if (i < 3) box("batteries", "bat.link", [x0 + 11, 66.6, 18.2], [x0 + 16.5 + 4, 68.4, 18.8], { tone: "hi" }, { r: 0.4 });
});
cable("batteries", "bat.positive", [[BATS[0] + 3.5, 67.5, 18.2], [BATS[0] + 3.5, 67.5, 26], [BATS[0] + 3.5, 57.5, 26], [-23, 57.5, 26], [-23, 57.5, 58], [-23, 42.6, 58]], 0.95, { tone: "hi", bend: 3.4, shells: [false, true], free: [false, true], hot: true });
cable("batteries", "bat.negative", [[BATS[3] + 11.5, 67.5, 18.2], [BATS[3] + 11.5, 67.5, 26], [BATS[3] + 11.5, 57.5, 26], [100, 57.5, 26], [100, 57.5, 52], [100, 25.6, 52]], 0.95, { tone: "mid", bend: 3.4, shells: [false, true], free: [false, true] });

// ---------------------------------------------------------------- control panel
const CP = { x0: -178, x1: -148, y0: 70, y1: 80, z0: 72, z1: 118 };
box("panel", "panel.base", [-169, 71, 0], [-157, 79, 1.4], { tone: "lo" }, { r: 0.4, extra: Dots([at([-167.6, 78, 1.4]), at([-158.4, 78, 1.4])], { size: 0.4 }) });
box("panel", "panel.pedestal", [-165, 73, 1.4], [-161, 77, CP.z0], { tone: "mid" }, { r: 0.4 });
const DISPLAY = { x0: CP.x0 + 3, x1: CP.x1 - 3, z0: CP.z1 - 19, z1: CP.z1 - 6 };
{
  const face = CP.y1;
  const door = roundOnY(face, CP.x0 + 1.6, CP.x1 - 1.6, CP.z0 + 1.6, CP.z1 - 1.6, 1.4);
  const vents = [0, 1, 2, 3].map((i) => roundOnY(face, CP.x0 + 6, CP.x1 - 6, CP.z0 + 4 + i * 2.2, CP.z0 + 4.9 + i * 2.2, 0.4)).join("");
  const hinge = [CP.z0 + 8, CP.z1 - 8].map((z) => path3([[CP.x0 + 1.6, face, z - 2], [CP.x0 + 1.6, face, z + 2]])).join("");
  box("panel", "panel.box", [CP.x0, CP.y0, CP.z0], [CP.x1, CP.y1, CP.z1], { tone: "mid" }, { r: 1, bevel: 0.5, extra: Ln(door, { tone: "faint" }) + Ln(vents, { tone: "faint" }) + Ln(hinge, { tone: "mid" }) });
  box("panel", "panel.hood", [CP.x0 - 1, CP.y0 - 1, CP.z1], [CP.x1 + 1, CP.y1 + 2.4, CP.z1 + 1.4], { tone: "mid" }, { r: 0.6 });
}
for (const [i, x] of [CP.x0 + 8, CP.x0 + 13, CP.x0 + 18].entries()) disc("panel", "panel.button", G.frameAlong([x, CP.y1, CP.z1 - 26], [0, 1, 0]), 0, 1.2, 1.6, { tone: i === 0 ? "hi" : "mid" });
{
  const F = G.frameAlong([CP.x1 - 7, CP.y1, CP.z1 - 26], [0, 1, 0]);
  disc("panel", "panel.estop-collar", F, 0, 1, 3.2, { tone: "mid" });
  turned("panel", "panel.estop", F, [[1, 2.6], [2, 2.6], [2.4, 3.4], [3.6, 3.4], [4.2, 2.6], [4.5, 0]], { tone: "hi" });
}
disc("panel", "panel.key", G.frameAlong([CP.x0 + 8, CP.y1, CP.z0 + 15], [0, 1, 0]), 0, 1.4, 2, { tone: "mid" }, { extra: Ln(path3([[CP.x0 + 7, CP.y1 + 1.4, CP.z0 + 15], [CP.x0 + 9, CP.y1 + 1.4, CP.z0 + 15]]), { tone: "hi", free: true }) });

// The panel's display, drawn in the plane of its face.
const DISP_MATRIX = planeMatrix([DISPLAY.x0, CP.y1 + 0.05, DISPLAY.z1], [1, 0, 0], [0, 0, -1]);
const DW = DISPLAY.x1 - DISPLAY.x0;
const DH = DISPLAY.z1 - DISPLAY.z0;
{
  const screen = `<g transform="${DISP_MATRIX}"><rect class="gs-screen" x="0" y="0" width="${DW}" height="${DH}" rx="0.8"/>` +
    `<text class="gs-digits" data-part="disp-a" x="${DW - 1.4}" y="${DH * 0.42}" font-size="${(DH * 0.26).toFixed(2)}" text-anchor="end">0 rpm</text>` +
    `<text class="gs-digits gs-small" data-part="disp-b" x="${DW - 1.4}" y="${DH * 0.8}" font-size="${(DH * 0.19).toFixed(2)}" text-anchor="end">AUTO</text>` +
    `<circle class="gs-led" data-part="led" cx="2" cy="${(DH * 0.32).toFixed(2)}" r="0.9"/></g>`;
  const id = nameFor("panel.display");
  put("panel", [(DISPLAY.x0 + DISPLAY.x1) / 2, CP.y1, (DISPLAY.z0 + DISPLAY.z1) / 2], screen, { name: id, bias: 0.4, shapes: [record(A.box([DISPLAY.x0, CP.y1, DISPLAY.z0], [DISPLAY.x1, CP.y1 + 0.1, DISPLAY.z1], { name: id }))] });
}

// ---------------------------------------------------------------- settle and write
const tankLitres = ((TANK.w - 2) * (TANK.d - 2) * (TANK_H - 2) * 8) / 1000 * 0.95;
PIECES.tank.say = `base tank · ${Math.round(tankLitres / 100) * 100} L of diesel · ${fuelHours(tankLitres).toFixed(0)} h at ${SET.load.toLocaleString("en-US")} kW`;

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-name="${item.name}" data-k="${item.key.toFixed(2)}" data-m="${mx},${my},${mz}" data-i="${index}"${item.attrs ?? ""}>${item.svg}</g>`;
});

const LABEL =
  "A 2,500 kVA standby diesel generator set as it stands in a data-centre generator hall, with its enclosure panels off. On a concrete plinth: a base fuel tank carrying the skid rails and rubber mounts; a V16 diesel engine with twin turbochargers, air filters, filters, starter and engine controller; the alternator bolted to its flywheel housing, with a terminal box and main breaker whose output cables drop into a floor trench; the radiator with its fan shroud and hoses; a jacket-water heater; starter batteries; a control panel on a pedestal; and an exhaust silencer on the roof bearers with a rain cap.";

const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [...back, `<g class="gs-set">${groups.join("")}</g>`] });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  P,
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say }])),
  order: ORDER,
  stagger: STAGGER,
  spring: SPRING,
  flap: FLAP,
  litres: tankLitres,
  hot: ROUTES.filter((r) => r.hot).map((r) => ({ id: r.id, piece: r.piece })),
};

const PARTS = ORDER.map((id, index) => `<button type="button" class="gs-part" data-part="${id}"><span class="gs-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Standby generator · data centre</span><span class="iso-plate-corner" data-corner="readout" data-readout>standby · coolant ${SET.coolant} °C</span></div>`;
const controls = `<div class="gs-controls"><button type="button" class="gs-run" data-run><span class="gs-lamp" aria-hidden="true"></span><span data-run-label>Cut the mains</span></button><span class="gs-hint">Hover the set to take it apart</span><span class="gs-sr" aria-live="polite" data-live></span></div>`;
const stage = `<div class="gs-stage" tabindex="0" role="slider" aria-label="Standby generator set. Hover or use the arrow keys to take it apart part by part; press S or the button to cut the mains and watch it start, Escape to put it back together." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="Assembled, on standby">${svg}</div>`;
const caption =
  `A typical ${SET.kva.toLocaleString("en-US")} kVA (${SET.kw.toLocaleString("en-US")} kW) standby set, about 6.4 m long. The UPS batteries carry the data hall for the first seconds of a mains failure; the generator has to take over before they run down. The controller waits ${T.detect.toFixed(0)} s to be sure the mains is really gone, the ${SET.battery} V starter turns the engine at about ${SET.crankRpm} rpm, it fires and runs up to ${SET.rpm.toLocaleString("en-US")} rpm, and with four poles that is ${SET.hz} Hz. Once the voltage is up the transfer switch moves the load across, ${T.transfer.toFixed(1)} s after the failure, inside the 10 s the standard allows. Taking ${SET.load.toLocaleString("en-US")} kW all at once pulls the speed down for a moment before the governor catches it. The jacket-water heater keeps the engine warm so it can do this from cold, and the base tank holds about ${Math.round(tankLitres / 100) * 100} L, ${fuelHours(tankLitres).toFixed(0)} hours at that load. The four output cables stand for the parallel runs a real set needs to carry ${Math.round(SET.amps).toLocaleString("en-US")} A a phase.`;
const body = `<figure class="iso-figure gs"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="gs-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "genset.css"), "utf8");
const latheSource = readFileSync(join(KIT, "lathe.mjs"), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const latheScript = `const G = (() => {${latheSource}\nreturn { disc, frameAlong, add3, mul3 };})();\n`;
const modelScript = readFileSync(join(HERE, "genset.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Standby generator", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + latheScript + modelScript + LIVE, width: 900 });
const name = THEME === "light" ? "generator-light.html" : "generator.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `${CABLES.length} cables`, `scale ${KS.toFixed(3)}`, `tank ${tankLitres.toFixed(0)} L`);

A.auditOrExit(R, P, {});
