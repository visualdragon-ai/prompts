// Paper art for "The Power Room": every prop is a Canvas2D drawing turned into a cut-out (white border, card edge, grain)
import { mulberry, TAU } from './engine/lib.js';
import { cv, finishCut, sh, blob, smoothOpen, crescent, paperFill, INK, rr } from './engine/paper.js';

export const LW = 9, LW2 = 5;
export const PPM = 5200;                     // pixels per metre
export function cut(wm, hm, draw, o = {}) {
  const pad = o.pad ?? 30, w = Math.ceil(wm * PPM) + pad * 2, h = Math.ceil(hm * PPM) + pad * 2;
  const c = cv(w, h), x = c.getContext('2d'); x.translate(pad, pad);
  draw(x, w - pad * 2, h - pad * 2);
  const out = o.raw ? c : finishCut(c, o.border ?? 14, o);
  return { c: out, w: w / PPM, h: h / PPM, ax: o.ax ?? .5, ay: o.ay ?? 1 - pad / h, pad };
}
const label = (x, text, cx, cy, size, col = INK, font = 'Fredoka', weight = 700) => {
  x.font = `${weight} ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(text, cx, cy);
};
const plate = (x, cx, cy, w, h, text, size, bg = '#fffaf0', fg = INK) => {
  rr(x, cx - w / 2, cy - h / 2, w, h, h * .25); sh(x, bg, LW2); label(x, text, cx, cy + size * .05, size, fg);
};

// ---------- Spread 1: the path ----------
export function pylon(hm) {
  return cut(hm * .5, hm, (x, W, H) => {
    const c = '#9db4cc', s = '#6f89a6';
    const leg = (a, b) => { x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineWidth = 16; x.strokeStyle = INK; x.lineCap = 'round'; x.stroke(); x.lineWidth = 8; x.strokeStyle = c; x.stroke(); };
    const L = [W * .2, H], R = [W * .8, H], tl = [W * .44, H * .08], tr = [W * .56, H * .08];
    // bracing
    x.lineWidth = 5; x.strokeStyle = s; x.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const y0 = H * (.12 + i * .145), y1 = H * (.12 + (i + 1) * .145);
      const xl = k => W * (.44 - (.24 * (k - .08) / .92)), xr = k => W - xl(k);
      x.beginPath(); x.moveTo(xl(y0 / H), y0); x.lineTo(xr(y1 / H), Math.min(y1, H)); x.moveTo(xr(y0 / H), y0); x.lineTo(xl(y1 / H), Math.min(y1, H)); x.stroke();
    }
    leg(L, tl); leg(R, tr);
    // cross-arms + insulators
    for (const [y, w] of [[.2, .46], [.38, .38]]) {
      rr(x, W * (.5 - w), H * y - 10, W * w * 2, 20, 6); sh(x, c, LW2);
      for (const sx of [-1, 1]) { const px = W * (.5 + sx * (w - .03)); rr(x, px - 9, H * y + 8, 18, 46, 8); sh(x, '#f6f1e6', 4); }
    }
    x.beginPath(); x.moveTo(W * .5, 0); x.lineTo(W * .44, H * .1); x.lineTo(W * .56, H * .1); x.closePath(); sh(x, c, LW2);
  }, { pad: 40 });
}
export function transformer(wm) {
  return cut(wm, wm * .95, (x, W, H) => {
    const c = '#3fa7a3', s = '#2f8582';
    // bushings
    for (const k of [.3, .5, .7]) { rr(x, W * k - 16, 0, 32, H * .2, 10); sh(x, '#f6f1e6', LW2); for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(W * k - 18, H * .045 * i); x.lineTo(W * k + 18, H * .045 * i); x.lineWidth = 4; x.strokeStyle = '#b7aa95'; x.stroke(); } }
    // tank
    const body = () => rr(x, W * .12, H * .17, W * .76, H * .83, 18);
    crescent(x, body, s, 30, 0, c); body(); sh(x, null, LW);
    // fins
    for (const sx of [0, 1]) for (let i = 0; i < 4; i++) { const px = sx ? W * .9 + i * 0 : W * .02; rr(x, sx ? W * .88 : W * .02, H * (.28 + i * .17), W * .1, H * .1, 8); sh(x, s, LW2); }
    plate(x, W * .5, H * .42, W * .62, H * .15, 'TRANSFORMER', H * .085);
    rr(x, W * .32, H * .63, W * .36, H * .16, 16); sh(x, '#ffd34d', LW2); label(x, '400 V', W * .5, H * .715, H * .1);
  });
}
export function switchboardSmall(wm, hm) {      // the lineup as seen from outside, in spread 1
  return cut(wm, hm, (x, W, H) => {
    const n = 3, sw = W / n;
    for (let i = 0; i < n; i++) {
      const body = () => rr(x, i * sw + 3, 0, sw - 6, H, 10);
      crescent(x, body, '#9fb0c2', 18, 0, '#d4dde7'); body(); sh(x, null, LW);
      // louvres
      for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(i * sw + sw * .25, H * (.08 + k * .04)); x.lineTo(i * sw + sw * .75, H * (.08 + k * .04)); x.lineWidth = 5; x.strokeStyle = '#8a9bb0'; x.stroke(); }
      // breaker face
      rr(x, i * sw + sw * .2, H * .32, sw * .6, H * .36, 10); sh(x, '#4b5566', LW2);
      label(x, 'ON', i * sw + sw * .5, H * .37, H * .05, '#fffaf0');
      label(x, 'OFF', i * sw + sw * .5, H * .64, H * .05, '#fffaf0');
      rr(x, i * sw + sw * .44, H * .42, sw * .12, H * .17, 6); sh(x, '#20242c', 4);
    }
  });
}
export function rack(wm, hm, labelText) {
  return cut(wm, hm, (x, W, H) => {
    const body = () => rr(x, 0, 0, W, H, 12);
    crescent(x, body, '#273241', 22, 0, '#3c4b5e'); body(); sh(x, null, LW);
    const n = Math.round(H / 46);
    for (let i = 0; i < n - 1; i++) { rr(x, W * .1, H * .06 + i * (H * .86 / (n - 1)), W * .8, H * .86 / (n - 1) * .7, 5); sh(x, '#52637a', 4); }
    if (labelText) plate(x, W * .5, H - 40, W * .8, 46, labelText, 30);
  });
}
export function bush(wm, hm, col, shade, seed) {
  return cut(wm, hm, (x, W, H) => {
    const R = mulberry(seed), p = () => { x.beginPath(); const n = 5; for (let i = 0; i < n; i++) { const cx = W * (.15 + .7 * i / (n - 1)), r = H * (.35 + R() * .25); x.moveTo(cx + r, H); x.arc(cx, H - r * .9, r, 0, TAU); } };
    const R0 = mulberry(seed); const pp = () => { const R = mulberry(seed); p.call(null); };
    const path = () => { const Rr = mulberry(seed); x.beginPath(); for (let i = 0; i < 5; i++) { const cx = W * (.15 + .7 * i / 4), r = H * (.35 + Rr() * .25); x.moveTo(cx + r, H - r * .9); x.arc(cx, H - r * .9, r, 0, TAU); } x.rect(W * .12, H * .55, W * .76, H * .45); };
    crescent(x, path, shade, 0, -26, col); path(); x.lineWidth = LW; x.strokeStyle = INK; x.stroke();
  });
}
export function tree(hm, col, shade, seed) {
  return cut(hm * .55, hm, (x, W, H) => {
    rr(x, W * .45, H * .5, W * .1, H * .5, 8); sh(x, '#8d5a31', LW2);
    const p = () => blob(x, W * .5, H * .36, W * .46, H * .34, .06, seed);
    crescent(x, p, shade, 24, 20, col); p(); sh(x, null, LW);
  });
}
export function cloud(wm, seed) {
  return cut(wm, wm * .45, (x, W, H) => {
    const p = () => { x.beginPath(); x.moveTo(W * .1, H * .9); x.arc(W * .24, H * .62, H * .3, Math.PI * .6, Math.PI * 1.55); x.arc(W * .48, H * .42, H * .38, Math.PI * 1.1, Math.PI * 1.9); x.arc(W * .74, H * .54, H * .3, Math.PI * 1.25, Math.PI * .15); x.closePath(); };
    crescent(x, p, '#d7e6f2', 0, -20, '#ffffff'); p(); sh(x, null, LW);
  }, { ay: 0 });
}
// hanging title sign (cardboard, two strings)
export function titleSign(wm, lines) {
  return cut(wm, wm * .34, (x, W, H) => {
    const b = () => { x.beginPath(); x.moveTo(W * .02, H * .06); x.lineTo(W * .98, H * .02); x.lineTo(W * .99, H * .96); x.lineTo(W * .01, H * .98); x.closePath(); };
    crescent(x, b, '#c48a52', 0, 22, '#e3ad6f'); b(); sh(x, null, LW);
    for (const px of [W * .1, W * .9]) { x.beginPath(); x.arc(px, H * .14, 12, 0, TAU); sh(x, '#5a3a22', 4); }
    x.save(); x.translate(W / 2, H * .5); x.rotate(-.015);
    x.font = `${Math.round(H * .3)}px "Lilita One"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const ys = lines.length === 1 ? [0] : [-H * .17, H * .2];
    lines.forEach((l, i) => { x.lineWidth = 14; x.strokeStyle = INK; x.strokeText(l, 0, ys[i]); x.fillStyle = i ? '#fffaf0' : '#ffcf3f'; x.fillText(l, 0, ys[i]); });
    x.restore();
  }, { ay: 0 });
}

