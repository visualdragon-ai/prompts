const D = __DATA__;
const root = document.querySelector(".gs");
const stage = root.querySelector(".gs-stage");
const set = stage.querySelector(".gs-set");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const runButton = root.querySelector("[data-run]");
const runLabel = root.querySelector("[data-run-label]");
const partButtons = [...root.querySelectorAll(".gs-part")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const dispA = stage.querySelector('[data-part="disp-a"]');
const dispB = stage.querySelector('[data-part="disp-b"]');
const led = stage.querySelector('[data-part="led"]');
const flapEl = stage.querySelector('[data-part="flap"]');

const nodes = [...set.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);
const hotRoutes = Object.fromEntries(D.hot.map(({ id }) => [id, [...set.querySelectorAll(`[data-route="${id}"]`)].map((el) => el)]));

const IDS = Object.keys(D.pieces);
const STAGGER = D.stagger;
const SPRING = D.spring;
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const fmt = (value) => Math.round(value).toLocaleString("en-US");

let clock = 0;
let apart = false;
let selected = null;
let inside = false;
let leaveTimer = 0;
let touring = !still.matches;
let tourClock = -1;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;

// The run: seconds since the mains failed, and when it came back.
const run = { on: false, t: 0, stop: Infinity, state: stateAt(-1), flap: 0, shownFlap: -1, tour: false, phase: "" };

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function announce(text) {
  if (live.textContent !== text) live.textContent = text;
}

function describe() {
  const text = selected ? D.pieces[selected].say : run.on ? `running · ${run.state.phase}` : apart ? `apart · ${D.order.length} assemblies` : "Assembled, on standby";
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
}

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? STAGGER : [...STAGGER].reverse()) {
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (still.matches ? 0 : index++ * SPRING.stagger) };
  }
  describe();
  kick();
}

function select(id) {
  if (id === "stand") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
}

function steerSpring(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  for (let index = 0; index < SPRING.substeps; index++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}

function place() {
  for (const node of nodes) {
    const share = piece[node.piece].x;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = share === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].key + nodes[a].lift * piece[nodes[a].piece].x - (nodes[b].key + nodes[b].lift * piece[nodes[b].piece].x));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    set.appendChild(fragment);
    order = next;
  }
}

// ---------------------------------------------------------------- the run after a mains failure
function cutMains(fromTour = false) {
  if (run.on) return;
  select(null);
  setApart(false);
  run.on = true;
  run.tour = fromTour;
  run.t = 0;
  run.stop = Infinity;
  run.phase = "";
  stage.setAttribute("data-run", "");
  runLabel.textContent = "Restore mains";
  describe();
  kick();
}

function restoreMains() {
  if (!run.on || run.stop !== Infinity) return;
  run.stop = Math.max(run.t, T.transfer + 0.6);
  runLabel.textContent = "Cooling down";
}

function toggleRun() {
  if (!run.on) cutMains(false);
  else restoreMains();
}

const flapFrame = (deg) => {
  const a = (deg * Math.PI) / 180;
  const axis = [-Math.sin(a), 0, Math.cos(a)];
  const along = [Math.cos(a), 0, Math.sin(a)];
  return G.frameAlong(G.add3(D.flap.hinge, G.mul3(along, D.flap.r)), axis);
};

function drawFlap(deg) {
  if (Math.abs(deg - run.shownFlap) < 0.15) return;
  run.shownFlap = deg;
  flapEl.innerHTML = solidSvg(G.disc(0, D.flap.t, D.flap.r, flapFrame(deg), D.P, { steps: 40 }), { tone: "hi" });
}

function setHot(id, on) {
  for (const el of hotRoutes[id] ?? []) {
    if (on) el.setAttribute("data-hot", "");
    else el.removeAttribute("data-hot");
  }
}

function runText(s) {
  const t = `${s.t.toFixed(1)} s`;
  if (s.phase === "mains lost") return `mains lost · UPS carrying the hall · ${t}`;
  if (s.phase === "cranking") return `cranking · ${fmt(s.rpm)} rpm · ${t}`;
  if (s.phase === "running up") return `firing · ${fmt(s.rpm)} rpm · ${t}`;
  if (s.phase === "voltage building") return `${fmt(s.rpm)} rpm · ${fmt(s.volts)} V · ${t}`;
  if (s.phase === "ready") return `${s.hz.toFixed(1)} Hz · ${fmt(s.volts)} V · ready · ${t}`;
  if (s.phase === "on load") return `on load · ${fmt(s.kw)} kW · ${s.hz.toFixed(1)} Hz · since ${T.transfer.toFixed(1)} s`;
  if (s.phase === "cooling down") return `mains back · cooling down off load`;
  if (s.phase === "stopping") return `stopping · ${fmt(s.rpm)} rpm`;
  return idleText();
}

const PHASE_WORDS = { "mains lost": "Mains lost", cranking: "Cranking", "running up": "Engine firing", "voltage building": "Voltage building", ready: "Ready to take load", "on load": "On load", "cooling down": "Mains back, cooling down", stopping: "Stopping" };

