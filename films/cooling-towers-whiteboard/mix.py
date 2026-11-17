"""Foley + VO + score → out/mix.wav, normalised to −14 LUFS in Python (two-pass BS.1770, true-peak ≤ −1 dBTP).
Every stroke on the board makes its own marker sound shaped by the engine's hand-speed curve (technique from the
library's whiteboard demo, MIT). ffmpeg 6.x under-reports audio length through loudnorm, so loudness is done here.
   $LIB/.venv/bin/python mix.py"""
import sys, os, json, numpy as np, soundfile as sf, soxr
from scipy.signal import lfilter, resample_poly
LIB = os.environ['LIB']; sys.path.insert(0, LIB)
from core.audio.sfx import SR, bp, lp, hp, add, compress, limit
from core.audio import sampler as S
HERE = os.path.dirname(os.path.abspath(__file__))
ev = json.load(open(os.path.join(HERE, 'events.json'))); E = ev['ev']; DUR = ev['dur']
C = next(e for e in E if e['type'] == 'cues'); CAMS = next(e for e in E if e['type'] == 'cams')['moves']
rng = np.random.default_rng(17)
NS = int((DUR + 1) * SR)
fol, room, vo = (np.zeros((NS, 2), np.float32) for _ in range(3))
tt = lambda d: np.arange(int(d * SR)) / SR
db = lambda x: 10 ** (x / 20)
dec = lambda d, tau: np.exp(-tt(d) / tau)

_band = {}
def band(n, lo, hi):
    k = (lo, hi)
    if k not in _band: _band[k] = bp(rng.standard_normal(SR * 8), lo, hi, 2).astype(np.float32)
    b = _band[k]; i = int(rng.integers(0, len(b) - n - 1)); return b[i:i + n]
def marker(dur, length, kind, pen, z=1.):
    d = max(.03, dur); n = int(d * SR); u = np.linspace(0, 1, n)
    v = 1 - .8 * np.cos(2 * np.pi * u)
    if kind == 'dash': v = np.ones(n) * 1.2
    a = (v / 1.8) ** .8 * np.minimum(1, u * d / .006) * np.minimum(1, (1 - u) * d / .012)
    br = {'black': 1.0, 'orange': 1.12, 'blue': .92, 'blue2': .92}.get(pen, 1.)
    x = band(n, 2200 * br, 7500 * br) * (.55 + .45 * v / 1.8) + band(n, 500 * br, 1500 * br) * .45
    x += bp((rng.random(n) < .004 * (1 + v)) * rng.standard_normal(n) * .8, 1500, 6000)
    x *= a
    if kind != 'dash' and length > 140 and rng.random() < .25:          # dry-erase squeak
        s0 = rng.uniform(.15, .55) * d; sd = min(d - s0, rng.uniform(.06, .16))
        if sd > .03:
            m = int(sd * SR); ts = np.arange(m) / SR; f0 = rng.uniform(1500, 2600) * br
            f = f0 * (1 + .03 * np.sin(2 * np.pi * rng.uniform(7, 13) * ts))
            sq = (np.sin(2 * np.pi * np.cumsum(f) / SR) + .3 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * ts / sd) ** 1.5 * .35
            i0 = int(s0 * SR); x[i0:i0 + m] += sq[:len(x) - i0]
    k = int(.004 * SR); x[:k] += bp(rng.standard_normal(k), 2500, 6500) * np.linspace(1, 0, k) * 1.4
    return x * .32 * min(1.3, z ** .5)
def tap(z=1.): return bp(rng.standard_normal(int(.03 * SR)), 1800, 6000) * dec(.03, .004) * .36 * min(1.3, z ** .5)
def ring(fs, taus, amps, d):
    x = np.zeros(int(d * SR)); t = tt(d)
    for f, ta, am in zip(fs, taus, amps): x += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / ta) * am
    return x
def magnet(big=0):
    d = .5; x = np.zeros(int(d * SR)); k = int(.005 * SR)
    x[:k] += bp(rng.standard_normal(k), 2000, 9000) * np.linspace(1, 0, k) * 1.5
    x += ring([830, 1370, 2210, 3120], [.07, .05, .035, .02], [.35, .25, .15, .08], d) + ring([140 + 30 * big], [.09 + .06 * big], [.9 + .6 * big], d) * .9
    return x * (.5 + .35 * big)
