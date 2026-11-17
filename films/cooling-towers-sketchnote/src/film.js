// Sketchnote film engine: everything is a pure function of time t via window.render(t)
window.FILM_READY = (async function () {
  await document.fonts.load('700 100px Caveat');
  await document.fonts.load('400 100px Caveat');
  await document.fonts.load('100px "Patrick Hand"');
  await document.fonts.ready;

  const NS = 'http://www.w3.org/2000/svg';
  const world = document.getElementById('world');
  const hud = document.getElementById('hud');
  const rc = rough.svg(world);
  const C = {
    ink: '#2a2a2a', red: '#e4572e', blue: '#2d7dd2', lblue: '#8ec3ee', yel: '#ffd23f',
    teal: '#17a398', grey: '#9a948a', lgrey: '#cfc6b2', orange: '#f08a24', paper: '#fbf6ea',
    green: '#4fa35a', pink: '#f7a6a0', white: '#fffdf7'
  };
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const easeOut = u => 1 - Math.pow(1 - u, 3);

  const PW = 1920, PH = 1080, WW = PW * 3, WH = PH * 3;
  const defs = el('defs', {}, world);
  const pat = el('pattern', { id: 'dots', width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
  el('circle', { cx: 20, cy: 20, r: 1.7, fill: '#d8cfbb' }, pat);
  el('rect', { x: -3000, y: -3000, width: WW + 6000, height: WH + 6000, fill: 'url(#dots)' }, world);
  const linksG = el('g', {}, world);

  // ---------- panels & primitives ----------
  let P = null;
  const LINKP = { ox: 0, oy: 0, main: linksG, under: linksG };
  function panel(col, row) {
    const g = el('g', { transform: `translate(${col * PW},${row * PH})` }, world);
    P = { g, under: el('g', {}, g), main: el('g', {}, g), ox: col * PW, oy: row * PH, col, row };
    return P;
  }
  let SEED = 11;
  const O = (o = {}) => Object.assign({
    stroke: C.ink, strokeWidth: 4, roughness: 1.25, bowing: 1.1, seed: SEED++,
    fillWeight: 2.4, hachureGap: 12, hachureAngle: -41
  }, o);
  function add(node, o) { node._o = o; node._P = P; P.main.appendChild(node); return node; }
  const R = {
    rect: (x, y, w, h, o) => { o = O(o); return add(rc.rectangle(x, y, w, h, o), o); },
    line: (x1, y1, x2, y2, o) => { o = O(o); return add(rc.line(x1, y1, x2, y2, o), o); },
    circle: (x, y, d, o) => { o = O(o); return add(rc.circle(x, y, d, o), o); },
    ellipse: (x, y, w, h, o) => { o = O(o); return add(rc.ellipse(x, y, w, h, o), o); },
    path: (d, o) => { o = O(o); return add(rc.path(d, o), o); },
    poly: (pts, o) => { o = O(o); return add(rc.polygon(pts, o), o); },
    curve: (pts, o) => { o = O(o); return add(rc.curve(pts, o), o); },
    lin: (pts, o) => { o = O(o); return add(rc.linearPath(pts, o), o); },
  };
  function grp(...nodes) {
    const g = el('g', {}, P.main); g._P = P;
    nodes.flat().forEach(n => g.appendChild(n));
    return g;
  }
  function text(str, x, y, { size = 48, font = 'hand', color = C.ink, anchor = 'start', weight, rot = 0, parent } = {}) {
    const fam = font === 'title' ? 'Caveat' : 'Patrick Hand';
    const w = weight || (font === 'title' ? 700 : 400);
    const t = el('text', { x, y, 'font-family': fam, 'font-size': size, 'font-weight': w, fill: color, 'text-anchor': anchor }, parent || P.main);
    if (rot) t.setAttribute('transform', `rotate(${rot} ${x} ${y})`);
    t.textContent = str; t._P = P;
    return t;
  }

  // ---------- timeline ----------
  const anims = [], loops = [];
  let T = 0;
  const wait = s => { T += s; };
  const SPD = 0.62;
  function D(node, dur, gap = 0.06) { dur *= SPD; anims.push({ k: 'draw', node, t0: T, dur, P: node._P || P }); T += dur + gap; return node; }
  function W(node, dur, gap = 0.06) {
    if (dur == null) dur = Math.max(0.3, Math.min(1.5, node.textContent.length * 0.024 * Math.sqrt(parseFloat(node.getAttribute('font-size')) / 50))); else dur *= SPD;
    anims.push({ k: 'write', node, t0: T, dur, P: node._P || P }); T += dur + gap; return node;
  }
  function F(node, dur = 0.4, gap = 0) { anims.push({ k: 'fade', node, t0: T, dur }); T += dur + gap; return node; }
  function POP(node, dur = 0.45, gap = 0) { anims.push({ k: 'pop', node, t0: T, dur }); T += dur + gap; return node; }
  function HL(x, y, w, h, color = C.yel, dur = 0.35, gap = 0, op = 0.55) {
    const r = el('rect', { x, y, width: w, height: h, rx: h * 0.3, fill: color, opacity: op, transform: `rotate(-0.8 ${x} ${y})` }, P.under);
    anims.push({ k: 'grow', node: r, t0: T, dur, w }); T += dur + gap; return r;
  }
  const loop = (t0, fn) => loops.push({ t0, fn });

  // ---------- shape helpers ----------
  function arrowHead(x2, y2, ang, head, color, sw) {
    const a1 = ang + Math.PI - 0.5, a2 = ang + Math.PI + 0.5;
    return R.lin([[x2 + Math.cos(a1) * head, y2 + Math.sin(a1) * head], [x2, y2], [x2 + Math.cos(a2) * head, y2 + Math.sin(a2) * head]],
      { stroke: color, strokeWidth: sw, roughness: 0.8 });
  }
  function arrow(x1, y1, x2, y2, { bend = 0, color = C.ink, sw = 4, head = 26 } = {}) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const cx = mx - dy / L * bend, cy = my + dx / L * bend;
    const body = R.path(`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`, { stroke: color, strokeWidth: sw, roughness: 1.0 });
    const ang = Math.atan2(y2 - cy, x2 - cx);
    return grp(body, arrowHead(x2, y2, ang, head, color, sw));
  }
  function wave(x1, y1, x2, y2, { amp = 12, n = 3, color = C.red, sw = 4, head = 0 } = {}) {
    const pts = [], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    for (let i = 0; i <= 24; i++) { const u = i / 24, s = Math.sin(u * n * Math.PI * 2) * amp; pts.push([x1 + dx * u + nx * s, y1 + dy * u + ny * s]); }
    const c = R.curve(pts, { stroke: color, strokeWidth: sw, roughness: 0.6 });
    if (!head) return c;
    const [ax, ay] = pts[pts.length - 2];
    return grp(c, arrowHead(x2, y2, Math.atan2(y2 - ay, x2 - ax), head, color, sw));
  }
  function cloudPath(cx, cy, w, h, n = 8) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = Math.PI + i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * w / 2, cy + Math.sin(a) * h / 2]); }
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i <= n; i++) {
      const p = pts[i % n], q = pts[i - 1], r = Math.hypot(p[0] - q[0], p[1] - q[1]) * 0.58;
      d += ` A${r} ${r} 0 0 1 ${p[0]} ${p[1]}`;
    }
    return d + ' Z';
  }
  const cloud = (cx, cy, w, h, o = {}) => R.path(cloudPath(cx, cy, w, h, o.n || 8), Object.assign({ fill: C.white, fillStyle: 'solid' }, o));
  function dropPath(cx, y, s) {
    const r = s * 0.55;
    return `M${cx} ${y} C${cx + s * 0.08} ${y + s * 0.35} ${cx + r} ${y + s * 0.5} ${cx + r} ${y + s * 0.82} A${r} ${r} 0 0 1 ${cx - r} ${y + s * 0.82} C${cx - r} ${y + s * 0.5} ${cx - s * 0.08} ${y + s * 0.35} ${cx} ${y} Z`;
  }
  const drop = (cx, y, s, o = {}) => R.path(dropPath(cx, y, s), Object.assign({ stroke: C.blue, fill: C.lblue, fillStyle: 'solid' }, o));
  function badge(n, x, y, color = C.yel, d = 92) {
    const c = R.circle(x, y, d, { fill: color, fillStyle: 'solid', strokeWidth: 3.5 });
    const t = text(String(n), x, y + d * 0.24, { size: d * 0.7, font: 'title', anchor: 'middle' });
    return [c, t];
  }
  function heading(n, str, x = 120, y = 150, size = 96, color = C.yel) {
    const [c, t] = badge(n, x + 40, y - 30, color);
    const h = text(str, x + 115, y, { size, font: 'title' });
    D(c, 0.35); W(t, 0.25);
    const bb = h.getBBox();
    HL(bb.x - 10, y - size * 0.28, bb.width + 20, size * 0.36, color, 0.4, -0.4, 0.5);
    W(h);
    return h;
  }
  function tick(x, y, s = 60, color = C.green) {
    return R.lin([[x, y], [x + s * 0.35, y + s * 0.4], [x + s, y - s * 0.45]], { stroke: color, strokeWidth: 7, roughness: 0.9 });
  }
  function cross(x, y, s = 80, color = C.red) {
    return grp(R.line(x - s, y - s, x + s, y + s, { stroke: color, strokeWidth: 8 }), R.line(x + s, y - s, x - s, y + s, { stroke: color, strokeWidth: 8 }));
  }

  // fan: circle + blades that spin once drawn
  function fan(cx, cy, d, { tStart, speed = 260, color = C.ink, fill = C.lblue } = {}) {
    const ring = R.circle(cx, cy, d, { fill: C.white, fillStyle: 'solid', stroke: color });
    const r = d * 0.42;
    const blades = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const p1 = [cx + Math.cos(a - 0.35) * r, cy + Math.sin(a - 0.35) * r], p2 = [cx + Math.cos(a + 0.35) * r, cy + Math.sin(a + 0.35) * r];
      blades.push(R.path(`M${cx} ${cy} Q${p1[0]} ${p1[1]} ${(p1[0] + p2[0]) / 2} ${(p1[1] + p2[1]) / 2} Q${p2[0]} ${p2[1]} ${cx} ${cy} Z`,
        { fill, fillStyle: 'solid', strokeWidth: 3, roughness: 0.7 }));
    }
    const hub = R.circle(cx, cy, d * 0.14, { fill: C.ink, fillStyle: 'solid', strokeWidth: 2 });
    const bg = grp(...blades, hub);
    const g = grp(ring, bg);
    g._spin = { bg, cx, cy, speed };
    return g;
  }
  function spin(fanG, tStart) {
    const s = fanG._spin;
    loop(tStart, (t, lt) => { s.bg.setAttribute('transform', `rotate(${lt > 0 ? (lt * s.speed) % 360 : 0} ${s.cx} ${s.cy})`); });
  }

  // steam puffs rising from (cx,cy)
  function steam(cx, cy, scale, tStart, { n = 6, rise = 220, period = 3.2, parent, drift = 0 } = {}) {
    const g = el('g', { opacity: 0 }, parent || P.main);
    const puffs = [];
    for (let i = 0; i < n; i++) {
      const o = O({ stroke: '#a59f94', strokeWidth: 3, fill: C.white, fillStyle: 'solid', roughness: 1.4 });
      const c = rc.circle(0, 0, 60 + (i % 3) * 14, o); g.appendChild(c); puffs.push(c);
    }
    loop(tStart, (t, lt) => {
      g.setAttribute('opacity', clamp(lt / 0.8));
      puffs.forEach((c, i) => {
        const ph = ((Math.max(lt, 0) / period) + i / n) % 1;
        const x = cx + Math.sin(ph * 4 + i * 1.7) * 18 * scale + (i % 2 ? 10 : -10) * scale + ph * drift * scale;
        const y = cy - ph * rise * scale;
        const s = scale * (0.5 + ph * 1.0);
        c.setAttribute('transform', `translate(${x} ${y}) scale(${s})`);
        c.setAttribute('opacity', Math.sin(Math.PI * ph) * 0.95);
      });
    });
    return g;
  }

  function towerIcon(x, y, w, { face = false } = {}) {
    const h = w * 0.95, inset = w * 0.13;
    const shell = R.poly([[x + inset, y], [x + w - inset, y], [x + w, y + h], [x, y + h]], { fill: C.lgrey, fillStyle: 'hachure', hachureGap: 14, fillWeight: 1.6 });
    const louv = [];
    for (let i = 0; i < 3; i++) {
      const yy = y + h * 0.66 + i * h * 0.1;
      louv.push(R.line(x + w * 0.08, yy, x + w * 0.92, yy, { strokeWidth: 3 }));
    }
    const sw = w * 0.56, sh = w * 0.17, sx = x + (w - sw) / 2;
    const stack = R.rect(sx, y - sh, sw, sh, { fill: C.lblue, fillStyle: 'solid' });
    const parts = [shell, ...louv, stack];
    if (face) {
      parts.push(R.circle(x + w * 0.38, y + h * 0.3, 14, { fill: C.ink, fillStyle: 'solid', strokeWidth: 2 }));
      parts.push(R.circle(x + w * 0.62, y + h * 0.3, 14, { fill: C.ink, fillStyle: 'solid', strokeWidth: 2 }));
      parts.push(R.path(`M${x + w * 0.36} ${y + h * 0.42} Q${x + w * 0.5} ${y + h * 0.54} ${x + w * 0.64} ${y + h * 0.42}`, { strokeWidth: 4 }));
      parts.push(R.circle(x + w * 0.27, y + h * 0.43, 26, { stroke: C.pink, fill: C.pink, fillStyle: 'solid', strokeWidth: 1 }));
      parts.push(R.circle(x + w * 0.73, y + h * 0.43, 26, { stroke: C.pink, fill: C.pink, fillStyle: 'solid', strokeWidth: 1 }));
    }
    const g = grp(...parts);
    g.top = [x + w / 2, y - sh];
    return g;
  }
  function rack(x, y, w, h, n, tLeds) {
    const outer = R.rect(x, y, w, h, { fill: C.ink, fillStyle: 'hachure', hachureGap: 8, fillWeight: 1.4 });
    const units = [], leds = [];
    const uh = (h - 24) / n;
    for (let i = 0; i < n; i++) units.push(R.rect(x + 12, y + 12 + i * uh, w - 24, uh - 8, { fill: C.white, fillStyle: 'solid', strokeWidth: 2.5, roughness: 0.9 }));
    const g = grp(outer, ...units);
    const lg = el('g', { opacity: 0 }, P.main);
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++)
      leds.push(el('circle', { cx: x + w - 34 - j * 18, cy: y + 12 + i * uh + (uh - 8) / 2, r: 5, fill: C.green }, lg));
    for (let i = 0; i < n; i++) el('line', { x1: x + 26, x2: x + w * 0.45, y1: y + 12 + i * uh + (uh - 8) / 2, y2: y + 12 + i * uh + (uh - 8) / 2, stroke: '#888', 'stroke-width': 3, 'stroke-linecap': 'round' }, lg);
    loop(tLeds, (t, lt) => {
      lg.setAttribute('opacity', clamp(lt / 0.3));
      leds.forEach((l, k) => { const v = Math.sin(t * (3 + (k * 7) % 5) + k * 2.3); l.setAttribute('fill', v > 0.2 ? C.green : (v > -0.5 ? '#b5d99c' : C.yel)); });
    });
    return g;
  }
  function thermo(x, y, h, tStart, from = 0.25, to = 0.85, rate = 1.8) {
    const tube = R.rect(x, y, 44, h, { fill: C.white, fillStyle: 'solid' });
    const bulb = R.circle(x + 22, y + h + 22, 70, { fill: C.red, fillStyle: 'solid' });
    const ticks = [];
    for (let i = 1; i < 6; i++) ticks.push(R.line(x + 44, y + i * h / 6, x + 62, y + i * h / 6, { strokeWidth: 2.5 }));
    const lvl = el('rect', { x: x + 12, width: 20, rx: 8, fill: C.red, opacity: 0 }, P.main);
    loop(tStart, (t, lt) => {
      const f = lerp(from, to, easeOut(clamp(lt / rate)));
      lvl.setAttribute('opacity', lt > 0 ? 1 : 0);
      lvl.setAttribute('y', y + h * (1 - f) + 10); lvl.setAttribute('height', h * f);
    });
    const tg = grp(tube, bulb, ...ticks); P.main.appendChild(lvl);
    return tg;
  }
  function bolt(x, y, s) {
    return R.poly([[x + s * 0.55, y], [x + s * 0.1, y + s * 0.62], [x + s * 0.45, y + s * 0.62], [x + s * 0.25, y + s * 1.2], [x + s * 0.9, y + s * 0.45], [x + s * 0.55, y + s * 0.45], [x + s * 0.8, y]],
      { fill: C.yel, fillStyle: 'solid' });
  }
  function snowflake(cx, cy, r, color = C.blue) {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      parts.push(R.line(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r, { stroke: color, strokeWidth: 3.5, roughness: 0.6 }));
    }
    return grp(...parts);
  }
  function warn(x, y, s) {
    const t = R.poly([[x + s / 2, y], [x + s, y + s * 0.88], [x, y + s * 0.88]], { fill: C.yel, fillStyle: 'solid', strokeWidth: 4.5 });
    const ex = text('!', x + s / 2, y + s * 0.78, { size: s * 0.62, font: 'title', anchor: 'middle' });
    return [t, ex];
  }
  function bubble(x, y, w, h, tx, ty, o = {}) {
    const r = 30, b = x + w * 0.1;
    return R.path(`M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${b + 60} L${tx} ${ty} L${b} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`,
      Object.assign({ fill: C.white, fillStyle: 'solid' }, o));
  }
  function chiller(x, y, w, h) {
    const body = R.rect(x, y, w, h, { fill: '#d6e9f8', fillStyle: 'hachure', hachureGap: 14, fillWeight: 1.5 });
    const b1 = R.rect(x + 18, y + h * 0.2, w - 36, h * 0.24, { fill: C.lblue, fillStyle: 'solid', strokeWidth: 3 });
    const b2 = R.rect(x + 18, y + h * 0.56, w - 36, h * 0.24, { fill: '#f7c59f', fillStyle: 'solid', strokeWidth: 3 });
    return grp(body, b1, b2);
  }
  function crah(x, y, w, h, tStart) {
    const body = R.rect(x, y, w, h, { fill: C.lgrey, fillStyle: 'hachure', hachureGap: 14, fillWeight: 1.5 });
    const gr = [];
    for (let i = 0; i < 4; i++) gr.push(R.line(x + 20, y + 22 + i * 14, x + w - 20, y + 22 + i * 14, { strokeWidth: 2.5 }));
    const f = fan(x + w / 2, y + h * 0.66, w * 0.55, { fill: C.lblue });
    spin(f, tStart);
    return grp(body, ...gr, f);
  }
  function hx(x, y, w, h) {
    const body = R.rect(x, y, w, h, { fill: C.white, fillStyle: 'solid' });
    const z1 = [], z2 = [];
    for (let i = 0; i <= 8; i++) { z1.push([x + 25 + (i % 2) * (w * 0.3), y + 20 + i * (h - 40) / 8]); z2.push([x + w * 0.55 + (i % 2) * (w * 0.3), y + 20 + i * (h - 40) / 8]); }
    return grp(body, R.lin(z1, { stroke: C.orange, strokeWidth: 4, roughness: 0.6 }), R.lin(z2, { stroke: C.blue, strokeWidth: 4, roughness: 0.6 }));
  }
  // a rounded rectangular loop (two pipes) between x1..x2 at yTop / yBot with flowing dashes
  function pipeLoop(x1, x2, yTop, yBot, color, tFlow, dir = 1) {
    const top = arrow(x1, yTop, x2, yTop, { color: dir > 0 ? color : color, sw: 5, head: 20 });
    const bot = arrow(x2, yBot, x1, yBot, { color, sw: 5, head: 20 });
    const fl = el('g', { opacity: 0 }, P.main);
    const mk = (a, b, y) => el('line', { x1: a, x2: b, y1: y, y2: y, stroke: C.white, 'stroke-width': 2.5, 'stroke-dasharray': '10 22', 'stroke-linecap': 'round' }, fl);
    const l1 = mk(x1 + 8, x2 - 24, yTop), l2 = mk(x2 - 8, x1 + 24, yBot);
    l2.setAttribute('x1', x2 - 8); l2.setAttribute('x2', x1 + 24);
    loop(tFlow, (t, lt) => { fl.setAttribute('opacity', clamp(lt / 0.4)); l1.setAttribute('stroke-dashoffset', -lt * 60); l2.setAttribute('stroke-dashoffset', -lt * 60); });
    return [top, bot];
  }
  function arcArrow(cx, cy, r, a0, a1, color, sw = 6) {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const a = lerp(a0, a1, i / 12); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    const c = R.curve(pts, { stroke: color, strokeWidth: sw, roughness: 0.6 });
    const [ax, ay] = pts[11], [bx, by] = pts[12];
    return grp(c, arrowHead(bx, by, Math.atan2(by - ay, bx - ax), 24, color, sw));
  }
  function house(x, y, w) {
    const h = w * 0.7;
    const body = R.poly([[x, y + h * 0.45], [x + w / 2, y], [x + w, y + h * 0.45], [x + w, y + h * 1.25], [x, y + h * 1.25]], { fill: '#f7c59f', fillStyle: 'hachure', hachureGap: 13, fillWeight: 1.6 });
    const door = R.rect(x + w * 0.4, y + h * 0.8, w * 0.22, h * 0.45, { fill: C.white, fillStyle: 'solid', strokeWidth: 3 });
    const win = R.rect(x + w * 0.12, y + h * 0.6, w * 0.2, w * 0.18, { fill: C.lblue, fillStyle: 'solid', strokeWidth: 3 });
    return grp(body, door, win);
  }
  function chip(x, y, s) {
    const pins = [];
    for (let i = 1; i < 5; i++) {
      const k = x + i * s / 5;
      pins.push(R.line(k, y - 16, k, y, { strokeWidth: 3 }), R.line(k, y + s, k, y + s + 16, { strokeWidth: 3 }));
      const j = y + i * s / 5;
      pins.push(R.line(x - 16, j, x, j, { strokeWidth: 3 }), R.line(x + s, j, x + s + 16, j, { strokeWidth: 3 }));
    }
    const body = R.rect(x, y, s, s, { fill: C.lgrey, fillStyle: 'hachure', hachureGap: 10, fillWeight: 1.4 });
    const core = R.rect(x + s * 0.28, y + s * 0.28, s * 0.44, s * 0.44, { fill: C.ink, fillStyle: 'solid', strokeWidth: 2 });
    return grp(body, core, ...pins);
  }
  function sun(cx, cy, d) {
    const parts = [R.circle(cx, cy, d, { fill: C.yel, fillStyle: 'solid', stroke: C.orange })];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; parts.push(R.line(cx + Math.cos(a) * d * 0.68, cy + Math.sin(a) * d * 0.68, cx + Math.cos(a) * d * 0.95, cy + Math.sin(a) * d * 0.95, { stroke: C.orange, strokeWidth: 4 })); }
    return grp(...parts);
  }
  function shield(x, y, s) {
    const sh = R.path(`M${x + s / 2} ${y} L${x + s} ${y + s * 0.18} C${x + s} ${y + s * 0.7} ${x + s * 0.75} ${y + s * 0.95} ${x + s / 2} ${y + s * 1.1} C${x + s * 0.25} ${y + s * 0.95} ${x} ${y + s * 0.7} ${x} ${y + s * 0.18} Z`,
      { fill: '#bfe3c4', fillStyle: 'solid' });
    return grp(sh, tick(x + s * 0.24, y + s * 0.52, s * 0.52));
  }
  function stickFigure(cx, y) {
    const head = R.circle(cx, y, 90, { fill: C.white, fillStyle: 'solid' });
    const eyes = [R.circle(cx - 15, y - 6, 8, { fill: C.ink, fillStyle: 'solid', strokeWidth: 1 }), R.circle(cx + 15, y - 6, 8, { fill: C.ink, fillStyle: 'solid', strokeWidth: 1 })];
    const mouth = R.path(`M${cx - 18} ${y + 16} Q${cx} ${y + 32} ${cx + 18} ${y + 16}`, { strokeWidth: 3 });
    const body = R.line(cx, y + 45, cx, y + 210);
    const arms = R.lin([[cx - 80, y + 70], [cx, y + 100], [cx + 80, y + 70]]);
    const legs = R.lin([[cx - 60, y + 330], [cx, y + 210], [cx + 60, y + 330]]);
    return grp(body, arms, legs, head, ...eyes, mouth);
  }
  function fallingDrops(xs, y0, y1, tStart, { period = 1.2, color = C.blue, len = 18, parent } = {}) {
    const g = el('g', { opacity: 0 }, parent || P.main);
    const ds = xs.map(() => el('line', { stroke: color, 'stroke-width': 4, 'stroke-linecap': 'round' }, g));
    loop(tStart, (t, lt) => {
      g.setAttribute('opacity', clamp(lt / 0.4));
      ds.forEach((d, i) => {
        const ph = ((Math.max(lt, 0) / period) + (i * 0.37) % 1) % 1;
        const y = lerp(y0, y1, ph);
        d.setAttribute('x1', xs[i]); d.setAttribute('x2', xs[i]);
        d.setAttribute('y1', y); d.setAttribute('y2', y + len);
        d.setAttribute('opacity', ph > 0.92 ? (1 - ph) / 0.08 : 1);
      });
    });
    return g;
  }

  // ---------- camera & panels ----------
  const TRANS = 1.4;
  const camSegs = []; // {t0,t1,a,b,kind}
  let tcur = 0.3, prevPanel = null;
  const vbOf = (c, r) => [c * PW, r * PH, PW, PH];
  function linkArrow(from, to) {
    // big grey connecting arrow drawn across the panel border during the camera move
    const [c1, r1] = from, [c2, r2] = to;
    const saved = P; P = LINKP;
    let g;
    if (r1 === r2) {
      const y = r1 * PH + 1015, xb = Math.max(c1, c2) * PW, d = c2 > c1 ? 1 : -1;
      g = arrow(xb - d * 230, y, xb + d * 230, y, { bend: d * -40, color: C.grey, sw: 6, head: 30 });
    } else {
      const x = c1 * PW + (c1 === 2 ? 1840 : 80), yb = r2 * PH;
      g = arrow(x, yb - 200, x, yb + 200, { bend: c1 === 2 ? -40 : 40, color: C.grey, sw: 6, head: 30 });
    }
    g._P = LINKP;
    const Tsave = T; T = tcur + 0.15; D(g, TRANS - 0.3, 0); T = Tsave;
    P = saved;
  }
  function beginPanel(c, r) {
    if (prevPanel) {
      linkArrow(prevPanel, [c, r]);
      camSegs.push({ t0: tcur, t1: tcur + TRANS, a: vbOf(...prevPanel), b: vbOf(c, r) });
      tcur += TRANS;
    }
    panel(c, r);
    prevPanel = [c, r];
    T = tcur + 0.2;
  }
  function endPanel(hold = 1.4) { tcur = T + hold; }

  // =====================================================================
  // PANEL 1 — Title
  beginPanel(0, 0);
  {
    const b = HL(140, 168, 470, 58, C.yel, 0.3);
    W(text('a sketchnote film', 160, 212, { size: 50 }));
    wait(0.1);
    W(text('Keeping', 150, 400, { size: 190, font: 'title' }), 0.6);
    W(text('Data Centres', 150, 580, { size: 190, font: 'title' }), 0.9);
    const cool = text('Cool', 150, 760, { size: 200, font: 'title', color: C.blue });
    HL(140, 700, 340, 70, C.lblue, 0.35, 0, 0.45);
    W(cool, 0.5);
    wait(0.1);
    W(text('how cooling towers carry the heat away', 158, 880, { size: 60 }), 1.3);
    D(wave(160, 912, 1090, 912, { amp: 8, n: 9, color: C.blue, sw: 4 }), 0.5);
    // doodle: rack -> pipes -> tower -> steam
    const rk = rack(1100, 560, 170, 330, 6, 0);
    D(rk, 0.8);
    rk.ownerLeds = true;
    const tw = towerIcon(1440, 470, 360);
    D(tw, 1.0);
    D(arrow(1285, 640, 1450, 640, { color: C.red, sw: 6, head: 22 }), 0.3);
    D(arrow(1460, 800, 1285, 800, { color: C.blue, sw: 6, head: 22 }), 0.3);
    D(text('hot', 1320, 620, { size: 40, color: C.red }), 0.2);
    D(text('cool', 1320, 850, { size: 40, color: C.blue }), 0.2);
    const f = fan(1620, 420, 70, { fill: C.lblue }); D(f, 0.35); spin(f, T);
    steam(1620, 360, 1.1, T, { rise: 200 });
    // little sparkle doodles
    D(R.lin([[1820, 240], [1830, 270], [1860, 280], [1830, 290], [1820, 320], [1810, 290], [1780, 280], [1810, 270], [1820, 240]], { stroke: C.orange, strokeWidth: 3 }), 0.3);
  }
  // the rack LEDs for panel 1 start at 0 (handled via loop); fine
  endPanel(1.6);

  // PANEL 2 — The problem
  beginPanel(1, 0);
  {
    heading(1, 'The problem: servers are heaters');
    wait(0.15);
    D(bolt(190, 360, 170), 0.5);
    W(text('electricity in', 150, 610, { size: 46 }));
    D(arrow(360, 470, 560, 470, { color: C.ink, sw: 5 }), 0.35);
    const rk = rack(590, 300, 250, 470, 7, T + 0.8);
    D(rk, 1.0);
    W(text('server rack', 620, 830, { size: 44, color: C.grey }));
    D(wave(880, 410, 1080, 410, { amp: 14, n: 2.5, head: 22 }), 0.3, 0);
    D(wave(880, 500, 1080, 500, { amp: 14, n: 2.5, head: 22 }), 0.3, 0);
    D(wave(880, 590, 1080, 590, { amp: 14, n: 2.5, head: 22 }), 0.3);
    W(text('HEAT', 1110, 530, { size: 110, font: 'title', color: C.red }), 0.4);
    W(text('out', 1125, 590, { size: 50, color: C.red }), 0.2);
    D(bubble(930, 175, 690, 110, 870, 330), 0.5);
    W(text('Almost all the power becomes heat!', 960, 245, { size: 46 }));
    D(thermo(1700, 330, 360, T + 0.6), 0.6);
    W(text('hot!', 1680, 850, { size: 54, font: 'title', color: C.red }), 0.3);
    const [wt, wx] = warn(130, 900 - 120, 120);
    D(wt, 0.4); W(wx, 0.15);
    W(text('Too hot = chips slow down or fail', 280, 880, { size: 50 }));
    D(R.rect(1060, 700, 560, 230, { fill: C.yel, fillStyle: 'hachure', hachureGap: 16, fillWeight: 1.6, stroke: C.ink }), 0.6);
    W(text('1 AI rack: 100 kW+', 1090, 790, { size: 72, font: 'title' }));
    W(text('~ 50 space heaters on full blast', 1090, 860, { size: 40 }));
    W(text('...all in one cupboard-sized box', 1090, 905, { size: 34, color: C.grey }));
  }
  endPanel(1.6);

  // PANEL 3 — the heat's journey
  beginPanel(2, 0);
  {
    heading(2, "The heat's journey outside");
    wait(0.1);
    const ys = 520;
    D(rack(150, 390, 140, 260, 5, T + 0.5), 0.7);
    W(text('servers', 160, 710, { size: 44 }));
    D(wave(305, 470, 470, 470, { amp: 10, n: 2, head: 20 }), 0.3);
    W(text('hot air', 330, 440, { size: 36, color: C.red }));
    D(crah(490, 400, 180, 230, T + 0.6), 0.8);
    W(text('cooling unit', 495, 710, { size: 44 }));
    W(text('(CRAH / CDU)', 500, 755, { size: 32, color: C.grey }));
    const L1 = pipeLoop(690, 860, 455, 590, C.blue, T + 0.8);
    D(L1[0], 0.35, 0); D(L1[1], 0.35);
    W(text('chilled', 715, 520, { size: 34, color: C.blue }), 0.25, 0);
    W(text('water', 725, 555, { size: 34, color: C.blue }), 0.25);
    D(chiller(880, 410, 200, 220), 0.7);
    W(text('chiller', 920, 710, { size: 44 }));
    const L2 = pipeLoop(1100, 1270, 455, 590, C.orange, T + 0.8);
    D(L2[0], 0.35, 0); D(L2[1], 0.35);
    W(text('condenser', 1112, 520, { size: 30, color: C.orange }), 0.25, 0);
    W(text('water', 1135, 555, { size: 34, color: C.orange }), 0.25);
    const tw = towerIcon(1290, 430, 230); D(tw, 0.8);
    steam(1405, 390, 0.7, T, { rise: 160 });
    W(text('cooling tower', 1280, 710, { size: 44 }));
    D(arrow(1530, 400, 1660, 330, { bend: -30, color: C.grey, sw: 4 }), 0.3);
    D(cloud(1740, 300, 230, 130), 0.5);
    W(text('sky', 1712, 315, { size: 46, color: C.blue }));
    W(text('heat leaves as', 1640, 430, { size: 34, color: C.grey }), 0.4, 0);
    W(text('water vapour', 1645, 470, { size: 34, color: C.grey }), 0.4);
    D(R.rect(170, 820, 1580, 150, { stroke: C.grey, strokeWidth: 3 }), 0.5);
    W(text('Heat is passed along like a relay baton:', 210, 885, { size: 52 }));
    W(text('the cooling tower runs the last leg.', 210, 945, { size: 52, color: C.blue }));
  }
  endPanel(1.8);

  // PANEL 4 — inside a cooling tower
  beginPanel(2, 1);
  {
    heading(3, 'Inside a cooling tower');
    wait(0.1);
    // shell
    D(R.poly([[290, 330], [810, 330], [900, 930], [200, 930]], { fill: '#efe9dc', fillStyle: 'solid', strokeWidth: 5 }), 0.8);
    // fan stack + fan
    D(R.rect(400, 250, 300, 80, { fill: C.lblue, fillStyle: 'hachure', hachureGap: 10 }), 0.4);
    const f = fan(550, 290, 110, { fill: C.lblue }); D(f, 0.4); spin(f, T);
    const tSteam = T;
    // pipe + nozzles
    D(R.rect(260, 388, 760, 26, { fill: C.red, fillStyle: 'solid', stroke: C.ink, strokeWidth: 3 }), 0.5);
    const noz = [];
    for (let i = 0; i < 6; i++) noz.push(R.poly([[330 + i * 90, 414], [350 + i * 90, 414], [358 + i * 90, 432], [322 + i * 90, 432]], { fill: C.ink, fillStyle: 'solid', strokeWidth: 2 }));
    D(grp(...noz), 0.3);
    W(text('35°C', 930, 375, { size: 50, font: 'title', color: C.red }));
    // fill zone
    D(R.rect(255, 490, 590, 210, { fill: '#b9a98a', fillStyle: 'zigzag', hachureGap: 18, fillWeight: 2, strokeWidth: 3 }), 0.8);
    // falling water
    const xs = []; for (let i = 0; i < 22; i++) xs.push(270 + i * 26 + (i % 3) * 5);
    fallingDrops(xs, 440, 840, T, { period: 1.4 });
    // louvres & basin
    const lv = [];
    for (let i = 0; i < 4; i++) { lv.push(R.line(205 + i * 4, 740 + i * 40, 255, 720 + i * 40, { strokeWidth: 3 })); lv.push(R.line(845, 720 + i * 40, 895 - i * 4, 740 + i * 40, { strokeWidth: 3 })); }
    D(grp(...lv), 0.5);
    D(R.rect(200, 860, 700, 70, { fill: C.lblue, fillStyle: 'solid', strokeWidth: 4 }), 0.5);
    D(wave(230, 885, 870, 885, { amp: 5, n: 10, color: C.blue, sw: 3 }), 0.3);
    D(arrow(900, 905, 1030, 905, { color: C.blue, sw: 7, head: 24 }), 0.3);
    W(text('29°C', 940, 960, { size: 50, font: 'title', color: C.blue }));
    // air arrows
    D(arrow(80, 800, 380, 640, { bend: 40, color: C.teal, sw: 5 }), 0.35, 0);
    D(arrow(1020, 800, 720, 640, { bend: -40, color: C.teal, sw: 5 }), 0.35);
    W(text('air in', 70, 860, { size: 40, color: C.teal }));
    D(arrow(550, 610, 550, 470, { color: C.teal, sw: 5 }), 0.3);
    steam(560, 240, 1.0, tSteam, { rise: 25, drift: 330, n: 7 });
    // markers on diagram
    const mk = (n, x, y) => { const [c, t] = badge(n, x, y, C.yel, 54); D(c, 0.2, 0); W(t, 0.12); };
    mk(1, 230, 400); mk(2, 220, 590); mk(3, 360, 290); mk(4, 980, 215); mk(5, 160, 900);
    // notes
    const notes = [
      ['Warm water from the chiller', 'is sprayed over the top'],
      ['It trickles down the "fill",', 'spreading into thin films'],
      ['A big fan pulls outside air', 'up through the falling water'],
      ['About 1% of the water evaporates,', 'carrying the heat away with it'],
      ['The rest, now cooler, collects in', 'the basin & goes back for more'],
    ];
    notes.forEach((nt, i) => {
      const y = 290 + i * 145;
      const [c, t] = badge(i + 1, 1135, y - 18, i === 3 ? C.lblue : C.yel, 64);
      D(c, 0.2, 0); W(t, 0.12);
      W(text(nt[0], 1190, y, { size: 44, color: i === 3 ? C.blue : C.ink }));
      W(text(nt[1], 1190, y + 50, { size: 44, color: i === 3 ? C.blue : C.ink }));
    });
    HL(1182, 703, 545, 28, C.lblue, 0.35, 0, 0.45);
  }
  endPanel(2.0);

  // PANEL 5 — why evaporation works
  beginPanel(1, 1);
  {
    heading(4, 'Why evaporation is so powerful');
    wait(0.1);
    D(sun(560, 300, 110), 0.5);
    D(stickFigure(330, 380), 0.9);
    const sd = [drop(250, 340, 34), drop(410, 330, 30), drop(270, 420, 26)];
    D(grp(...sd), 0.3);
    W(text('Same trick', 200, 810, { size: 64, font: 'title' }));
    W(text('as sweating!', 200, 870, { size: 64, font: 'title', color: C.blue }));
    // 10x10 grid of drops (warm -> cool)
    const gx = 780, gy = 330, sp = 36;
    const dots = [], dg = el('g', { opacity: 0 }, P.main);
    for (let i = 0; i < 100; i++) dots.push(el('circle', { cx: gx + (i % 10) * sp, cy: gy + Math.floor(i / 10) * sp, r: 12, fill: C.orange, stroke: C.ink, 'stroke-width': 2 }, dg));
    D(R.rect(gx - 32, gy - 32, sp * 10 + 28, sp * 10 + 28, { stroke: C.grey, strokeWidth: 3 }), 0.4);
    const tGrid = T;
    F(dg, 0.5, 0.3);
    W(text('100 drops of warm water', gx - 30, gy - 55, { size: 40 }));
    const tEvap = T + 0.2;
    const puffO = O({ stroke: '#a59f94', strokeWidth: 3, fill: C.white, fillStyle: 'solid' });
    const puff = rc.circle(0, 0, 50, puffO); P.main.appendChild(puff); puff.setAttribute('opacity', 0);
    loop(tGrid, (t, lt) => {
      const e = t - tEvap;
      const u = clamp(e / 1.6);
      dots.forEach((d, i) => {
        if (i === 4) { d.setAttribute('opacity', 1 - clamp(e / 0.5)); return; }
        const c = clamp((e - 0.6 - (i % 10) * 0.03 - Math.floor(i / 10) * 0.04) / 0.5);
        d.setAttribute('fill', c > 0.5 ? C.lblue : C.orange);
      });
      const px = gx + 4 * sp, py = gy - 10 - u * 160;
      puff.setAttribute('opacity', e > 0 ? Math.min(1, e / 0.3) * (1 - clamp((e - 2.5) / 1)) : 0);
      puff.setAttribute('transform', `translate(${px} ${py}) scale(${0.5 + u})`);
    });
    wait(0.9);
    W(text('1 evaporates...', 1180, 380, { size: 44, color: C.grey }));
    wait(0.4);
    W(text('...the other 99', 780, 760, { size: 50, color: C.blue }));
    W(text('get ~6°C cooler!', 780, 820, { size: 64, font: 'title', color: C.blue }));
    // bars
    W(text('Electricity used to', 1390, 470, { size: 40 }), 0.5, 0);
    W(text('get rid of heat', 1390, 515, { size: 40 }), 0.5);
    D(R.line(1390, 860, 1800, 860, { strokeWidth: 4 }), 0.3);
    D(R.rect(1420, 560, 140, 300, { fill: C.red, fillStyle: 'hachure', hachureGap: 11 }), 0.6);
    D(R.rect(1620, 700, 140, 160, { fill: C.blue, fillStyle: 'hachure', hachureGap: 11 }), 0.5);
    W(text('air-cooled', 1418, 905, { size: 34 }));
    W(text('evaporative', 1610, 905, { size: 34 }));
    D(tick(1655, 650, 70), 0.3);
    W(text('Water can even be cooled below the air temperature, toward the "wet-bulb" temperature.', 200, 980, { size: 40, color: C.grey }));
  }
  endPanel(1.8);

  // PANEL 6 — free cooling
  beginPanel(0, 1);
  {
    heading(5, 'Free cooling on cold days');
    wait(0.1);
    const tw = towerIcon(170, 420, 270); D(tw, 0.8);
    const fl = [snowflake(150, 300, 26), snowflake(470, 330, 20), snowflake(300, 250, 18), snowflake(560, 430, 22)];
    D(grp(...fl), 0.6);
    const sg = steam(305, 360, 0.6, T, { rise: 140, n: 4 });
    W(text('cold outside', 180, 760, { size: 48, color: C.blue }));
    const L1 = pipeLoop(470, 730, 500, 640, C.orange, T + 0.9);
    D(L1[0], 0.35, 0); D(L1[1], 0.35);
    D(hx(750, 450, 180, 240), 0.7);
    W(text('heat exchanger', 715, 750, { size: 40 }));
    const L2 = pipeLoop(950, 1320, 500, 640, C.blue, T + 0.9);
    D(L2[0], 0.35, 0); D(L2[1], 0.35);
    W(text('cold water', 1060, 480, { size: 38, color: C.blue }));
    D(rack(1340, 420, 160, 300, 6, T + 0.6), 0.7);
    W(text('servers', 1360, 770, { size: 44 }));
    // chiller resting
    D(chiller(1580, 230, 190, 170), 0.6);
    W(text('chiller', 1620, 450, { size: 42 }));
    D(cross(1675, 315, 75), 0.4);
    W(text('Z z z', 1790, 240, { size: 56, font: 'title', color: C.grey, rot: -12 }));
    W(text('switched off!', 1600, 500, { size: 40, color: C.red }));
    D(R.rect(170, 830, 1600, 150, { stroke: C.grey, strokeWidth: 3 }), 0.5);
    W(text("When it's cold, tower water alone is cold enough.", 210, 893, { size: 52 }));
    W(text('The chiller rests and the site saves lots of energy.', 210, 953, { size: 52, color: C.green }));
  }
  endPanel(1.8);

  // PANEL 7 — the catch: water
  beginPanel(0, 2);
  {
    heading(6, 'The catch: towers are thirsty');
    wait(0.1);
    D(drop(330, 215, 250, { strokeWidth: 5, fill: C.lblue, fillStyle: 'hachure', hachureGap: 12 }), 0.8);
    W(text('Millions of litres', 540, 360, { size: 84, font: 'title', color: C.blue }));
    W(text('of water a day at a big site', 545, 425, { size: 48 }));
    // WUE badge
    D(R.circle(1580, 370, 260, { fill: C.yel, fillStyle: 'hachure', hachureGap: 13, strokeWidth: 5 }), 0.6);
    W(text('WUE', 1580, 375, { size: 96, font: 'title', anchor: 'middle' }));
    W(text('litres per kWh', 1580, 425, { size: 36, anchor: 'middle' }));
    W(text('how sites track water use', 1440, 550, { size: 34, color: C.grey }));
    // three losses + make-up
    const col = (x, title, l1, l2, color) => {
      W(text(title, x, 800, { size: 60, font: 'title', color, anchor: 'middle' }));
      W(text(l1, x, 850, { size: 36, anchor: 'middle' }), 0.4, 0);
      W(text(l2, x, 890, { size: 36, anchor: 'middle' }), 0.4);
    };
    D(cloud(300, 675, 220, 110), 0.5);
    
    col(300, 'Evaporation', 'the cooling itself', '(most of the water)', C.blue);
    // drift: mesh + tiny dots
    const mesh = []; for (let i = 0; i < 5; i++) { mesh.push(R.line(690 + i * 30, 620, 690 + i * 30, 720, { strokeWidth: 2.5 })); mesh.push(R.line(680, 630 + i * 22, 820, 630 + i * 22, { strokeWidth: 2.5 })); }
    D(grp(...mesh), 0.5);
    const dg = el('g', { opacity: 0 }, P.main); const dd = [];
    for (let i = 0; i < 9; i++) dd.push(el('circle', { r: 5, fill: C.blue }, dg));
    loop(T, (t, lt) => { dg.setAttribute('opacity', clamp(lt / 0.4)); dd.forEach((d, i) => { const ph = (lt * 0.5 + i / 9) % 1; d.setAttribute('cx', 830 + ph * 120); d.setAttribute('cy', 640 + (i % 4) * 22 - ph * 40); d.setAttribute('opacity', 1 - ph); }); });
    col(780, 'Drift', 'tiny droplets blown', 'out (meshes catch most)', C.teal);
    // blowdown pipe
    D(R.lin([[1180, 610], [1180, 700], [1320, 700]], { strokeWidth: 16, stroke: C.grey, roughness: 0.6 }), 0.5);
    const bd = fallingDrops([1330, 1342], 705, 740, T, { period: 0.8, color: '#9a8a6a', len: 10 });
    D(grp(R.circle(1210, 650, 12, { fill: '#9a8a6a', fillStyle: 'solid', strokeWidth: 1.5 }), R.circle(1240, 676, 10, { fill: '#9a8a6a', fillStyle: 'solid', strokeWidth: 1.5 })), 0.2);
    col(1260, 'Blowdown', 'draining water before', 'minerals build up', '#8a6d3b');
    // make-up tap
    D(R.lin([[1600, 640], [1720, 640], [1720, 690]], { strokeWidth: 14, stroke: C.ink, roughness: 0.6 }), 0.4);
    D(R.rect(1640, 605, 40, 22, { fill: C.red, fillStyle: 'solid', strokeWidth: 2 }), 0.2);
    fallingDrops([1720], 695, 745, T, { period: 0.9 });
    col(1680, '+ Make-up', 'fresh water tops', 'everything back up', C.green);
    D(shield(170, 925, 60), 0.4);
    W(text('Water must be treated to stop scale, corrosion & Legionella bacteria', 255, 975, { size: 42 }));
  }
  endPanel(1.8);

  // PANEL 8 — what's next
  beginPanel(1, 2);
  {
    heading(7, "What's next?");
    wait(0.1);
    const cell = (x, y, icon, title, l1, l2, color) => {
      icon();
      W(text(title, x + 250, y + 70, { size: 66, font: 'title', color }));
      W(text(l1, x + 252, y + 130, { size: 40 }));
      W(text(l2, x + 252, y + 178, { size: 40 }));
    };
    cell(150, 250, () => {
      D(arcArrow(260, 360, 85, -Math.PI / 2 + 0.3, Math.PI / 6 - 0.2, C.green), 0.3, 0);
      D(arcArrow(260, 360, 85, Math.PI / 6 + 0.3, Math.PI * 5 / 6 - 0.2, C.green), 0.3, 0);
      D(arcArrow(260, 360, 85, Math.PI * 5 / 6 + 0.3, Math.PI * 1.5 - 0.2, C.green), 0.3);
      D(drop(260, 325, 55), 0.3);
    }, 'Recycled water', 'treated wastewater, rain', 'or sea water, not drinking water', C.green);
    cell(1000, 250, () => {
      D(sun(1080, 330, 90), 0.4);
      D(snowflake(1170, 420, 34), 0.3);
      D(R.line(1080, 450, 1170, 320, { strokeWidth: 3, stroke: C.grey }), 0.2);
    }, 'Hybrid & dry coolers', 'use air on most days, only', 'evaporate on the hottest ones', C.orange);
    cell(150, 640, () => {
      D(chip(180, 680, 150), 0.6);
      D(drop(310, 650, 70), 0.3);
    }, 'Liquid-cooled chips', 'warm water straight to the chip', 'means more free-cooling days', C.blue);
    cell(1000, 640, () => {
      D(house(1040, 720, 170), 0.6);
      D(wave(1070, 700, 1070, 640, { amp: 8, n: 1.5 }), 0.15, 0);
      D(wave(1125, 690, 1125, 620, { amp: 8, n: 1.5 }), 0.15, 0);
      D(wave(1180, 700, 1180, 640, { amp: 8, n: 1.5 }), 0.15);
    }, 'Reuse the heat', 'pipe waste heat to warm', 'homes, pools & greenhouses', C.red);
    D(R.line(960, 260, 960, 950, { stroke: C.lgrey, strokeWidth: 3 }), 0.3, 0);
    D(R.line(160, 600, 1780, 600, { stroke: C.lgrey, strokeWidth: 3 }), 0.3);
  }
  endPanel(1.8);

  // PANEL 9 — recap
  beginPanel(2, 2);
  {
    W(text('In a nutshell', 150, 180, { size: 110, font: 'title' }));
    D(wave(150, 210, 700, 210, { amp: 7, n: 6, color: C.blue }), 0.4);
    const pts = [
      ['Servers turn electricity into heat', C.red],
      ['Water loops carry that heat outside', C.orange],
      ['Cooling towers evaporate a little', C.blue],
      ['water to throw the heat into the sky', C.blue],
      ['Super energy-efficient... but thirsty', C.green],
    ];
    let n = 1;
    pts.forEach((p, i) => {
      const y = [330, 450, 570, 635, 760][i];
      if (i !== 3) { const [c, t] = badge(n++, 190, y - 16, C.yel, 66); D(c, 0.2, 0); W(t, 0.12); }
      W(text(p[0], 250, y, { size: 54, color: i === 3 || i === 2 ? C.blue : C.ink }));
    });
    const tw = towerIcon(1300, 380, 400, { face: true });
    D(tw, 1.2);
    steam(1500, 300, 1.2, T, { rise: 220 });
    const f = fan(1500, 345, 70, { fill: C.lblue }); D(f, 0.3); spin(f, T);
    D(tick(1730, 300, 110), 0.4);
    const sc = text('Stay cool!', 1290, 930, { size: 120, font: 'title', color: C.blue });
    HL(1280, 880, 470, 60, C.yel, 0.35, 0, 0.55);
    W(sc, 0.6);
  }
  endPanel(1.6);

  // FINAL — zoom out to the full sheet
  const tZoom = tcur;
  camSegs.push({ t0: tZoom, t1: tZoom + 2.4, a: vbOf(2, 2), b: [-60, -34, WW + 120, WH + 68] });
  const DURATION = tZoom + 2.4 + 6.0;

  // HUD: end title card
  const endG = el('g', { opacity: 0 }, hud);
  el('rect', { x: 560, y: 470, width: 800, height: 140, rx: 24, fill: C.white, stroke: C.ink, 'stroke-width': 5, transform: 'rotate(-1.5 960 540)' }, endG);
  const et = el('text', { x: 960, y: 560, 'font-family': 'Caveat', 'font-weight': 700, 'font-size': 92, 'text-anchor': 'middle', fill: C.ink, transform: 'rotate(-1.5 960 540)' }, endG);
  et.textContent = 'Cooling towers, explained';

  // pen (marker) in HUD
  const pen = el('g', { opacity: 0 }, hud);
  const penInner = el('g', { transform: 'rotate(32)' }, pen);
  el('ellipse', { cx: 30, cy: -100, rx: 22, ry: 120, fill: 'rgba(0,0,0,0.12)', transform: 'translate(18 14)' }, penInner);
  const penTip = el('path', { d: 'M0 0 L-9 -26 L9 -26 Z', fill: C.ink }, penInner);
  el('rect', { x: -13, y: -48, width: 26, height: 24, rx: 4, fill: '#555' }, penInner);
  el('rect', { x: -17, y: -215, width: 34, height: 170, rx: 8, fill: '#f4f0e6', stroke: C.ink, 'stroke-width': 3 }, penInner);
  el('rect', { x: -17, y: -160, width: 34, height: 50, fill: C.yel, stroke: C.ink, 'stroke-width': 2 }, penInner);
  const penCap = el('rect', { x: -17, y: -240, width: 34, height: 30, rx: 6, fill: C.ink }, penInner);

  // ---------- prepare anims ----------
  for (const a of anims) {
    if (a.k === 'draw') {
      const paths = a.node.tagName === 'path' ? [a.node] : [...a.node.querySelectorAll('path')];
      a.out = []; a.fill = []; a.solid = [];
      for (const p of paths) {
        let n = p; while (n && !n._o) n = n.parentNode;
        const o = n ? n._o : {};
        const fillAttr = p.getAttribute('fill');
        const len = Math.max(1, p.getTotalLength());
        const s = { el: p, len, color: p.getAttribute('stroke') || o.stroke };
        if (fillAttr && fillAttr !== 'none') { a.solid.push(s); p.style.opacity = 0; continue; }
        p.style.strokeDasharray = `${len} ${len + 20}`;
        p.style.strokeDashoffset = len;
        p.style.visibility = 'hidden';
        if (o.fill && o.fillStyle !== 'solid' && p.getAttribute('stroke') === o.fill && o.fill !== o.stroke) a.fill.push(s); else a.out.push(s);
      }
      a.outLen = a.out.reduce((q, s) => q + s.len, 0);
      a.fillLen = a.fill.reduce((q, s) => q + s.len, 0);
      a.split = (a.fill.length || a.solid.length) ? 0.62 : 1;
      if (!a.out.length) a.split = 0;
    } else if (a.k === 'write') {
      const bb = a.node.getBBox();
      a.bb = bb;
      const id = 'c' + Math.random().toString(36).slice(2);
      const cp = el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, defs);
      a.clip = el('rect', { x: bb.x - 12, y: bb.y - 30, height: bb.height + 60, width: 0 }, cp);
      a.node.setAttribute('clip-path', `url(#${id})`);
    } else if (a.k === 'pop') {
      const bb = a.node.getBBox(); a.cx = bb.x + bb.width / 2; a.cy = bb.y + bb.height / 2;
    }
  }
  const penAnims = anims.filter(a => a.k === 'draw' || a.k === 'write').sort((x, y) => x.t0 - y.t0);

  function seqApply(list, total, p) {
    let acc = 0; const target = p * total;
    for (const s of list) {
      const local = clamp((target - acc) / s.len);
      s.el.style.strokeDashoffset = s.len * (1 - local);
      s.el.style.visibility = local > 0 ? 'visible' : 'hidden';
      acc += s.len;
    }
  }
  function seqPoint(list, total, p) {
    if (!list.length) return null;
    let acc = 0; const target = p * total;
    for (const s of list) {
      if (target <= acc + s.len) { const pt = s.el.getPointAtLength(clamp(target - acc, 0, s.len)); return [pt.x, pt.y, s.color]; }
      acc += s.len;
    }
    const s = list[list.length - 1]; const pt = s.el.getPointAtLength(s.len); return [pt.x, pt.y, s.color];
  }
  function penPoint(a, p) {
    let r;
    if (a.k === 'draw') {
      if (p < a.split || (!a.fill.length)) r = seqPoint(a.out, a.outLen, a.split ? clamp(p / a.split) : 1);
      else r = seqPoint(a.fill, a.fillLen, clamp((p - a.split) / (1 - a.split)));
      if (!r) r = seqPoint(a.out, a.outLen, 1) || [0, 0, C.ink];
    } else {
      const bb = a.bb;
      r = [bb.x + bb.width * p, bb.y + bb.height * 0.6 + Math.sin(p * bb.width / 9) * bb.height * 0.16, a.node.getAttribute('fill')];
    }
    return [r[0] + a.P.ox, r[1] + a.P.oy, r[2]];
  }

  function camAt(t) {
    let vb = vbOf(0, 0);
    for (const s of camSegs) {
      if (t >= s.t1) vb = s.b;
      else if (t >= s.t0) {
        const u = ease((t - s.t0) / (s.t1 - s.t0));
        const final = s === camSegs[camSegs.length - 1];
        const ca = [s.a[0] + s.a[2] / 2, s.a[1] + s.a[3] / 2], cb = [s.b[0] + s.b[2] / 2, s.b[1] + s.b[3] / 2];
        const cx = lerp(ca[0], cb[0], u), cy = lerp(ca[1], cb[1], u);
        let w = Math.exp(lerp(Math.log(s.a[2]), Math.log(s.b[2]), u));
        if (!final) w *= 1 + 0.16 * Math.sin(Math.PI * u);
        const h = w * 9 / 16;
        vb = [cx - w / 2, cy - h / 2, w, h];
        break;
      } else break;
    }
    // subtle handheld drift
    const k = vb[2] / PW;
    return [vb[0] + Math.sin(t * 0.7) * 4 * k, vb[1] + Math.cos(t * 0.53) * 3 * k, vb[2], vb[3]];
  }

  function render(t) {
    for (const a of anims) {
      const p = clamp((t - a.t0) / a.dur);
      if (a.k === 'draw') {
        const po = a.split ? clamp(p / a.split) : 1;
        const pf = a.split < 1 ? clamp((p - a.split) / (1 - a.split)) : 0;
        seqApply(a.out, a.outLen, po);
        seqApply(a.fill, a.fillLen, pf);
        for (const s of a.solid) s.el.style.opacity = a.out.length ? pf : p;
      } else if (a.k === 'write') {
        a.clip.setAttribute('width', (a.bb.width + 24) * p);
      } else if (a.k === 'fade') {
        a.node.setAttribute('opacity', p);
      } else if (a.k === 'grow') {
        a.node.setAttribute('width', a.w * easeOut(p));
        a.node.style.visibility = p > 0 ? 'visible' : 'hidden';
      } else if (a.k === 'pop') {
        const s = p <= 0 ? 0.001 : 1 + 0.15 * Math.sin(Math.PI * p) * (1 - p);
        a.node.setAttribute('transform', `translate(${a.cx} ${a.cy}) scale(${s * easeOut(p) || 0.001}) translate(${-a.cx} ${-a.cy})`);
      }
    }
    for (const l of loops) l.fn(t, t - l.t0);
    const vb = camAt(t);
    world.setAttribute('viewBox', vb.join(' '));
    // pen
    let active = null;
    for (const a of penAnims) if (t >= a.t0 && t < a.t0 + a.dur) active = a;
    let pos = null, op = 0, lift = 0, color = C.ink;
    if (active) { pos = penPoint(active, (t - active.t0) / active.dur); op = 1; color = pos[2]; }
    else {
      let prev = null, next = null;
      for (const a of penAnims) { if (a.t0 + a.dur <= t) { if (!prev || a.t0 + a.dur > prev.t0 + prev.dur) prev = a; } else if (a.t0 > t && (!next || a.t0 < next.t0)) next = a; }
      const pe = prev ? prev.t0 + prev.dur : -99;
      if (prev && next && next.t0 - pe < 1.6) {
        const u = ease((t - pe) / (next.t0 - pe));
        const A = penPoint(prev, 1), B = penPoint(next, 0);
        pos = [lerp(A[0], B[0], u), lerp(A[1], B[1], u), B[2]]; op = 1; lift = Math.sin(Math.PI * u) * 30; color = A[2];
      } else if (prev && t - pe < 0.4) {
        const A = penPoint(prev, 1), u = (t - pe) / 0.4; pos = [A[0] + u * 160, A[1] + u * 120, A[2]]; op = 1 - u; lift = u * 40;
      } else if (next && next.t0 - t < 0.4) {
        const B = penPoint(next, 0), u = (next.t0 - t) / 0.4; pos = [B[0] + u * 160, B[1] + u * 120, B[2]]; op = 1 - u; lift = u * 40;
      }
    }
    if (pos) {
      const sx = (pos[0] - vb[0]) * PW / vb[2], sy = (pos[1] - vb[1]) * PH / vb[3];
      pen.setAttribute('transform', `translate(${sx} ${sy - lift})`);
      pen.setAttribute('opacity', op);
      const col = (color && color !== 'none') ? color : C.ink;
      penTip.setAttribute('fill', col); penCap.setAttribute('fill', col);
    } else pen.setAttribute('opacity', 0);
    endG.setAttribute('opacity', clamp((t - (tZoom + 5.0)) / 0.5));
  }

  // intervals when the pen is drawing (for scratch sound)
  const penIntervals = penAnims.map(a => [a.t0, a.t0 + a.dur, a.k]);
  window.render = render;
  window.FILM = { duration: DURATION, penIntervals, fps: 30, cams: camSegs.map(s => [s.t0, s.t1]) };
  render(0);
  return window.FILM;
})();
