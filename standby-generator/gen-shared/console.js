// The console, laid out at 1600 x 900: title and ratings, the set's state, a live single-line diagram of how the
// sets back up the data hall, the engine and alternator readouts with a frequency trace, the four sequences, views,
// take-apart toggles, the timeline and the labels with leaders into the machine. update(s) redraws it every frame.
import {COL} from './site.js';
import {phaseAt, R, SEQ, SEQS, SLOW, stateAt, words} from './model.js';

export const C = {ink: '#1f2328', mute: '#7d848c', faint: '#d3d7d5', line: '#dfe3e1', panel: 'rgba(255,255,255,.93)', or: '#e3562a'};
export const VIEWS = ['hero', 'side', 'end', 'engine', 'alternator', 'site'];
export const VIEW_LABEL = {hero: 'HERO ¾', side: 'SIDE', end: 'END', engine: 'ENGINE', alternator: 'ALTERNATOR', site: 'DATA CENTRE'};
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


// ------------------------------------------------------------ the single-line diagram, 300 x 384
const SLD = (s, e, t) => {
  const c = (on, col) => (on ? col : COL.dead);
  const ln = (x1, y1, x2, y2, on, col) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c(on, col)}" stroke-width="${on ? 3 : 2}" ${on ? '' : 'stroke-dasharray="4 3"'} stroke-linecap="round"/>`;
  const brk = (x, y, travel) => {
    const closed = travel > 0.5;
    const mid = travel > 0.02 && travel < 0.98;
    return `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" rx="2" fill="${closed ? C.ink : '#fff'}" stroke="${C.ink}" stroke-width="2"${mid ? ' stroke-dasharray="3 2"' : ''}/>`;
  };
  const txt = (x, y, str, anchor = 'middle', col = C.mute, size = 8.5) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="JetBrains Mono" font-weight="700" font-size="${size}" letter-spacing=".6" fill="${col}">${str}</text>`;
  let o = '';
  // the three sets, the generator bus
  [40, 90, 140].forEach((x, i) => {
    const run = s.n > 1;
    o += `<circle cx="${x}" cy="24" r="13" fill="#fff" stroke="${c(e.gen || run, COL.gen)}" stroke-width="2"/>` + txt(x, 28, 'G', 'middle', e.gen ? COL.gen : C.mute, 10);
    if (i === 0) o += `<circle cx="${x}" cy="24" r="18" fill="none" stroke="${C.or}" stroke-width="1.6"/>`;
    o += ln(x, 37, x, 52, e.gen, COL.gen) + ln(x, 68, x, 86, e.genBus, COL.gen) + brk(x, 60, s.Gb);
  });
  o += ln(24, 86, 168, 86, e.genBus, COL.gen) + txt(24, 98, 'GENERATOR BUS', 'start');
  // load bank branch
  o += ln(60, 86, 60, 112, e.genBus, COL.gen) + brk(60, 120, s.LB) + ln(60, 128, 60, 146, e.lb, COL.gen);
  o += `<rect x="44" y="146" width="32" height="18" rx="2" fill="#fff" stroke="${c(e.lb, COL.gen)}" stroke-width="2"/><path d="M48 155 l4 -5 l4 10 l4 -10 l4 10 l4 -5" fill="none" stroke="${c(e.lb, COL.gen)}" stroke-width="1.4"/>` + txt(60, 178, 'LOAD BANK');
  // generator main to the switchboard
  o += ln(160, 86, 160, 112, e.genBus, COL.gen) + brk(160, 120, s.Mb) + ln(160, 128, 160, 196, e.genBus && s.Mb > 0.5, COL.gen);
  // grid, transformer, utility main
  o += `<circle cx="252" cy="24" r="12" fill="#fff" stroke="${c(s.util, COL.util)}" stroke-width="2"/><path d="M246 24 q3 -5 6 0 t6 0" fill="none" stroke="${c(s.util, COL.util)}" stroke-width="1.6"/>` + txt(270, 28, 'GRID', 'start');
  o += ln(252, 36, 252, 52, s.util, COL.util);
  o += `<circle cx="252" cy="60" r="8" fill="none" stroke="${c(s.util, COL.util)}" stroke-width="2"/><circle cx="252" cy="71" r="8" fill="none" stroke="${c(s.util, COL.util)}" stroke-width="2"/>`;
  o += ln(252, 79, 252, 112, s.util, COL.util) + brk(252, 120, s.Ub) + ln(252, 128, 252, 196, e.utilOn, COL.util);
  o += txt(270, 124, 'ATS', 'start', C.ink);
  // main switchboard bus
  const busCol = e.utilOn ? COL.util : COL.gen;
  o += ln(150, 196, 270, 196, e.msb, busCol) + txt(270, 210, 'MAIN SWITCHBOARD', 'end');
  // UPS and racks
  const upsCol = e.msb ? COL.it : COL.bat;
  o += ln(210, 196, 210, 226, e.msb, busCol);
  o += `<rect x="178" y="226" width="64" height="26" rx="3" fill="#fff" stroke="${upsCol}" stroke-width="2"/>` + txt(210, 243, e.msb ? 'UPS' : 'BATTERY', 'middle', e.msb ? C.ink : COL.bat);
  o += `<line x1="210" y1="252" x2="210" y2="272" stroke="${upsCol}" stroke-width="2.5"/><line x1="110" y1="272" x2="290" y2="272" stroke="${upsCol}" stroke-width="2.5"/>`;
  for (let i = 0; i < 5; i++) {
    const x = 122 + i * 40;
    o += `<line x1="${x}" y1="272" x2="${x}" y2="286" stroke="${upsCol}" stroke-width="1.6"/><rect x="${x - 12}" y="286" width="24" height="32" rx="2" fill="${C.ink}"/>`;
    for (let j = 0; j < 3; j++) o += `<rect x="${x - 7}" y="${292 + j * 9}" width="14" height="2" fill="${COL.it}" opacity="${0.6 + 0.4 * Math.sin(t * 7 + i * 1.7 + j)}"/>`;
  }
  o += txt(200, 334, 'IT RACKS · 100 % POWERED', 'middle', C.ink, 9);
  o += txt(24, 230, 'N+1: ANY TWO', 'start', C.mute, 7.5) + txt(24, 241, 'SETS CARRY', 'start', C.mute, 7.5) + txt(24, 252, 'THE 3.2 MW HALL', 'start', C.mute, 7.5);
  return o;
};

const mmss = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
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
  el(root, 'ttl', {}, `<b><em class="badge">GEN</em>Standby generator set</b><span>60-LITRE V16 DIESEL · 4-POLE BRUSHLESS ALTERNATOR · ACOUSTIC ENCLOSURE · ISO 8528</span>`);
  el(root, 'chips', {}, [['', `${R.kVA} kVA`], ['', `${R.kWe} kWe`], ['', `${R.V} V · ${R.f} Hz`], ['', `${R.rpm} rpm`], ['', `V16 · ${R.disp.toFixed(1)} L`]].map(([k, v]) => `<div class="chip">${k ? `<i>${k}</i>` : ''}${v}</div>`).join(''));

  const stateC = el(root, 'card state', {left: '24px', top: '100px', width: '300px', height: '62px'});
  const dot = el(stateC, 'dot');
  const stTxt = el(stateC, '');
  const sldC = el(root, 'card', {left: '24px', top: '172px', width: '300px', height: '466px'});
  el(sldC, 'k', {position: 'absolute', left: '14px', top: '12px'}, 'How it backs up the data hall');
  const sld = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sld.setAttribute('viewBox', '0 0 300 350');
  Object.assign(sld.style, {position: 'absolute', left: '0', top: '36px', width: '300px', height: '350px'});
  sldC.appendChild(sld);
  el(sldC, 'legend', {position: 'absolute', left: '14px', bottom: '12px', width: '272px'},
    `<span><i style="background:${COL.util}"></i>GRID</span><span><i style="background:${COL.gen}"></i>GENERATOR</span><span><i style="background:${COL.it}"></i>UPS OUTPUT</span><span><i style="background:${COL.bat}"></i>ON BATTERY</span><span><i style="background:${COL.dead}"></i>DEAD</span><span><i style="background:${C.or}"></i>THIS SET</span>`);

  const rd = el(root, 'card', {left: '1276px', top: '100px', width: '300px', height: '376px', padding: '12px 14px', boxSizing: 'border-box'});
  el(rd, 'k', {}, 'Engine speed');
  const big = el(rd, 'big', {marginTop: '8px'});
  const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chart.setAttribute('viewBox', '0 0 272 58');
  Object.assign(chart.style, {display: 'block', width: '272px', height: '58px', margin: '6px 0 4px'});
  rd.appendChild(chart);
  const rows = el(rd, '', {});
  const ROWS = ['FREQUENCY · VOLTAGE', 'LOAD', 'STARTERS · BATTERY', 'OIL PRESSURE', 'COOLANT · EXHAUST', 'TURBO', 'FUEL BURN', 'UPS'];
  const rv = {};
  for (const r of ROWS) {
    const d = el(rows, 'row', {}, `<span class="k">${r}</span>`);
    rv[r] = el(d, 'v');
  }
  el(root, 'k', {position: 'absolute', left: '1278px', top: '484px'}, 'Views');
  VIEWS.forEach((v, i) => mkBtn(v, VIEW_LABEL[v], 1276 + (i % 3) * 101, 500 + Math.floor(i / 3) * 36, 96, 30));
  el(root, 'k', {position: 'absolute', left: '1278px', top: '584px'}, 'Take it apart');
  DISPLAY.forEach((v, i) => mkBtn(v, DISPLAY_LABEL[v], 1276 + (i % 3) * 101, 600 + Math.floor(i / 3) * 36, 96, 30));
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
  el(root, 'k', {position: 'absolute', left: '26px', top: '846px', fontSize: '8.5px'}, `Typical data-centre standby set. Values are representative, not a specific product. Pistons shown ${SLOW}× slower than real.`);
  const callSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.assign(callSvg.style, {position: 'absolute', left: 0, top: 0, width: '1600px', height: '900px', overflow: 'visible'});
  root.appendChild(callSvg);
  const callG = el(root, '');
  const ring = el(root, 'ring', {display: 'none'});
  const cursor = el(root, 'cursor', {display: 'none'}, `<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.4 L10 13 L16 13 Z" fill="${C.ink}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`);

  // the frequency trace of the running sequence, sampled once from the model
  let traceSeq = '';
  let traceHtml = '';
  const F0 = 44;
  const F1 = 52;
  const yOf = (f) => 54 - ((Math.min(F1, Math.max(F0, f)) - F0) / (F1 - F0)) * 50;
  const trace = (seq) => {
    if (seq === traceSeq) return traceHtml;
    traceSeq = seq;
    const S = SEQ[seq];
    const pts = [];
    for (let i = 0; i <= 270; i++) {
      const s = stateAt(seq, (i / 270) * S.dur);
      pts.push(`${i + 1},${(s.n < 60 ? 56 : yOf(s.f)).toFixed(1)}`);
    }
    let g = `<rect x="0" y="${yOf(50.25)}" width="272" height="${yOf(49.75) - yOf(50.25)}" fill="${C.line}"/>`;
    for (const [f, n] of [[50, '50 HZ'], [45, '45']]) g += `<line x1="0" x2="272" y1="${yOf(f)}" y2="${yOf(f)}" stroke="${C.faint}"/><text x="270" y="${yOf(f) - 2}" text-anchor="end" font-family="JetBrains Mono" font-size="7" font-weight="700" fill="${C.mute}">${n}</text>`;
    traceHtml = g + `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
    return traceHtml;
  };
  let tickSeq = '';
  return {
    root,
    btn,
    spots,
    TL,
    update(u) {
      const {s, seq, tau, view, display, paused, callouts, cursor: cur, t} = u;
      const e = s.e;
      const [title, sub, key] = words(s);
      dot.style.background = {ok: COL.it, idle: '#4aa3ff', move: C.or}[key];
      stTxt.innerHTML = `<b>${title}</b><span>${sub}</span>`;
      sld.innerHTML = SLD(s, e, t);
      big.innerHTML = `${s.n.toFixed(0)}<small>RPM</small>`;
      const S = SEQ[seq];
      const kx = (tau / S.dur) * 270 + 1;
      chart.innerHTML = trace(seq) + `<line x1="${kx}" x2="${kx}" y1="2" y2="56" stroke="${C.or}" stroke-width="1.4"/>` + (s.n > 60 ? `<circle cx="${kx}" cy="${yOf(s.f)}" r="3" fill="${C.or}"/>` : '');
      rv['FREQUENCY · VOLTAGE'].textContent = `${s.f.toFixed(2)} Hz · ${Math.max(0, s.V).toFixed(0)} V`;
      rv.LOAD.textContent = `${s.P.toFixed(0)} kW · ${((s.P / R.kWe) * 100).toFixed(0)} %`;
      rv['STARTERS · BATTERY'].textContent = `${s.starter > 0.05 ? 'ENGAGED' : 'OUT'} · ${s.batt.toFixed(1)} V`;
      rv['STARTERS · BATTERY'].style.color = s.starter > 0.05 ? C.or : C.ink;
      rv['OIL PRESSURE'].textContent = `${s.oil.toFixed(1)} bar`;
      rv['COOLANT · EXHAUST'].textContent = `${s.cool.toFixed(0)} °C · ${s.exh.toFixed(0)} °C`;
      rv.TURBO.textContent = `${(s.turbo * 1000).toFixed(0)} rpm`;
      rv['FUEL BURN'].textContent = `${s.fuelRate.toFixed(0)} L/h`;
      rv.UPS.textContent = `ON ${e.ups}`;
      rv.UPS.style.color = e.ups === 'BATTERY' ? COL.bat : e.ups === 'GENERATOR' ? COL.gen : C.ink;
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
      clock.innerHTML = `${s.fast > 1 ? `<span class="slow">SHOWN ${s.fast}× FAST · </span>` : ''}${s.n > 1 ? `PISTONS ${SLOW}× SLOW · ` : ''}REAL TIME <b>${mmss(s.clk)}</b> · ${tau.toFixed(1)} / ${S.dur.toFixed(0)} s`;
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
