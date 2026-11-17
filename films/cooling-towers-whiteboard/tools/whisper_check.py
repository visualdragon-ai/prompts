"""Second-opinion text check with Whisper (sherpa-onnx export from GitHub releases).
   .venv-asr/bin/python tools/whisper_check.py lines.json voices <whisper-model-dir> [ids...]"""
import sys, json, os, re, glob, numpy as np, soundfile as sf, sherpa_onnx
lines, vdir, mdir = sys.argv[1:4]; only = set(sys.argv[4:])
g = lambda p: sorted(glob.glob(os.path.join(mdir, p)))[0]
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=g('*encoder.int8.onnx'), decoder=g('*decoder.int8.onnx'), tokens=g('*tokens.txt'), language='en', task='transcribe', num_threads=4)
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower().replace("'", '').replace('-', ' ').replace('%', ' percent')).split()
bad = 0
for L in json.load(open(lines)):
    if only and L['id'] not in only: continue
    y, sr = sf.read(os.path.join(vdir, L['id'] + '.wav'), dtype='float32')
    pad = np.zeros(int(.5 * sr), np.float32); s = rec.create_stream(); s.accept_waveform(sr, np.concatenate([pad, y, pad])); rec.decode_stream(s)
    got = s.result.text.strip(); want = L.get('asr', L['text']); ok = norm(got) == norm(want); bad += not ok
    print(('OK  ' if ok else 'DIFF'), L['id'], '|', want, '→', got)
print('mismatches:', bad); sys.exit(1 if bad else 0)
