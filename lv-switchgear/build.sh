#!/bin/sh
# One command: rebuild "The Power Room" (voice → events → mix → subtitles → picture → master → poster).
#   sh build.sh                 full build
#   STOP_BEFORE_VIDEO=1 sh build.sh   sound and subtitles only
# Needs the Lemo-Opuscar library with the core + voice tiers (setup.sh deps voice), the HDRI pack (tools/fetch.sh hdri),
# ffmpeg 7+ on PATH. No GPU: set LEMO_ANGLE=swiftshader (slow; tools/frames.mjs resumes where it stopped).
set -e
LIB=${LIB:-/root/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
PY="$LIB/.venv/bin/python"; NAME=lv-switchgear; FPS=24
cd "$LIB"
"$PY" core/audio/sampler.py --need "$HERE/mix.py"                       # sample libraries before the long render
# 1. voice (Kokoro, offline) + speech check (needs the Whisper model from huggingface.co)
"$PY" core/tts/tts.py "$HERE/tts/lines.json" "$HERE/voices"
"$PY" core/tts/asr_check.py "$HERE/tts/lines.json" "$HERE/voices" --lang en || echo "! speech check failed or unavailable: listen to the lines"
# 2. sound events from the page, then score + foley + voice → out/mix.wav
node core/render/events.mjs "$HERE"
"$PY" "$HERE/mix.py"
# 3. subtitles (same intervals as the burned-in captions)
"$PY" - "$HERE" <<'PYEOF'
import json, re, sys, os
H = sys.argv[1]; d = json.load(open(os.path.join(H, 'voices/dur.json'))); s = open(os.path.join(H, 'story.js')).read()
vo = [(k, float(t), x) for k, t, x in re.findall(r"\['(v\d+)', ([\d.]+), '([^']*)'\]", s)]
json.dump([dict(t0=t - .25, t1=min(t + d[k] + .6, vo[i + 1][1] - .25 if i + 1 < len(vo) else 1e9), text=x) for i, (k, t, x) in enumerate(vo)], open(os.path.join(H, 'out/cues.json'), 'w'))
PYEOF
"$PY" core/render/srt.py "$HERE/out/cues.json" "$HERE/$NAME.srt"
[ -n "$STOP_BEFORE_VIDEO" ] && { echo "stopped before the picture"; exit 0; }
# 4. picture: resumable frames → video
node "$HERE/tools/frames.mjs" "$HERE" --fps $FPS --workers ${WORKERS:-1}
ffmpeg -v error -y -framerate $FPS -i "$HERE/frames/f_%05d.jpg" -c:v libx264 -preset medium -crf 14 -pix_fmt yuv420p "$HERE/out/video.mp4"
# 5. master: mux, loudness −14 LUFS, light grain
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/$NAME.mp4" $FPS 1
node "$HERE/tools/poster.mjs" "$HERE" 29.5   # clean still, no subtitles
echo "done: $HERE/$NAME.mp4"
