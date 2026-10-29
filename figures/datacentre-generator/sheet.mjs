import { SET, T, fuelHours } from "./genset.mjs";

const piece = (id) => `.it[data-piece="${id}"]`;
const LITRES = 5500;
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const apart = { view: "apart" };

export default {
  page: "generator-light.html",
  out: "generator",
  layers: ".gs-stage > svg",
  rasterSelector: ".gs-stage",
  strip: [],
  reduced: true,
  views: {
    rest: {},
    apart: { actions: [["key", "Escape"], ["key", " "], ["wait", 2500]], reset: [["key", " "], ["wait", 2500]] },
    load: { actions: [["key", "Escape"], ["key", "s"], ["wait", 10500]], reset: [["key", "Escape"], ["wait", 9000]] },
  },

  name: "Standby generator",
  title: "Standby generator: how a data centre keeps the lights on",
  number: "AN-002",
  tagline: `${fmt(SET.kva)} kVA diesel standby set`,
  question: "What happens when a data centre loses its mains power?",
  lead: `The UPS batteries carry the servers for the first seconds. Within ${T.transfer.toFixed(1)} s the diesel generator has cranked, fired, reached ${fmt(SET.rpm)} rpm and ${SET.hz} Hz, and the transfer switch has moved the load across to it.`,
  quote: "On load in under ten seconds",
  numbers: [
    [fmt(SET.kva), "kVA", `${fmt(SET.kw)} kW at 0.8 power factor`],
    [fmt(SET.rpm), "rpm", `${SET.cylinders}-cylinder V diesel, ${SET.hz} Hz`],
    [T.transfer.toFixed(1), "s", "mains failure to on load"],
    [fmt(LITRES), "L", `base tank, ${fuelHours(LITRES).toFixed(0)} h at ${fmt(SET.load)} kW`],
  ],
  spec: [
    ["Rating", `${fmt(SET.kva)} kVA / ${fmt(SET.kw)} kW`],
    ["Output", `${SET.volts} V, ${SET.hz} Hz, ${fmt(SET.amps)} A a phase`],
    ["Engine", `V${SET.cylinders} diesel, ${fmt(SET.rpm)} rpm`],
    ["Start", `${SET.battery} V electric, about ${SET.crankRpm} rpm`],
    ["Transfer", `${T.transfer.toFixed(1)} s (limit 10 s)`],
    ["Fuel", `${fmt(LITRES)} L, about ${fmt(SET.burn)} L/h at ${fmt(SET.load)} kW`],
    ["Standby", `coolant held at ${SET.coolant} °C`],
  ],
  why: {
    title: "Why keep it warm?",
    text: `A cold diesel starts slowly and can't take a big load at once. The jacket-water heater holds the engine at ${SET.coolant} °C around the clock, so it can fire within seconds and take ${fmt(SET.load)} kW in one step.`,
  },

  parts: [
    { id: "engine", name: "Diesel engine", say: `V${SET.cylinders}, twin turbos; turns the alternator at ${fmt(SET.rpm)} rpm.`, select: piece("engine") },
    { id: "alternator", name: "Alternator", say: `Makes ${SET.volts} V, ${SET.hz} Hz power; breaker and cables in its terminal box.`, select: piece("alternator") },
    { id: "radiator", name: "Radiator and fan", say: "Sheds the engine's heat to the air of the generator hall.", select: piece("radiator") },
    { id: "silencer", name: "Exhaust silencer", say: "Quietens the exhaust; the rain cap lifts when gas flows.", select: piece("silencer") },
    { id: "tank", name: "Base fuel tank and mounts", say: `${fmt(LITRES)} L of diesel under the skid; rubber mounts stop vibration.`, select: piece("tank"), at: [189, 307] },
    { id: "batteries", name: "Starter batteries", say: `Four 12 V blocks give ${SET.battery} V to crank the engine.`, select: piece("batteries") },
    { id: "heater", name: "Jacket-water heater", say: `Keeps the coolant at ${SET.coolant} °C so the set starts fast.`, select: piece("heater") },
    { id: "panel", name: "Control panel", say: "Senses the mains failure, starts, watches and protects the set.", select: piece("panel"), at: [134, 259] },
    { id: "stand", select: piece("stand") },
  ],

  main: { ...apart },
  inset: { label: "Assembled", view: "rest" },
  steps: [
    { view: "rest", title: "Mains fails", text: `The UPS carries the hall. The controller waits ${T.detect.toFixed(0)} s to be sure the mains is really gone.`, focus: ["panel"] },
    { view: "rest", title: "Batteries crank", text: `The ${SET.battery} V batteries drive the starter motor, turning the engine at about ${SET.crankRpm} rpm.`, focus: ["batteries", "engine"] },
    { view: "rest", title: "Engine fires", text: `Diesel ignites under compression and the engine runs up to ${fmt(SET.rpm)} rpm. With four poles that is ${SET.hz} Hz.`, focus: ["engine", "silencer"] },
    { view: "load", title: "On load", text: `At ${T.transfer.toFixed(1)} s the transfer switch moves ${fmt(SET.load)} kW onto the alternator. The speed dips, then the governor catches it.`, focus: ["alternator"] },
    { view: "load", title: "Cooling the engine", text: "The radiator and fan carry the engine's heat away for as long as it runs.", focus: ["radiator"] },
  ],
  details: [
    { ...apart, title: "Turbos and exhaust", text: "Twin turbochargers feed one pipe through a bellows to the roof silencer.", around: ["silencer"], focus: ["silencer"] },
    { ...apart, title: "Starter batteries", text: `Four 12 V blocks in a rack give ${SET.battery} V to the starter motor.`, around: ["batteries"], focus: ["batteries"] },
    { ...apart, title: "Alternator", text: `Bolted to the flywheel housing; its cables drop into a trench to the switchgear.`, around: ["alternator"], focus: ["alternator"] },
  ],
};