// ---------- Spread 2: inside the lineup ----------
export const SECTIONS = ['GEN', 'MAIN', 'UPS 1', 'UPS 2', 'COOLING', 'LIGHTS'];
export const LINEUP_W = .38, LINEUP_H = .16;
export const BUS_Y = [.128, .118, .108];        // copper busbar heights (m, from the page)
export const BRK_Y = .062;                     // breaker handle pivot height
export function lineup() {
  return cut(LINEUP_W, LINEUP_H, (x, W, H) => {
    const n = SECTIONS.length, sw = W / n, Y = m => H - m * PPM;
    for (let i = 0; i < n; i++) {
      const x0 = i * sw, inc = i < 2;
      const body = () => rr(x, x0 + 3, 0, sw - 6, H, 12);
      crescent(x, body, '#a9b7c6', 20, 0, '#d9e1ea'); body(); sh(x, null, LW);
      // name plate
      plate(x, x0 + sw / 2, H * .07, sw * .78, H * .085, SECTIONS[i], H * .05, inc ? '#ffcf3f' : '#fffaf0');
      // busbar cut-away window
      rr(x, x0 + 3, Y(.136), sw - 6, PPM * .036, 4); sh(x, '#3a3f4a', 0);
      // breaker face
      const bw = sw * (inc ? .74 : .62), bh = H * (inc ? .36 : .3), bx = x0 + (sw - bw) / 2, by = Y(BRK_Y) - bh * .5;
      rr(x, bx, by, bw, bh, 12); sh(x, inc ? '#3d4655' : '#4b5566', LW2);
      label(x, 'ON', x0 + sw / 2, by + bh * .13, H * .036, '#fffaf0');
      label(x, 'OFF', x0 + sw / 2, by + bh * .87, H * .036, '#fffaf0');
      rr(x, x0 + sw / 2 - 12, by + bh * .25, 24, bh * .5, 8); sh(x, '#1d2028', 3);
      // indicator lamp ring
      x.beginPath(); x.arc(x0 + sw * .8, Y(.092), 15, 0, TAU); sh(x, '#2a2e36', 4);
      // cable gland at the bottom
      rr(x, x0 + sw / 2 - 22, H - 26, 44, 26, 6); sh(x, '#2a2e36', 4);
      // vertical riser from the busbar down to the breaker (the "dropper")
      rr(x, x0 + sw / 2 - 8, Y(.104), 16, Y(BRK_Y + .022) - Y(.104), 4); sh(x, '#c9773a', 3);
    }
    // copper busbars across the whole lineup (in front of the cut-away)
    BUS_Y.forEach((b, k) => { rr(x, 6, Y(b) - 11, W - 12, 22, 8); sh(x, ['#e08a4c', '#d27a3e', '#c56b33'][k], 4); x.fillStyle = 'rgba(255,240,210,.55)'; x.fillRect(16, Y(b) - 7, W - 32, 4); });
  }, { border: 16 });
}
export function handle() {          // breaker toggle paddle; anchor = pivot at the bottom
  return cut(.006, .02, (x, W, H) => {
    rr(x, W * .1, 0, W * .8, H, W * .4); sh(x, '#20242c', LW2);
    rr(x, W * .25, H * .06, W * .5, H * .3, W * .25); sh(x, '#5a6578', 0);
  }, { border: 10, pad: 22, ay: .86 });
}
export function upsCab(wm, hm, name) {
  return cut(wm, hm, (x, W, H) => {
    const body = () => rr(x, 0, 0, W, H, 14);
    crescent(x, body, '#cfc4ac', 22, 0, '#efe7d4'); body(); sh(x, null, LW);
    plate(x, W / 2, H * .13, W * .7, H * .14, name, H * .085, '#7fd3a0');
    rr(x, W * .15, H * .32, W * .7, H * .2, 10); sh(x, '#2a2e36', LW2);           // display (battery bar window)
    for (let i = 0; i < 4; i++) { rr(x, W * .18, H * (.6 + i * .085), W * .64, H * .05, 5); sh(x, '#d8ccb2', 3); }
  });
}
export function coolUnit(wm, hm) {
  return cut(wm, hm, (x, W, H) => {
    const body = () => rr(x, 0, 0, W, H, 14);
    crescent(x, body, '#93b9cf', 22, 0, '#c4def0'); body(); sh(x, null, LW);
    plate(x, W / 2, H * .12, W * .74, H * .14, 'COOLING', H * .08);
    x.beginPath(); x.arc(W / 2, H * .58, W * .34, 0, TAU); sh(x, '#2a3a4a', LW2);
  });
}
export function fan(rm) {
  return cut(rm * 2, rm * 2, (x, W, H) => {
    x.translate(W / 2, H / 2);
    for (let i = 0; i < 4; i++) { x.save(); x.rotate(i * TAU / 4); x.beginPath(); x.ellipse(0, -W * .26, W * .13, W * .25, .35, 0, TAU); sh(x, '#e9f3fa', 4); x.restore(); }
    x.beginPath(); x.arc(0, 0, W * .09, 0, TAU); sh(x, '#7d8b98', 4);
  }, { border: 0, pad: 8, ay: .5, grain: false });
}
export function lightLamp(hm) {
  return cut(hm * .62, hm, (x, W, H) => {
    rr(x, W * .46, H * .4, W * .08, H * .55, 6); sh(x, '#6c5a48', LW2);
    rr(x, W * .25, H * .92, W * .5, H * .08, 8); sh(x, '#6c5a48', LW2);
    x.beginPath(); x.moveTo(W * .12, H * .42); x.lineTo(W * .3, H * .08); x.lineTo(W * .7, H * .08); x.lineTo(W * .88, H * .42); x.closePath(); sh(x, '#ffd766', LW);
    plate(x, W / 2, H * .62, W * .9, H * .12, 'LIGHTS', H * .075);
  });
}
export function generator(wm) {
  return cut(wm, wm * .72, (x, W, H) => {
    rr(x, W * .72, 0, W * .1, H * .35, 6); sh(x, '#55606e', LW2);                // exhaust stack
    const body = () => rr(x, 0, H * .22, W, H * .7, 18);
    crescent(x, body, '#d9a02f', 26, 0, '#f2c14e'); body(); sh(x, null, LW);
    for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(W * .08, H * (.36 + i * .07)); x.lineTo(W * .4, H * (.36 + i * .07)); x.lineWidth = 6; x.strokeStyle = '#b8862a'; x.stroke(); }
    plate(x, W * .66, H * .5, W * .52, H * .17, 'GENERATOR', H * .09);
    for (const px of [W * .12, W * .88]) { rr(x, px - 28, H * .88, 56, H * .12, 6); sh(x, '#4a3a2a', LW2); }
  });
}
export function padlock(hm) {
  return cut(hm * .8, hm, (x, W, H) => {
    x.beginPath(); x.arc(W / 2, H * .4, W * .28, Math.PI, 0); x.lineWidth = 22; x.strokeStyle = INK; x.stroke(); x.lineWidth = 12; x.strokeStyle = '#b8bfc9'; x.stroke();
    rr(x, W * .08, H * .38, W * .84, H * .6, 14); sh(x, '#ffcf3f', LW);
    x.beginPath(); x.arc(W / 2, H * .62, 12, 0, TAU); x.fillStyle = INK; x.fill(); x.fillRect(W / 2 - 5, H * .62, 10, 34);
  }, { border: 12 });
}
export function zap(rm) {
  return cut(rm * 2, rm * 2, (x, W, H) => {
    x.translate(W / 2, H / 2); x.beginPath();
    const R = mulberry(5);
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, r = i % 2 ? W * .2 : W * (.38 + R() * .1); x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); sh(x, '#ff5a3a', LW);
    x.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .2, r = i % 2 ? W * .1 : W * .22; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); sh(x, '#ffe35a', 0);
  }, { border: 12, ay: .5 });
}
export function utilitySign(wm) {    // hangs on the wall in spread 2: a tiny pylon + "UTILITY"
  return cut(wm, wm * .55, (x, W, H) => {
    const b = () => rr(x, 0, 0, W, H, 18);
    crescent(x, b, '#c48a52', 0, 18, '#e3ad6f'); b(); sh(x, null, LW);
    x.save(); x.translate(W * .2, H * .12); const s = H * .76;
    x.beginPath(); x.moveTo(s * .1, s); x.lineTo(s * .45, 0); x.lineTo(s * .8, s); x.moveTo(s * .2, s * .3); x.lineTo(s * .7, s * .3); x.moveTo(s * .25, s * .55); x.lineTo(s * .65, s * .55);
    x.lineWidth = 9; x.strokeStyle = INK; x.lineCap = 'round'; x.stroke(); x.restore();
    label(x, 'UTILITY', W * .62, H * .38, H * .26);
    x.beginPath(); x.arc(W * .62, H * .72, H * .1, 0, TAU); sh(x, '#2a2e36', 4);
  }, { ay: 0 });
}

