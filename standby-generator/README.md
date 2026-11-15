# Standby Generator Teardown

An interactive 3D simulator of a typical data-centre standby generator set: a 60-litre V16 diesel at 1500 rpm driving a
4-pole brushless alternator, 2,500 kVA / 2,000 kWe at 415 V, 50 Hz, in an acoustic enclosure on a belly fuel tank.
It sits in an N+1 generator yard (three sets) that backs up a 3.2 MW data hall through a paralleling switchboard,
an automatic transfer switch and the UPS.

Open `dist/standby-generator.html` in a browser. It is one offline file.

- **Take it apart:** section, x-ray, exploded view, labels, orbit. The 16 pistons run on real slider-crank geometry
  and each cylinder lights as it fires.
- **Scenarios:** standby, grid fails (crank, fire, run up, synchronise, take load), grid returns (closed-transition
  hand-back, cool-down, stop), monthly load-bank test.
- **Views:** hero, side, end, engine, alternator, data centre.
- Left alone it plays an auto tour; any click hands control over, 25 s of quiet resumes the tour.

Pistons are drawn 20× slower than real so they can be followed; readouts show real values. The 5-minute waits in
the hand-back are compressed and labelled. Values are representative of the class, not a specific product.

## Source

Built with the [teardown](https://github.com/elvarofficial/teardown) skill's kit (three.js, bundled by esbuild).

| File | Job |
|---|---|
| `gen-shared/model.js` | Ratings, engine geometry, the four sequences, the electrical picture and the tabulated crank angle. |
| `gen-shared/genset.js` | The generator set geometry and its `update(state)`. |
| `gen-shared/site.js` | The generator yard, fuel, switchboards, building, UPS, racks and power-flow routes. |
| `gen-shared/stage.js` | Renderer, lights, floor, camera; `frame(state, cam)`. |
| `gen-shared/console.js` | The 1600×900 overlay: single-line diagram, readouts, frequency trace, controls, labels. |
| `gen-shared/film.js` | The tour script, views, cursor and labels as pure functions of time. |
| `gen-shared/live.js` | The interactive page. |
| `gen-live/`, `gen-film/` | Entry points for the live page and the recordable film. |

## Rebuild

With the teardown skill installed (`npx skills add elvarofficial/teardown`) and `npm install` run in its folder:

```
SKILL_DIR=~/.claude/skills/teardown
node "$SKILL_DIR/sims/build.mjs" ./standby-generator/gen-live   # → teardown-out/dist/gen-live.html
node "$SKILL_DIR/sims/build.mjs" ./standby-generator/gen-film
node "$SKILL_DIR/sims/capture.mjs" gen-film --size 1600x900 --dpr 1.2 --out teardown-out/gen.mp4   # optional video
```
