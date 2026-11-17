"""Synthesise a gentle soundtrack + pen-scratch foley + transition whooshes for the film."""
import json, wave, sys
import numpy as np

meta = json.load(open(sys.argv[1]))
SR = 48000
DUR = meta['duration'] + 0.5
N = int(DUR * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
L = np.zeros(N); Rr = np.zeros(N)

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

def bandpass(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    mask = np.exp(-0.5 * ((np.log(np.maximum(f, 1)) - np.log(np.sqrt(lo * hi))) / (np.log(hi / lo) / 2)) ** 2)
    return np.fft.irfft(X * mask, len(x))

def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[:N - i]
    L[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    Rr[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))

BPM = 86; beat = 60 / BPM; bar = beat * 4
# Cmaj9-ish / Am7 / Fmaj7 / Gsus -> G
chords = [[48, 55, 59, 62, 64], [45, 52, 55, 60, 64], [41, 48, 52, 57, 60], [43, 50, 55, 57, 62]]
roots = [36, 33, 29, 31]
nbars = int(DUR / bar) + 1
music_end = meta['duration'] - 0.2

# pad
for b in range(nbars):
    st = b * bar
    if st > music_end: break
    ch = chords[b % 4]
    ln = bar + 1.2
    tt = np.arange(int(ln * SR)) / SR
    env = np.minimum(1, tt / 0.9) * np.minimum(1, np.maximum(0, (ln - tt) / 1.2))
    sig = np.zeros_like(tt)
    for k, m in enumerate(ch):
        f = mtof(m + 12)
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            sig += (np.sin(2 * np.pi * ff * tt) + 0.3 * np.sin(4 * np.pi * ff * tt) + 0.1 * np.sin(6 * np.pi * ff * tt))
    sig *= env * (1 + 0.15 * np.sin(2 * np.pi * 0.25 * tt))
    add(sig, st, 0.012, -0.2 + 0.4 * (b % 2))

# bass
for b in range(nbars):
    for bt in (0, 2.5):
        st = b * bar + bt * beat
        if st > music_end or b < 2: continue
        f = mtof(roots[b % 4])
        tt = np.arange(int(1.4 * SR)) / SR
        env = np.minimum(1, tt / 0.02) * np.exp(-tt * 2.2)
        add((np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)) * env, st, 0.09 if bt == 0 else 0.06)

# plucky arpeggio (enters bar 2), with ping-pong delay
pl = np.zeros(N); pr = np.zeros(N)
pattern = [0, 2, 4, 3, 1, 3, 4, 2]
for b in range(2, nbars):
    ch = chords[b % 4]
    for s in range(8):
        st = b * bar + s * beat / 2
        if st > music_end - 1: continue
        if (b % 8 == 7) and s >= 4: continue   # breathing space
        m = ch[pattern[s]] + 24 - (12 if pattern[s] == 4 else 0)
        f = mtof(m)
        tt = np.arange(int(0.9 * SR)) / SR
        env = np.minimum(1, tt / 0.004) * np.exp(-tt * 6.5)
        sig = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 10) + 0.12 * np.sin(6 * np.pi * f * tt) * np.exp(-tt * 18)) * env
        vel = 0.75 + 0.25 * ((s % 4) == 0) + rng.uniform(-0.08, 0.08)
        i = int(st * SR); sig = sig[:N - i]
        (pl if s % 2 == 0 else pr)[i:i + len(sig)] += sig * vel
d = int(beat * 0.75 * SR)
dl = np.zeros(N); dr = np.zeros(N)
for k in range(1, 6):
    g = 0.38 ** k
    src_l, src_r = (pr, pl) if k % 2 else (pl, pr)
    dl[d * k:] += src_l[:N - d * k] * g
    dr[d * k:] += src_r[:N - d * k] * g
L += (pl * 0.8 + pr * 0.4 + dl * 0.6) * 0.045
Rr += (pr * 0.8 + pl * 0.4 + dr * 0.6) * 0.045

# soft shaker on off-beats
shk = bandpass(rng.normal(0, 1, N), 5000, 11000)
shenv = np.zeros(N)
for b in range(4, nbars):
    for s in range(8):
        st = b * bar + s * beat / 2 + beat / 4
        if st > music_end - 2: continue
        i = int(st * SR); ln = int(0.09 * SR)
        e = np.exp(-np.arange(ln) / SR * 45) * (0.6 if s % 2 else 1.0)
        shenv[i:i + ln] += e[:max(0, N - i)]
L += shk * shenv * 0.012; Rr += shk * shenv * 0.010

# master fade for music
fade = np.minimum(1, t / 2.0) * np.clip((meta['duration'] + 0.3 - t) / 3.5, 0, 1)
L *= fade; Rr *= fade

# pen scratch foley
noise = bandpass(rng.normal(0, 1, N), 1800, 7000)
penv = np.zeros(N)
for a, z, kind in meta['penIntervals']:
    i0, i1 = int(a * SR), min(N, int(z * SR))
    if i1 <= i0: continue
    tt = np.arange(i1 - i0) / SR
    rate = 7.5 if kind == 'write' else 4.5
    jit = 0.55 + 0.45 * np.abs(np.sin(np.pi * rate * tt + rng.uniform(0, 6)))
    edge = np.minimum(1, tt / 0.03) * np.minimum(1, (tt[-1] - tt + 1e-3) / 0.05)
    penv[i0:i1] = np.maximum(penv[i0:i1], jit * edge)
L += noise * penv * 0.022; Rr += noise * penv * 0.018

# whooshes on camera moves
for a, z in meta['cams']:
    ln = z - a + 0.4
    tt = np.arange(int(ln * SR)) / SR
    env = np.sin(np.pi * np.clip(tt / ln, 0, 1)) ** 2
    w = bandpass(rng.normal(0, 1, len(tt)), 300, 2500) * env
    add(w, a, 0.07, 0)

# chime when the whole sheet is revealed
tz = meta['cams'][-1][0]
for k, m in enumerate([72, 76, 79, 84]):
    tt = np.arange(int(3 * SR)) / SR
    f = mtof(m)
    sig = (np.sin(2 * np.pi * f * tt) + 0.2 * np.sin(2 * np.pi * 2.76 * f * tt) * np.exp(-tt * 4)) * np.exp(-tt * 1.6) * np.minimum(1, tt / 0.005)
    add(sig, tz + 1.4 + k * 0.16, 0.06, -0.3 + 0.2 * k)

mx = np.stack([L, Rr], 1)
mx /= np.max(np.abs(mx)) / 0.5
mx = np.tanh(mx * 1.3) / np.tanh(1.3) * 0.89
with wave.open(sys.argv[2], 'wb') as wv:
    wv.setnchannels(2); wv.setsampwidth(2); wv.setframerate(SR)
    wv.writeframes((mx * 32767).astype(np.int16).tobytes())
print('audio', DUR)
