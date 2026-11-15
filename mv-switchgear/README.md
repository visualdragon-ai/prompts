# MV Switchgear Teardown

An interactive 3D simulator of a typical 12 kV air-insulated, metal-clad medium-voltage switchgear panel with a
withdrawable vacuum circuit breaker, shown inside a data-centre MV room (two grid incomers, bus tie, two transformer
feeders → LV switchboards → UPS → dual-corded IT racks).

Open `dist/mv-switchgear.html` in a browser. It is one offline file.

- **Take it apart:** section, x-ray, exploded view, labels, orbit.
- **Scenarios:** normal, grid A fails (auto transfer via the bus tie), cable fault (breaker trips, arc in vacuum,
  shown at 1/50 speed), isolate & earth (rack out, shutters, earthing switch, door interlock).
- **Views:** hero, front, side, breaker, cables, data hall.
- Left alone it plays an auto tour; any click hands control over, 25 s of quiet resumes the tour.

Dimensions, ratings and timings are representative of the class, not a specific product.

## Source

Built with the [teardown](https://github.com/elvarofficial/teardown) skill's kit (three.js, bundled by esbuild).

| File | Job |
|---|---|
| `mvs-shared/model.js` | Dimensions, ratings, the four sequences and the electrical solve. Every pose and readout comes from `stateAt(seq, tau)`. |
| `mvs-shared/panel.js` | The panel geometry and its `update(state)`. |
| `mvs-shared/hall.js` | The data-centre room, the rest of the lineup and the animated power-flow routes. |
| `mvs-shared/stage.js` | Renderer, lights, floor, camera; `frame(state, cam)`. |
| `mvs-shared/console.js` | The 1600×900 overlay: single-line diagram, readouts, controls, labels. |
| `mvs-shared/film.js` | The tour script, views, cursor and labels as pure functions of time. |
| `mvs-shared/live.js` | The interactive page. |
| `mvs-live/`, `mvs-film/` | Entry points for the live page and the recordable film. |

## Rebuild

With the teardown skill installed (`npx skills add elvarofficial/teardown`) and `npm install` run in its folder:

```
SKILL_DIR=~/.claude/skills/teardown
node "$SKILL_DIR/sims/build.mjs" ./mv-switchgear/mvs-live   # → teardown-out/dist/mvs-live.html
node "$SKILL_DIR/sims/build.mjs" ./mv-switchgear/mvs-film
node "$SKILL_DIR/sims/capture.mjs" mvs-film --size 1600x900 --dpr 1.2 --out teardown-out/mvs.mp4   # optional video
```