// ---------- Pages ----------
export const PW = 2048, PH = 1396;
export const gx = xm => (xm + .22) / .44 * PW, gz = zm => zm / .30 * PH;
export function pages() {
  const P = {};
  // spread 1 backdrop: sky + far hills
  { const c = cv(PW, PH), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, '#5fb4e6'); g.addColorStop(1, '#bfe6f5'); x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    paperFill(x, PW, PH, 'rgba(0,0,0,0)', 3, .05);
    const hillP = (y, a, col, seed) => { const R = mulberry(seed); x.beginPath(); x.moveTo(0, PH); for (let i = 0; i <= 8; i++) x.lineTo(i / 8 * PW, y - R() * a); x.lineTo(PW, PH); x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = 8; x.strokeStyle = 'rgba(58,42,36,.6)'; x.stroke(); };
    hillP(PH * .78, 160, '#8fd0c4', 4); hillP(PH * .88, 120, '#6fbfae', 5);
    P.sky1 = c; }
  // spread 1 ground: teal grass with a cable trench path
  { const c = cv(PW, PH), x = c.getContext('2d'); paperFill(x, PW, PH, '#7cc9a8', 6, .07);
    const R = mulberry(8); x.strokeStyle = '#5fae8d'; x.lineWidth = 6; x.lineCap = 'round';
    for (let i = 0; i < 160; i++) { const px = R() * PW, py = R() * PH; x.beginPath(); x.moveTo(px - 10, py); x.lineTo(px - 4, py - 18); x.moveTo(px + 4, py); x.lineTo(px + 6, py - 22); x.stroke(); }
    // trench: transformer → switchgear → racks
    x.lineJoin = 'round'; x.lineCap = 'round';
    const pts = [[-.06, .165], [.0, .175], [.06, .165], [.1, .135], [.14, .105]].map(([a, b]) => [gx(a), gz(b)]);
    for (const [lw, col] of [[44, '#3a2a24'], [30, '#8a6a4a']]) { x.beginPath(); smoothOpen(x, pts); x.lineWidth = lw; x.strokeStyle = col; x.stroke(); }
    P.ground1 = c; }
  // spread 2 backdrop: warm terracotta wall with cable trays
  { const c = cv(PW, PH), x = c.getContext('2d'); paperFill(x, PW, PH, '#e39a6a', 9, .06);
    for (let i = 0; i < 2; i++) { const y = PH * (.12 + i * .07); rr(x, 40, y, PW - 80, 34, 10); sh(x, '#c97c4c', 7, 'rgba(58,42,36,.75)'); }
    x.globalAlpha = .18; x.fillStyle = '#fff3e0'; for (let i = 0; i < 9; i++) x.fillRect(i * PW / 9 + 30, PH * .3, 6, PH * .7); x.globalAlpha = 1;
    P.sky2 = c; }
  // spread 2 ground: warm raised-floor tiles + cables from the lineup to the loads
  { const c = cv(PW, PH), x = c.getContext('2d'); paperFill(x, PW, PH, '#f0cf97', 11, .06);
    x.strokeStyle = 'rgba(160,110,60,.45)'; x.lineWidth = 5;
    for (let i = 0; i <= 12; i++) { x.beginPath(); x.moveTo(i * PW / 12, 0); x.lineTo(i * PW / 12, PH); x.stroke(); }
    for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(0, i * PH / 8); x.lineTo(PW, i * PH / 8); x.stroke(); }
    for (const path of CABLES) { const pts = path.map(([a, b]) => [gx(a), gz(b)]); for (const [lw, col] of [[34, '#3a2a24'], [20, '#4a5262']]) { x.beginPath(); smoothOpen(x, pts); x.lineWidth = lw; x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(); } }
    P.ground2 = c; }
  return P;
}

