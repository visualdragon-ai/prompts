# Where does the heat go?

A 90-second Whiteboard Explainer about how cooling towers are used in data centres. It's a remake of the
sketchnote film in `../cooling-towers-sketchnote/`, with English narration.

A magnet is one watt of heat. The pens draw its route across one glossy dry-erase board: server rack → cooling unit →
chilled-water loop → chiller → condenser loop → cooling tower. Inside the tower a little water evaporates, and the magnet
lifts off into the sky. The water bill comes next, then the eraser wipes the board, and only the watt's orange route survives.

- `cooling-towers-whiteboard.mp4`: the film (1920×1080, 24 fps, about −14 LUFS), subtitles burned in
- `subtitles_en.srt`: the same subtitles as a file
- `poster.jpg`, `TREATMENT.md` (structure, shot list, cue map, sound design), `CREDITS`
- Source: `film.js` (board, camera, magnet, subtitles), `engine/wb.js`, `lines.json` + `voices/` (narration),
  `music.py`, `mix.py`, `tools/` (voice checks, subtitle export), `build.sh` (one command, given the
  [Lemo-Opuscar](https://github.com/lemomo-ai/lemo-opuscar) library in `$LIB`)
