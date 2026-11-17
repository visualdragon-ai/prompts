#!/bin/sh
# "Where does the heat go?" — Whiteboard Explainer. Rebuild the film from this folder:
#   sh build.sh [--vo]      (--vo re-synthesises the narration and re-checks it; needs the ASR models, see README)
set -e
LIB=${LIB:-/root/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
if [ "$1" = "--vo" ]; then
  "$PY" "$LIB/core/tts/tts.py" "$HERE/lines.json" "$HERE/voices"                      # Kokoro bf_emma, en-gb
  "$HERE/.venv-asr/bin/python" "$HERE/tools/asr_check.py" "$HERE/lines.json" "$HERE/voices" "${ZIPFORMER:?path to sherpa-onnx-zipformer-en-2023-06-26}"
  "$HERE/.venv-asr/bin/python" "$HERE/tools/whisper_check.py" "$HERE/lines.json" "$HERE/voices" "${WHISPER:?path to sherpa-onnx-whisper-base.en}"
fi
cd "$LIB"
node core/render/events.mjs "$HERE"                       # every stroke, wipe, magnet, cue → events.json
"$PY" "$HERE/music.py"                                     # score → music/score.wav
"$PY" "$HERE/mix.py"                                       # foley + VO + score, −14 LUFS → out/mix.wav
node core/render/video.mjs "$HERE" --fps 24 --workers 4 --out "$HERE/out/video.mp4"
# mux (loudness is already set in mix.py; ffmpeg only encodes the audio and adds a little grain)
ffmpeg -y -loglevel error -i "$HERE/out/video.mp4" -i "$HERE/out/mix.wav" -map 0:v -map 1:a \
  -vf "noise=alls=3:allf=t" -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -shortest -movflags +faststart "$HERE/cooling-towers-whiteboard.mp4"
node "$HERE/tools/subs.mjs" && "$PY" core/render/srt.py "$HERE/out/subs.json" "$HERE/subtitles_en.srt"
node core/render/still.mjs "$HERE" 52.5 --q nosubs=1 --prefix poster_ --out "$HERE/out" && cp "$HERE/out/poster_52.5.jpg" "$HERE/poster.jpg"
echo "built $HERE/cooling-towers-whiteboard.mp4"