// section centres and load positions (metres; x across, z from the spine)
export const SX = SECTIONS.map((_, i) => -LINEUP_W / 2 + LINEUP_W / 12 * (2 * i + 1));
export const LZ = .07;                       // lineup z
export const LOAD = { gen: [-.175, .215], ups1: [-.075, .165], ups2: [.005, .165], racksA: [-.04, .25], racksB: [.045, .25], cool: [.092, .2], lights: [.168, .205] };
export const CABLES = [
  [[SX[0], LZ + .01], [SX[0], .15], [LOAD.gen[0], LOAD.gen[1] - .02]],
  [[SX[2], LZ + .01], [SX[2], .12], [LOAD.ups1[0], LOAD.ups1[1] - .01]],
  [[SX[3], LZ + .01], [SX[3], .12], [LOAD.ups2[0], LOAD.ups2[1] - .01]],
  [[SX[4], LZ + .01], [SX[4], .14], [LOAD.cool[0], LOAD.cool[1] - .01]],
  [[SX[5], LZ + .01], [SX[5], .15], [LOAD.lights[0], LOAD.lights[1] - .01]],
  [[LOAD.ups1[0], LOAD.ups1[1] + .01], [LOAD.ups1[0] + .01, .215], [LOAD.racksA[0], LOAD.racksA[1] - .012]],
  [[LOAD.ups2[0], LOAD.ups2[1] + .01], [LOAD.ups2[0] + .01, .215], [LOAD.racksB[0], LOAD.racksB[1] - .012]],
];

// book cover (seen only briefly; cloth + gold title)
export function coverArt(x, w, h) {
  x.font = '190px "Lilita One"'; x.textAlign = 'center'; x.fillText('The Power Room', w * .5, h * .5);
}
