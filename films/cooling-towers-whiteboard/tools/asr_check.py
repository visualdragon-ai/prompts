"""Offline speech check + word timings with sherpa-onnx (Hugging Face is unreachable here, so faster-whisper can't load).
   .venv-asr/bin/python tools/asr_check.py lines.json voices <model-dir>
Transcribes every voices/<id>.wav with a zipformer transducer, compares it word for word with the spoken text
(numbers spelled out, as the TTS reads them) and writes voices/words.json: {id: [[word, start, end], ...]}."""
import sys, json, re, os, numpy as np, soundfile as sf, sherpa_onnx
lines, vdir, mdir = sys.argv[1], sys.argv[2], sys.argv[3]
f = lambda n: os.path.join(mdir, n)
rec = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=f('encoder-epoch-99-avg-1.onnx'), decoder=f('decoder-epoch-99-avg-1.onnx'),
    joiner=f('joiner-epoch-99-avg-1.onnx'), tokens=f('tokens.txt'), num_threads=4, decoding_method='modified_beam_search')
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower().replace("'", '').replace('-', ' ')).split()
bad, words = 0, {}
for L in json.load(open(lines)):
    y, sr = sf.read(os.path.join(vdir, L['id'] + '.wav'), dtype='float32')
    if y.ndim > 1: y = y.mean(1)
    pad = np.zeros(int(.5 * sr), np.float32)
    s = rec.create_stream(); s.accept_waveform(sr, np.concatenate([pad, y, pad])); rec.decode_stream(s)
    r = s.result; toks, ts = r.tokens, r.timestamps
    ws = []
    for tok, t in zip(toks, ts):
        t = round(t - .5, 3)
        if tok[:1] in ('▁', ' ') or not ws: ws.append([tok.lstrip('▁ '), t, t])
        else: ws[-1][0] += tok
    dur = len(y) / sr
    for i, w in enumerate(ws): w[2] = round(min(dur, ws[i + 1][1] - .02) if i + 1 < len(ws) else dur, 3); w[1] = max(0, w[1])
    words[L['id']] = ws
    got = ' '.join(w[0] for w in ws); want = L.get('say', L['text'])
    ok = norm(got) == norm(want); bad += not ok
    print(('OK  ' if ok else 'DIFF'), L['id'], '|', want, '→', got.lower())
json.dump(words, open(os.path.join(vdir, 'words.json'), 'w'), indent=0)
print('mismatches:', bad); sys.exit(1 if bad else 0)
