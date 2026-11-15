// The console, laid out at 1600 x 900: title and ratings, the breaker state, a live single-line diagram of the MV room
// down to the racks, the readouts with a current trace, the four sequences, views, display toggles, the timeline and
// the labels with leaders into the machine. update(s) redraws every live part from the frame's state.
import {COL} from './hall.js';
import {heroWords, HERO, P, phaseAt, RATING, SEQ, SEQS, stateAt} from './model.js';

export const C = {ink: '#1f2328', mute: '#7d848c', faint: '#d3d7d5', line: '#dfe3e1', panel: 'rgba(255,255,255,.93)', or: '#e3562a'};
export const VIEWS = ['hero', 'front', 'side', 'breaker', 'cables', 'hall'];
export const VIEW_LABEL = {hero: 'HERO ¾', front: 'FRONT', side: 'SIDE', breaker: 'BREAKER', cables: 'CABLES', hall: 'DATA HALL'};
export const DISPLAY = ['labels', 'section', 'xray', 'exploded', 'orbit'];
export const DISPLAY_LABEL = {labels: 'LABELS', section: 'SECTION', xray: 'X-RAY', exploded: 'EXPLODED', orbit: 'ORBIT'};

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.ui .card{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 1px 2px rgba(20,30,40,.04)}
.ui .k{font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.4px;color:${C.mute};text-transform:uppercase}
.ui .ttl{position:absolute;left:26px;top:22px}
.ui .ttl b{display:block;font:800 25px/1 Inter;letter-spacing:-.4px}
.ui .ttl span{display:block;margin-top:7px;font:600 10px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.mute}}
.ui .badge{font-style:normal;display:inline-block;margin-right:8px;padding:3px 7px;border-radius:3px;background:${C.or};color:#fff;font:700 10px 'JetBrains Mono',monospace;letter-spacing:1px;vertical-align:4px}
.ui .chips{position:absolute;right:26px;top:24px;display:flex;gap:6px}
.ui .chip{padding:6px 9px;border:1px solid ${C.line};border-radius:4px;background:${C.panel};font:700 10px 'JetBrains Mono',monospace;letter-spacing:1px}
.ui .chip i{font-style:normal;color:${C.mute};margin-right:5px}
.ui .state{display:flex;align-items:center;gap:12px;padding:0 14px}
.ui .dot{width:12px;height:12px;border-radius:50%;flex:none}
.ui .state b{display:block;font:700 17px/1.1 Inter}
.ui .state span{display:block;margin-top:4px;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.mute}}
.ui .row{display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-top:1px solid ${C.line}}
.ui .row:first-of-type{border-top:0}
.ui .row .v{font:700 13px 'JetBrains Mono',monospace;letter-spacing:.3px}
.ui .big{font:800 30px/1 Inter;letter-spacing:-.6px}
.ui .big small{font:700 12px 'JetBrains Mono',monospace;color:${C.mute};margin-left:4px;letter-spacing:.5px}
.ui .bt{position:absolute;display:flex;align-items:center;justify-content:center;border:1px solid ${C.line};border-radius:4px;background:#fff;font:700 10px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:${C.ink};pointer-events:auto;cursor:pointer;user-select:none;}
.ui .bt:hover{border-color:#b9bfbc}
.ui .bt.on{background:${C.ink};color:#fff;border-color:${C.ink}}
.ui .bt.seq{flex-direction:column;align-items:flex-start;justify-content:center;padding:0 12px}
.ui .bt.seq small{display:block;margin-top:4px;font:600 8.5px 'JetBrains Mono',monospace;letter-spacing:1px;color:${C.mute}}
.ui .bt.seq.on small{color:#c9ced3}
.ui .bt.seq.on{background:${C.or};border-color:${C.or}}
.ui .phase{position:absolute;text-shadow:0 0 4px #fff,0 0 10px #fff,0 0 2px #fff;font:700 14px 'JetBrains Mono',monospace;letter-spacing:.6px;white-space:nowrap}
.ui .phase i{font-style:normal;color:${C.or};margin-right:8px}
.ui .clock{position:absolute;text-shadow:0 0 4px #fff,0 0 10px #fff,0 0 2px #fff;font:700 10px 'JetBrains Mono',monospace;letter-spacing:1px;color:${C.mute};text-align:right;white-space:nowrap}
.ui .clock b{color:${C.ink};font-size:12px}
.ui .slow{color:${C.or}!important}
.ui .tl{position:absolute;height:4px;border-radius:2px;background:${C.faint}}
.ui .tl div{height:100%;border-radius:2px;background:${C.ink}}
.ui .knob{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;border:2px solid ${C.ink}}
.ui .tick{position:absolute;width:2px;height:10px;margin-left:-1px;background:${C.or};border-radius:1px}
.ui .call{position:absolute;white-space:nowrap}
.ui .call b{display:flex;align-items:center;gap:6px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1px}
.ui .call b i{display:block;width:7px;height:7px;background:${C.or}}
.ui .call span{display:block;margin:2px 0 0 13px;font:600 8.5px 'JetBrains Mono',monospace;letter-spacing:.9px;color:${C.mute}}
.ui .cursor{position:absolute;width:22px;height:22px;margin:-2px 0 0 -3px;pointer-events:none}
.ui .ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:2px solid ${C.or};pointer-events:none}
.ui .legend{display:flex;gap:10px;flex-wrap:wrap;font:700 8.5px 'JetBrains Mono',monospace;letter-spacing:.8px;color:${C.mute}}
.ui .legend span{display:flex;align-items:center;gap:4px}
.ui .legend i{display:block;width:12px;height:3px;border-radius:2px}
`;

const el = (parent, cls, style = {}, html = '') => {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  Object.assign(d.style, style);
  if (html) d.innerHTML = html;
  parent.appendChild(d);
  return d;
};
const px = (n) => `${n}px`;

// ------------------------------------------------------------ the single-line diagram, 300 x 420
const SLD = (s, e, t) => {
  const live = (on, col = COL.grid) => (on ? col : COL.dead);
  const w = (on) => (on ? 3 : 2);
  const dash = (on) => (on ? '' : 'stroke-dasharray="4 3"');
  const ln = (x1, y1, x2, y2, on, col) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${live(on, col)}" stroke-width="${w(on)}" ${dash(on)} stroke-linecap="round"/>`;
  const brk = (x, y, travel, i) => {
    const hero = i === HERO;
    const closed = travel > 0.5;
    const faultHere = hero && s.fault;
    const col = faultHere && Math.sin(t * 30) > 0 ? COL.fault : C.ink;
    const mid = travel > 0.02 && travel < 0.98;
    return `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" rx="2" fill="${closed ? col : '#fff'}" stroke="${col}" stroke-width="2"${mid ? ' stroke-dasharray="3 2"' : ''}/>` +
      (hero ? `<rect x="${x - 13}" y="${y - 13}" width="26" height="26" rx="4" fill="none" stroke="${C.or}" stroke-width="1.6"/>` : '');
  };
  const txt = (x, y, str, anchor = 'middle', col = C.mute, size = 8.5) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="JetBrains Mono" font-weight="700" font-size="${size}" letter-spacing=".6" fill="${col}">${str}</text>`;
  const gA = !!s.grid[0];
  const gB = !!s.grid[1];
  let o = '';
  // grids
  for (const [x, on, n] of [[56, gA, 'GRID A'], [244, gB, 'GRID B']]) {
    o += `<circle cx="${x}" cy="22" r="11" fill="#fff" stroke="${live(on)}" stroke-width="2"/><path d="M${x - 6} 22 q3 -5 6 0 t6 0" fill="none" stroke="${live(on)}" stroke-width="1.6"/>`;
    o += txt(x + (x < 150 ? -16 : 16), 26, n, x < 150 ? 'end' : 'start');
  }
  o += ln(56, 33, 56, 64, gA) + ln(244, 33, 244, 64, gB);
  o += ln(56, 88, 56, 112, e.busA) + ln(244, 88, 244, 112, e.busB);
  // buses and the tie
  o += ln(28, 112, 136, 112, e.busA) + ln(164, 112, 272, 112, e.busB);
  o += txt(28, 104, 'BUS A', 'start') + txt(272, 104, 'BUS B', 'end');
  // feeders
  o += ln(96, 112, 96, 136, e.busA) + ln(204, 112, 204, 136, e.busB, s.fault ? COL.fault : COL.grid);
  o += ln(96, 160, 96, 186, e.t1) + ln(204, 160, 204, 186, e.busB && e.c[3], s.fault ? COL.fault : COL.grid);
  o += brk(56, 76, s.brk[0], 0) + brk(150, 112, s.brk[2], 2) + brk(96, 148, s.brk[1], 1) + brk(204, 148, s.brk[3], 3) + brk(244, 76, s.brk[4], 4);
  o += txt(150, 134, 'TIE') + txt(76, 152, 'F-T1', 'end') + txt(224, 152, 'F-T2', 'start', C.or);
  if (s.fault) o += `<path d="M196 172 l8 -6 l-4 8 l9 -5" fill="none" stroke="${COL.fault}" stroke-width="2"/>` + txt(212, 180, '21 kA', 'start', COL.fault);
  // transformers
  for (const [x, on, n] of [[96, e.t1, 'T1'], [204, e.t2, 'T2']]) {
    o += `<circle cx="${x}" cy="194" r="9" fill="none" stroke="${live(on)}" stroke-width="2"/><circle cx="${x}" cy="206" r="9" fill="none" stroke="${live(on)}" stroke-width="2"/>`;
    o += txt(x + (x < 150 ? -14 : 14), 204, n, x < 150 ? 'end' : 'start');
    o += ln(x, 215, x, 240, on);
    // UPS box with a battery
    const bat = !on;
    o += `<rect x="${x - 26}" y="240" width="52" height="26" rx="3" fill="#fff" stroke="${bat ? COL.bat : live(on)}" stroke-width="2"/>`;
    o += txt(x, 257, bat ? 'BATTERY' : 'UPS', 'middle', bat ? COL.bat : C.ink, 8.5);
  }
  o += txt(150, 232, '11 kV → 415 V', 'middle', C.mute, 7.5);
  // A and B cords to the racks
  const colA = e.t1 ? COL.cordA : COL.bat;
  const colB = e.t2 ? COL.cordB : COL.bat;
  o += `<line x1="96" y1="266" x2="96" y2="300" stroke="${colA}" stroke-width="2.5"/><line x1="40" y1="300" x2="260" y2="300" stroke="${colA}" stroke-width="2.5"/>`;
  o += `<line x1="204" y1="266" x2="204" y2="308" stroke="${colB}" stroke-width="2.5"/><line x1="40" y1="308" x2="260" y2="308" stroke="${colB}" stroke-width="2.5"/>`;
  for (let i = 0; i < 6; i++) {
    const x = 50 + i * 40;
    o += `<line x1="${x - 5}" y1="300" x2="${x - 5}" y2="326" stroke="${colA}" stroke-width="1.6"/><line x1="${x + 5}" y1="308" x2="${x + 5}" y2="326" stroke="${colB}" stroke-width="1.6"/>`;
    o += `<rect x="${x - 12}" y="326" width="24" height="34" rx="2" fill="${C.ink}"/>`;
    for (let j = 0; j < 3; j++) o += `<rect x="${x - 7}" y="${332 + j * 9}" width="14" height="2" fill="${COL.grid}" opacity="${0.6 + 0.4 * Math.sin(t * 7 + i * 1.7 + j)}"/>`;
  }
  o += txt(150, 376, `IT RACKS · ${(e.racks * 100).toFixed(0)} % POWERED`, 'middle', C.ink, 9);
  return o;
};

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = el(app, 'ui');
  const btn = {};
  const spots = {};
  const mkBtn = (key, label, x, y, w, h, cls = 'bt') => {
    const b = el(root, cls, {left: px(x), top: px(y), width: px(w), height: px(h)}, label);
    btn[key] = b;
    spots[key] = [x + w / 2, y + h / 2];
    return b;
  };

  // title and ratings
  el(root, 'ttl', {}, `<b><em class="badge">MVS</em>Medium-voltage switchgear</b><span>AIR-INSULATED · METAL-CLAD · WITHDRAWABLE VACUUM CIRCUIT BREAKER · IEC 62271-200</span>`);
  el(root, 'chips', {}, [['Ur', `${RATING.Ur} kV`], ['Ir', `${RATING.Ir} A`], ['Ik', `${RATING.Ik} kA / ${RATING.tk} s`], ['f', `${RATING.f} Hz`], ['W×H×D', `${P.W * 1000}×${P.H * 1000}×${P.D * 1000}`]].map(([k, v]) => `<div class="chip"><i>${k}</i>${v}</div>`).join(''));

  // state
  const stateC = el(root, 'card state', {left: '24px', top: '100px', width: '300px', height: '62px'});
  const dot = el(stateC, 'dot');
  const stTxt = el(stateC, '');

  // single-line diagram
  const sldC = el(root, 'card', {left: '24px', top: '172px', width: '300px', height: '466px'});
  el(sldC, 'k', {position: 'absolute', left: '14px', top: '12px'}, 'How it powers the data hall');
  const sld = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sld.setAttribute('viewBox', '0 0 300 384');
  Object.assign(sld.style, {position: 'absolute', left: '0', top: '34px', width: '300px', height: '384px'});
  sldC.appendChild(sld);
  el(sldC, 'legend', {position: 'absolute', left: '14px', bottom: '12px', width: '272px'},
    `<span><i style="background:${COL.grid}"></i>LIVE 11 kV</span><span><i style="background:${COL.dead}"></i>DEAD</span><span><i style="background:${COL.cordA}"></i>A CORD</span><span><i style="background:${COL.cordB}"></i>B CORD</span><span><i style="background:${COL.bat}"></i>ON BATTERY</span><span><i style="background:${C.or}"></i>THIS PANEL</span>`);

  // readouts
  const rd = el(root, 'card', {left: '1276px', top: '100px', width: '300px', height: '376px', padding: '12px 14px', boxSizing: 'border-box'});
  el(rd, 'k', {}, 'Feeder T2 · this panel');
  const big = el(rd, 'big', {marginTop: '8px'});
  const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chart.setAttribute('viewBox', '0 0 272 58');
  Object.assign(chart.style, {display: 'block', width: '272px', height: '58px', margin: '6px 0 4px'});
  rd.appendChild(chart);
  const rows = el(rd, '', {});
  const ROWS = ['BUS A / BUS B', 'INCOMER A / B', 'CONTACT GAP', 'TRUCK', 'EARTHING SWITCH', 'PROTECTION', 'UPS A / UPS B', 'IT LOAD'];
  const rv = {};
  for (const r of ROWS) {
    const d = el(rows, 'row', {}, `<span class="k">${r}</span>`);
    rv[r] = el(d, 'v');
  }

  // views and display
  el(root, 'k', {position: 'absolute', left: '1278px', top: '484px'}, 'Views');
  VIEWS.forEach((v, i) => mkBtn(v, VIEW_LABEL[v], 1276 + (i % 3) * 101, 500 + Math.floor(i / 3) * 36, 96, 30));
  el(root, 'k', {position: 'absolute', left: '1278px', top: '584px'}, 'Take it apart');
  DISPLAY.forEach((v, i) => mkBtn(v, DISPLAY_LABEL[v], 1276 + (i % 3) * 101, 600 + Math.floor(i / 3) * 36, 96, 30));

  // sequences, play, the timeline
  el(root, 'k', {position: 'absolute', left: '26px', top: '762px'}, 'Run a scenario');
  SEQS.forEach((k, i) => mkBtn(k, `${SEQ[k].label}<small>${SEQ[k].sub}</small>`, 24 + i * 160, 778, 152, 50, 'bt seq'));
  mkBtn('play', '❚❚', 676, 778, 50, 50);
  const phase = el(root, 'phase', {left: '748px', top: '782px'});
  const TL = {x: 748, w: 828};
  const tl = el(root, 'tl', {left: px(TL.x), top: '819px', width: px(TL.w)});
  const tlFill = el(tl, '');
  const ticks = el(root, '', {position: 'absolute', left: '0', top: '0'});
  const knob = el(root, 'knob', {top: '821px'});
  const clock = el(root, 'clock', {left: px(TL.x), top: '836px', width: px(TL.w)});
  el(root, 'k', {position: 'absolute', left: '26px', top: '846px', fontSize: '8.5px'}, 'Typical 12 kV metal-clad panel. Values are representative, not a specific product. Drag to orbit, wheel to zoom.');

  // callouts and cursor
  const callSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.assign(callSvg.style, {position: 'absolute', left: 0, top: 0, width: '1600px', height: '900px', overflow: 'visible'});
  root.appendChild(callSvg);
  const callG = el(root, '');
  const ring = el(root, 'ring', {display: 'none'});
  const cursor = el(root, 'cursor', {display: 'none'}, `<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.4 L10 13 L16 13 Z" fill="${C.ink}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`);

  // the current trace for the running sequence, sampled once from the model
  let traceSeq = '';
  let traceHtml = '';
  const LOGMAX = Math.log10(30000);
  const yOf = (I) => 52 - (Math.log10(Math.max(1, I)) / LOGMAX) * 48;
  const trace = (seq) => {
    if (seq === traceSeq) return traceHtml;
    traceSeq = seq;
    const S = SEQ[seq];
    const pts = [];
    for (let i = 0; i <= 270; i++) {
      const s = stateAt(seq, (i / 270) * S.dur);
      pts.push(`${(i + 1).toFixed(0)},${yOf(s.e.I[HERO]).toFixed(1)}`);
    }
    let g = '';
    for (const [I, n] of [[100, '100 A'], [1000, '1 kA'], [10000, '10 kA']]) g += `<line x1="0" x2="272" y1="${yOf(I)}" y2="${yOf(I)}" stroke="${C.line}"/><text x="270" y="${yOf(I) - 2}" text-anchor="end" font-family="JetBrains Mono" font-size="7" font-weight="700" fill="${C.mute}">${n}</text>`;
    traceHtml = g + `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
    return traceHtml;
  };
  let tickSeq = '';

  const fmtA = (I) => (I >= 1000 ? `${(I / 1000).toFixed(1)} kA` : `${I.toFixed(0)} A`);
  return {
    root,
    btn,
    spots,
    TL,
    update(u) {
      const {s, seq, tau, view, display, paused, callouts, cursor: cur, t} = u;
      const e = s.e;
      const [title, sub, key] = heroWords(s);
      dot.style.background = {ok: COL.grid, open: C.mute, move: C.or, fault: COL.fault, safe: COL.grid}[key];
      dot.style.boxShadow = key === 'fault' ? `0 0 0 4px rgba(255,42,26,.2)` : 'none';
      stTxt.innerHTML = `<b>${title}</b><span>${sub}</span>`;
      sld.innerHTML = SLD(s, e, t);
      big.innerHTML = `${fmtA(e.I[HERO]).replace(/ (k?A)$/, '<small>$1</small>')}`;
      big.style.color = e.I[HERO] > 2000 ? COL.fault : C.ink;
      const S = SEQ[seq];
      const kx = (tau / S.dur) * 270 + 1;
      chart.innerHTML = trace(seq) + `<line x1="${kx}" x2="${kx}" y1="2" y2="56" stroke="${C.or}" stroke-width="1.4"/><circle cx="${kx}" cy="${yOf(e.I[HERO])}" r="3" fill="${C.or}"/>`;
      rv['BUS A / BUS B'].textContent = `${e.vA.toFixed(1)} · ${e.vB.toFixed(1)} kV`;
      rv['INCOMER A / B'].textContent = `${fmtA(e.I[0])} · ${fmtA(e.I[4])}`;
      rv['CONTACT GAP'].textContent = `${e.gap.toFixed(1)} / ${(P.stroke * 1000).toFixed(0)} mm`;
      rv.TRUCK.textContent = s.rack < 0.005 ? 'SERVICE' : s.rack > 0.995 ? 'TEST · 200 mm OUT' : `RACKING · ${(s.rack * 200).toFixed(0)} mm`;
      rv['EARTHING SWITCH'].textContent = s.earth > 0.99 ? 'CLOSED' : s.earth > 0.01 ? 'CLOSING' : 'OPEN';
      rv['EARTHING SWITCH'].style.color = s.earth > 0.99 ? COL.grid : C.ink;
      rv.PROTECTION.textContent = s.trip || 'HEALTHY';
      rv.PROTECTION.style.color = s.trip.includes('50') ? COL.fault : s.trip ? COL.bat : C.ink;
      rv['UPS A / UPS B'].innerHTML = `<span style="color:${e.t1 ? C.ink : COL.bat}">${e.upsA}</span> · <span style="color:${e.t2 ? C.ink : COL.bat}">${e.upsB}</span>`;
      rv['IT LOAD'].textContent = `3.6 MW · ${(e.racks * 100).toFixed(0)} % UP`;
      for (const k of SEQS) btn[k].classList.toggle('on', k === seq);
      for (const v of VIEWS) btn[v].classList.toggle('on', v === view);
      for (const d of DISPLAY) btn[d].classList.toggle('on', !!display[d]);
      btn.play.innerHTML = paused ? '▶' : '❚❚';
      phase.innerHTML = `<i>■</i>${phaseAt(seq, tau)}`;
      const k = Math.min(1, tau / S.dur);
      tlFill.style.width = `${(k * 100).toFixed(2)}%`;
      knob.style.left = `${(TL.x + k * TL.w).toFixed(1)}px`;
      if (tickSeq !== seq) {
        tickSeq = seq;
        ticks.innerHTML = S.phases.map(([a]) => `<div class="tick" style="left:${(TL.x + (a / S.dur) * TL.w).toFixed(1)}px;top:816px"></div>`).join('');
      }
      const slow = s.slow > 1;
      clock.innerHTML = `${slow ? `<span class="slow">SLOW MOTION ×${s.slow} · </span>` : ''}REAL TIME <b>${s.ms < 1000 && seq === 'fault' ? `${s.ms.toFixed(1)} ms` : `${(s.ms / 1000).toFixed(1)} s`}</b> · ${tau.toFixed(1)} / ${S.dur.toFixed(0)} s`;
      // labels
      let lh = '';
      let ch = '';
      for (const c of callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 7).toFixed(1)}" fill="none" stroke="${C.or}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.6" fill="${C.or}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)};${right ? '' : `width:${c.w}px;text-align:right`}"><b style="${right ? '' : 'justify-content:flex-end'}"><i></i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      if (cur && cur.x > 0) {
        cursor.style.display = 'block';
        cursor.style.left = px(cur.x);
        cursor.style.top = px(cur.y);
        cursor.style.transform = cur.press ? 'scale(.86)' : 'none';
      } else cursor.style.display = 'none';
      if (cur && cur.ring > 0) {
        ring.style.display = 'block';
        ring.style.left = px(cur.ringX);
        ring.style.top = px(cur.ringY);
        ring.style.opacity = cur.ring.toFixed(2);
        ring.style.transform = `scale(${(1.4 - 0.6 * cur.ring).toFixed(2)})`;
      } else ring.style.display = 'none';
      void view;
    },
  };
}
