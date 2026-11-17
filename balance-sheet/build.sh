#!/bin/sh
# One command: "How to Read a Balance Sheet" (Sketchnote)
#   sh build.sh      voice (if missing) + timeline + subtitles, events, picture, foley + score + mix, master, reading check, poster
# Needs ffmpeg 7+ and ffprobe on PATH, and the Lemo-Opuscar library (core + voice tiers) at $LIB.
set -e
LIB=${LIB:-/root/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
NAME=balance-sheet
WORKERS=${WORKERS:-3}
cd "$LIB"
"$PY" core/audio/sampler.py --need "$HERE/mix.py"
[ -f "$HERE/voice/out/v13_0.wav" ] || "$PY" core/tts/tts.py "$HERE/voice/lines.json" "$HERE/voice/out"
"$PY" "$HERE/timeline.py"
node core/render/events.mjs "$HERE"
node core/render/video.mjs "$HERE" --fps 24 --workers "$WORKERS" --out "$HERE/out/video.mp4"
"$PY" "$HERE/mix.py"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/$NAME.mp4" 24 1
if node core/render/readcheck.mjs "$HERE" > "$HERE/out/readcheck.txt"; then echo "readcheck ok"; else echo "readcheck: see out/readcheck.txt"; fi
# poster: the finished page (whole-page frame, no subtitle slip)
node core/render/still.mjs "$HERE" 51.9 --q 'nosub=1' --out "$HERE/out/poster" > /dev/null
ffmpeg -v error -y -i "$HERE/out/poster/t_51.9.jpg" -q:v 2 "$HERE/poster.jpg"
echo "done: $HERE/$NAME.mp4"