def slide_s(d):                                          # magnet sliding on steel: soft scrape with grain
    n = int(d * SR); t = tt(d); u = t / d
    x = bp(rng.standard_normal(n), 350, 1600) * .5 + bp(rng.standard_normal(n), 1800, 4200) * .12
    x *= np.sin(np.pi * u) ** .6 * (.7 + .3 * np.sin(2 * np.pi * 11 * t))
    return x * .3
def magnet_off():
    d = .35; x = lp(rng.standard_normal(int(d * SR)), 1800) * np.minimum(1, tt(d) / .15) * dec(d, .1) * .25
    x[:int(.004 * SR)] += bp(rng.standard_normal(int(.004 * SR)), 2500, 8000) * .8
    return x
def rise(d):                                             # airy lift: band-passed noise sweeping up
    n = int(d * SR); t = tt(d); u = t / d; out = np.zeros(n); seg = int(.05 * SR)
    src = rng.standard_normal(n + seg)
    for i in range(0, n, seg):
        f = 400 * 2 ** (u[i] * 3.2); out[i:i + seg] = bp(src[i:i + seg * 2], f, f * 2.2)[:len(out[i:i + seg])]
    return out * np.sin(np.pi * u) ** 1.5 * .5
def cap_pop():
    d = .25; x = np.zeros(int(d * SR)); m = int(.07 * SR)
    x[:m] += bp(rng.standard_normal(m), 1200, 5000) * np.linspace(.2, 1, m) * .35
    p = ring([1750, 3400], [.03, .012], [.8, .3], d - .07); x[m:m + len(p)] += p; x[m:m + 60] += rng.standard_normal(60) * .9
    return x * .6
def cap_on():
    d = .2; x = np.zeros(int(d * SR))
    for j, o in enumerate([0, .045]):
        i = int(o * SR); k = int(.006 * SR); x[i:i + k] += bp(rng.standard_normal(k), 2500, 9000) * np.linspace(1, 0, k) * (1 - .4 * j)
        r = ring([2600], [.015], [.4], .06); x[i:i + len(r)] += r
    return x * .7
def eraser(d):
    n = int(d * SR); t = tt(d)
    base = bp(rng.standard_normal(n), 250, 2600) * .6 + bp(rng.standard_normal(n), 2500, 6000) * .15
    return base * (.45 + .55 * np.abs(np.sin(np.pi * t / d * 9))) * np.minimum(1, t / .04) * np.minimum(1, (d - t) / .06) * .5
def whoosh(d, v=1.):
    n = int(d * SR); t = tt(d); return bp(rng.standard_normal(n), 300, 2400) * np.sin(np.pi * t / d) ** 2 * .3 * v
def put(buf, x, t, g=1., pan=0.):
    if 0 <= t < DUR: add(buf, np.asarray(x, np.float32), t, g, pan)

for e in E:
    ty, t = e['type'], e['t']; pan = e.get('pan', 0); z = e.get('z', 1); off = db(-9) if e.get('on', 1) == 0 else 1
    if ty in ('stroke', 'write', 'dash'): put(fol, marker(e['dur'], e['len'], ty, e.get('pen'), z), t, off * (.8 if ty == 'write' else 1.), pan)
    elif ty == 'tap': put(fol, tap(z), t, off * .7, pan)
    elif ty == 'magnet': put(fol, magnet(e.get('big', 0)), t, 1.1, -.05)
    elif ty == 'slide': put(fol, slide_s(e['dur']), t, 1, 0)
    elif ty == 'magnetOff': put(fol, magnet_off(), t, 1, .1)
    elif ty == 'rise': put(fol, rise(e['dur']), t, 1.2, .1)
    elif ty == 'erase': put(fol, eraser(e['dur']), t, 1.1, 0)
    elif ty == 'cap': put(fol, cap_pop(), t, 1, .35)
    elif ty == 'capOn': put(fol, cap_on(), t, 1.1, .45)
by_pen = {}
for e in E:
    if e['type'] in ('stroke', 'write', 'dash', 'tap'): by_pen.setdefault(e['pen'], []).append(e)
for pen, Lp in by_pen.items():                           # pens flying in / out of frame
    Lp.sort(key=lambda e: e['t'])
    for a, b in zip(Lp, Lp[1:]):
        if b['t'] - (a['t'] + a['dur']) > .75: put(fol, whoosh(.38, .3), a['t'] + a['dur'], 1, .5); put(fol, whoosh(.42, .4), b['t'] - .42, 1, .4)
for a, b in CAMS: put(fol, whoosh(b - a, .35 if b - a > 1.5 else .55), a, 1, 0)   # camera moves