function stepRun(dt, calm) {
  if (!run.on) return false;
  run.t += dt;
  if (run.tour && run.stop === Infinity && run.t > T.transfer + 4.5) restoreMains();
  const s = stateAt(run.t, run.stop);
  run.state = s;
  if (s.done) {
    run.on = false;
    stage.removeAttribute("data-run");
    runLabel.textContent = "Cut the mains";
    runButton.removeAttribute("data-state");
    setHot("bat.positive", false);
    for (const { id } of D.hot) setHot(id, false);
    dispA.textContent = "0 rpm";
    dispB.textContent = "AUTO";
    led.removeAttribute("data-on");
    run.flap = 0;
    drawFlap(0);
    announce("Back on standby");
    describe();
    return false;
  }
  if (s.phase !== run.phase) {
    run.phase = s.phase;
    announce(PHASE_WORDS[s.phase] ?? s.phase);
    describe();
  }
  runButton.setAttribute("data-state", s.cranking ? "crank" : s.rpm > 1 ? "on" : "wait");
  for (const { id, piece: owner } of D.hot) setHot(id, owner === "batteries" ? s.cranking : s.onLoad);
  dispA.textContent = `${Math.round(s.rpm)} rpm`;
  dispB.textContent = s.onLoad ? `${Math.round(s.kw)} kW ${s.hz.toFixed(1)}Hz` : `${s.hz.toFixed(1)} Hz ${Math.round(s.volts)} V`;
  if (s.volts > 380) led.setAttribute("data-on", "");
  else led.removeAttribute("data-on");
  const want = flapOf(s.gas);
  run.flap = calm ? want : run.flap + (want - run.flap) * (1 - Math.exp(-dt / 0.18));
  drawFlap(run.flap);
  say(runText(s));
  return true;
}

// ---------------------------------------------------------------- tour, loop and input
const TOUR_STEP = 1.6;
function tourAt(time) {
  const apartFrom = 0.4;
  const listFrom = apartFrom + 1;
  const listTo = listFrom + D.order.length * TOUR_STEP;
  const runAt = listTo + 1.4;
  if (time < apartFrom) return { apart: false, part: null, run: false };
  if (time < listFrom) return { apart: true, part: null, run: false };
  if (time < listTo) return { apart: true, part: D.order[Math.floor((time - listFrom) / TOUR_STEP)], run: false };
  if (time < runAt) return { apart: false, part: null, run: false };
  return { apart: false, part: null, run: true };
}

function quietTour() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || run.on) return quietTour();
    touring = !still.matches;
    tourClock = -0.6;
    kick();
  }, 3600);
}

function idleText() {
  if (selected) return D.pieces[selected].say;
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 0.002 || piece[id].pending);
  if (moving) return apart ? "taking apart" : "closing up";
  return apart ? `apart · ${D.order.length} assemblies` : `standby · coolant ${SET.coolant} °C · ${fmt(D.litres / 100) + "00"} L`;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring && !run.on) {
    tourClock += dt;
    const step = tourAt(tourClock);
    setApart(step.apart);
    select(step.part);
    if (step.run) {
      cutMains(true);
      tourClock = -2.5;
    }
  }
  let moving = false;
  for (const id of IDS) if (steerSpring(piece[id], dt, calm)) moving = true;
  const running = stepRun(dt, calm);
  place();
  if (!run.on) say(idleText());
  frame = visible && (moving || running || touring) ? requestAnimationFrame(tick) : 0;
}

function kick() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) kick();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  quietTour();
  if (run.on) return;
  setApart(true);
  select(pieceAt(event));
  kick();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    setApart(false);
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || run.on) return;
  quietTour();
  const id = pieceAt(event);
  if (!id || id === "stand") {
    select(null);
    setApart(!apart);
  } else {
    setApart(true);
    select(id);
  }
  kick();
});

runButton.addEventListener("click", () => {
  quietTour();
  run.tour = false;
  toggleRun();
  kick();
});

partButtons.forEach((button) => {
  const show = () => {
    if (run.on) return;
    quietTour();
    clearTimeout(leaveTimer);
    setApart(true);
    select(button.dataset.part);
    kick();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      setApart(false);
    }, 260);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});

stage.addEventListener("keydown", (event) => {
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    if (run.on) restoreMains();
    select(null);
    setApart(false);
    kick();
    return;
  } else if (event.key === "s" || event.key === "S" || event.key === "Enter") {
    event.preventDefault();
    quietTour();
    run.tour = false;
    toggleRun();
    kick();
    return;
  } else if (event.key === " ") {
    event.preventDefault();
    quietTour();
    if (!run.on) setApart(!apart);
    if (!apart) select(null);
    kick();
    return;
  }
  if (next === null || run.on) return;
  event.preventDefault();
  quietTour();
  setApart(true);
  select(D.order[next]);
  kick();
});

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".gs-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap to take apart" : "Hover the set to take it apart");
wording();
narrow.addEventListener("change", wording);
place();
say(idleText());
