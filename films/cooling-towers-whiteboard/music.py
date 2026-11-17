"""Score: a synth arpeggio that climbs in register station by station as the heat climbs to the roof, kalimba
whenever water is on screen, a near-silence for the lift-off, a low C-minor reprise for the water bill, and a warm
E-flat chord under the wipe. All synthesis (numpy), no samples. Reads events.json for the hit points.
   $LIB/.venv/bin/python music.py   → music/score.wav (48 kHz stereo)"""
import os, json, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
ev = json.load(open(os.path.join(HERE, 'events.json'))); DUR = ev['dur']
C = next(e for e in ev['ev'] if e['type'] == 'cues')
VO = {e['id']: e['t'] for e in ev['ev'] if e['type'] == 'vo'}
rng = np.random.default_rng(92)
N = int((DUR + 2) * SR); L = np.zeros(N); R = np.zeros(N)
BPM = 92; BEAT = 60 / BPM; T0 = 0.0
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
def lp(x, f): return sosfilt(butter(2, min(f, SR * .45), 'low', fs=SR, output='sos'), x)
def put(x, t, g=1., pan=0.):
    i = int(t * SR)
    if i >= N or i < 0: return
    x = x[:N - i]; L[i:i + len(x)] += x * g * np.sqrt(.5 * (1 - pan)); R[i:i + len(x)] += x * g * np.sqrt(.5 * (1 + pan))

# sections: (start, register step, brightness 0..1, key) — the register climbs with the heat
tL0, tL1, tW, tCap = C['tLift0'], C['tLift1'], C['tWipe'], C['tCap']
SEC = [(0.0, 0, .25, 'Eb'), (VO['v05'], 1, .4, 'Eb'), (VO['v07'], 2, .55, 'Eb'), (VO['v09'] - .4, 3, .8, 'Eb'),
       (C['sil'][0][0], None, 0, None), (VO['v16'] - .6, 0, .3, 'Cm'), (C['sil'][1][0], None, 0, None), (tW, 'chord', 0, 'Eb')]
PROG = {'Eb': [[51, 55, 58, 62], [48, 51, 55, 58], [44, 48, 51, 55], [46, 50, 53, 58]],      # Eb  Cm  Ab  Bb
        'Cm': [[48, 51, 55, 58], [44, 48, 51, 55], [39, 46, 51, 55], [43, 47, 50, 55]]}      # Cm  Ab  Eb  G
def sec_at(t):
    s = SEC[0]
    for x in SEC:
        if t >= x[0]: s = x
    return s
def pluck(f, d, bright):
    t = np.arange(int(d * SR)) / SR; x = np.zeros_like(t)
    nh = 2 + int(bright * 7)
    for h in range(1, nh + 1): x += np.sin(2 * np.pi * f * h * t + h) / h ** 1.15 * np.exp(-t * (5 + h * (2.5 - bright * 1.5)))
    return x * np.minimum(1, t / .004)
def kalimba(f, d=1.6):
    t = np.arange(int(d * SR)) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2) + .45 * np.sin(2 * np.pi * f * 5.92 * t) * np.exp(-t * 14) + .2 * np.sin(2 * np.pi * f * 13.1 * t) * np.exp(-t * 30)
    x[:int(.002 * SR)] += rng.standard_normal(int(.002 * SR)) * .3
    return x * np.minimum(1, t / .002)
def pad(notes, d, att=1.2, rel=1.5):
    t = np.arange(int(d * SR)) / SR; x = np.zeros_like(t)
    for m in notes:
        for det in (-.07, .07): x += np.sin(2 * np.pi * mtof(m) * 2 ** (det / 12) * t) + .2 * np.sin(4 * np.pi * mtof(m) * t)
    return x * np.minimum(1, t / att) * np.clip((d - t) / rel, 0, 1)

# arpeggio in eighths, chord per bar
step8 = BEAT / 2; k = 0
t = T0
water_on = lambda t: (VO['v06'] <= t < C['sil'][0][0]) or (VO['v16'] - .6 <= t < C['sil'][1][0])
while t < tW:
    s = sec_at(t)
    if s[1] is not None and s[1] != 'chord':
        bar = int((t - T0) / (BEAT * 4)); ch = PROG[s[3]][bar % 4]
        pat = [0, 1, 2, 3, 2, 1, 2, 3]
        m = ch[pat[k % 8]] + 12 + [0, 3, 5, 7][s[1]] + (12 if pat[k % 8] == 3 and s[1] >= 2 else 0)
        if s[3] == 'Cm': m -= 0
        vel = (.9 if k % 2 == 0 else .62) * (1.1 if k % 8 == 0 else 1)
        put(lp(pluck(mtof(m), .7, s[2]), 1200 + 5000 * s[2]), t, .16 * vel, .25 if k % 2 else -.25)
        if k % 8 == 0:                                   # pad + bass per bar
            put(pad([n + 12 for n in ch[:3]], BEAT * 4 + 1.2), t, .028)
            put(pluck(mtof(ch[0] - 12), 1.6, .2), t, .32)
        if s[1] == 3 and k % 2 == 0:                     # the tower's light pulse
            tt = np.arange(int(.18 * SR)) / SR; put(np.sin(2 * np.pi * (55 + 60 * np.exp(-tt * 40)) * tt) * np.exp(-tt * 18), t, .22)
        if water_on(t) and k % 3 == 0:                   # kalimba on water
            pent = [63, 65, 67, 70, 72, 75] if s[3] == 'Eb' else [60, 63, 65, 67, 70, 72]
            put(kalimba(mtof(pent[int(rng.integers(0, 6))])), t + rng.uniform(0, .02), .11, rng.uniform(-.5, .5))
    t += step8; k += 1

# lift-off: a rising glassy chime as the watt leaves
for i, m in enumerate([75, 79, 82, 87, 91]):
    put(kalimba(mtof(m), 2.4) * .8, tL0 + .25 + i * .16, .13, -.4 + i * .2)
put(pad([63, 70, 75], tL1 - tL0 + 1.5, att=.8, rel=1.2), tL0, .02)
# the wipe: a warm E-flat chord swells under the eraser and rings over the cap click
put(pad([39, 51, 58, 62, 67], DUR - tW + 1.0, att=2.2, rel=2.5), tW, .045)
for i, m in enumerate([63, 67, 70, 75]): put(kalimba(mtof(m), 3), tCap + .05 + i * .11, .10, -.3 + i * .2)

mx = np.stack([L, R], 1)[:int(DUR * SR)]
mx /= np.abs(mx).max() + 1e-9; mx *= .8
os.makedirs(os.path.join(HERE, 'music'), exist_ok=True)
sf.write(os.path.join(HERE, 'music', 'score.wav'), mx.astype(np.float32), SR)
print('score', DUR, 's')