# room: tone, a faint server-room hum at the start, the tower fan under the tower shots
room_tone = lp(rng.standard_normal(NS), 900) * .010 + lp(rng.standard_normal(NS), 180) * .012
room[:, 0] += room_tone; room[:, 1] += np.roll(room_tone, 311)
t = np.arange(NS) / SR
hum = (np.sin(2 * np.pi * 100 * t) * .5 + np.sin(2 * np.pi * 200 * t) * .25 + lp(rng.standard_normal(NS), 400) * .4) * .012
hum *= np.clip(1 - (t - 14) / 4, 0, 1)
fan = bp(rng.standard_normal(NS), 120, 900) * (.75 + .25 * np.sin(2 * np.pi * 9 * t)) * .03
fan *= np.clip((t - 36.5) / 1.5, 0, 1) * np.clip((C['sil'][0][0] - t) / 1.2, 0, 1)
room[:, 0] += hum + fan; room[:, 1] += hum + fan
room = S.room(room, size=.35, mix=.25)

# VO (24k → 48k), compressed, a touch of room
lines = json.load(open(os.path.join(HERE, 'lines.json')))
vo_t = {e['id']: e['t'] for e in E if e['type'] == 'vo'}
vo_m = np.zeros(NS, np.float32)
for Ln in lines:
    y, sr = sf.read(os.path.join(HERE, 'voices', Ln['id'] + '.wav'))
    y = soxr.resample(y.astype(np.float32), sr, SR); i = int(vo_t[Ln['id']] * SR); vo_m[i:i + len(y)] += y[:NS - i]
vo_m = hp(vo_m, 70); vo_m = compress(vo_m / (np.abs(vo_m).max() + 1e-9) * .8, thr=.2, ratio=3.0, att=.004, rel=.1)
vo[:, 0] = vo_m; vo[:, 1] = vo_m
vo = vo * .85 + S.room(vo, size=.2, mix=.1) * .15

# score, ducked under VO; the silences are real
mus, _ = sf.read(os.path.join(HERE, 'music', 'score.wav')); mus = mus[:NS]
if len(mus) < NS: mus = np.pad(mus, ((0, NS - len(mus)), (0, 0)))
env = np.convolve(np.abs(vo_m), np.ones(int(.05 * SR)) / int(.05 * SR), 'same'); on = (env > .02).astype(np.float32)
att, rel = int(.06 * SR), int(.35 * SR); dk = np.zeros(NS, np.float32); g = 0.
for j in range(0, NS, 240):
    tgt = on[j]; g += (tgt - g) * (240 / att if tgt > g else 240 / rel); dk[j:j + 240] = g
mus = mus * (1 - (1 - db(-8)) * dk)[:, None]
for s0, s1 in C['sil']:
    i0, i1 = int(s0 * SR), int(s1 * SR); f = int(.3 * SR); mus[i0:i0 + f] *= np.linspace(1, 0, f)[:, None]; mus[i0 + f:i1] *= 0.04

def rms(x): m = np.abs(x).max(1) > 1e-4; return float(np.sqrt(np.mean(x[m] ** 2))) if m.any() else 1.
vr, mr, fr = rms(vo), rms(mus), rms(fol)
mix = vo + mus * (vr / mr) * db(-10) + fol * (vr / fr) * db(-11) + room
mix = mix[:int(DUR * SR)]

# loudness: ITU-R BS.1770 K-weighting + gating, then a true-peak limiter (4× oversampled check)
def lufs(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
    blk, hop = int(.4 * SR), int(.1 * SR)
    p = np.array([np.mean(np.sum(y[i:i + blk] ** 2, 1)) for i in range(0, len(y) - blk, hop)])
    l = -0.691 + 10 * np.log10(p + 1e-12); p = p[l > -70]
    rel = -0.691 + 10 * np.log10(p.mean()) - 10
    return -0.691 + 10 * np.log10(p[(-0.691 + 10 * np.log10(p)) > rel].mean())
def tpeak(x): return max(np.abs(resample_poly(x[:, c], 4, 1)).max() for c in range(2))
for _ in range(3):
    mix *= db(-14 - lufs(mix))
    ceil = db(-1.3)
    if tpeak(mix) > ceil: mix = np.stack([limit(mix[:, c], ceil * .97) for c in range(2)], 1)
print('LUFS', round(lufs(mix), 2), 'true peak dBTP', round(20 * np.log10(tpeak(mix)), 2))
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
