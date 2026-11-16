"""Score + foley + ambience + narration → out/mix.wav (48 kHz stereo). Reads events.json (from the page) and voices/.
Run with the library's Python: "$LIB/.venv/bin/python" mix.py   (LIB = the Lemo-Opuscar library folder)"""
import json, os, sys
import numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.expanduser('~/lemo-opuscar')
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio.sfx import SR, add, limit, compress, noise, brown, bp, lp, hp, t_, env_exp, norm, clack, click, pop, whoosh, thump, ding, ignite

S.seed(11)
EVJ = json.load(open(os.path.join(HERE, 'events.json')))
DUR, EV = EVJ['dur'], EVJ['ev']
N = int(DUR * SR) + SR
BEAT = 60 / 96; BAR = BEAT * 4
TL = dict(hook=BEAT, rise1=5.0, sign=14.375, turn=17.5, main=20.625, bus=21.875, fault=31.25, trip=31.875, outage=38.125, ups=41.875,
          gen=43.75, mainopen=48.125, genclose=49.375, fold2=53.125)
VO = [('v01', 1.0), ('v02', 6.25), ('v03', 14.375), ('v04', 20.625), ('v05', 26.25), ('v06', 31.875), ('v07', 36.25),
      ('v08', 39.375), ('v09', 42.0), ('v10', 47.5), ('v11', 54.375)]
rng = np.random.default_rng(3)

def M(n):  # note name → midi
    return S.midi(n)

# ---------------- score ----------------
CH = {'F': ['F2', ['A4', 'C5', 'F5']], 'C': ['C3', ['G4', 'C5', 'E5']], 'Dm': ['D3', ['A4', 'D5', 'F5']], 'Bb': ['Bb2', ['Bb4', 'D5', 'F5']],
      'Gm': ['G2', ['Bb4', 'D5', 'G5']], 'Am': ['A2', ['A4', 'C5', 'E5']]}
ev = []
def bar_t(n): return n * BAR
def pizz_bar(n, chord, vel=.6, chords=True, bass=True):
    b, tri = CH[chord]; t0 = bar_t(n)
    if bass:
        ev.append((t0, 'cellos_pizz', b, .6, vel, -.2)); ev.append((t0 + 2 * BEAT, 'cellos_pizz', S.name(M(b) + 7), .6, vel * .85, -.2))
    if chords:
        for k in (1, 3):
            for i, p in enumerate(tri): ev.append((t0 + k * BEAT + BEAT * .5 * 0, 'violins_pizz', p, .4, vel * .55, .25 + i * .05))
prog = ['F', 'C', 'Dm', 'Bb']
# bars 0-1 hook: glockenspiel alone, two notes, then a soft vibraphone chord
ev += [(BEAT * 2, 'glockenspiel', 'F6', 2, .45, .2), (BEAT * 3.5, 'glockenspiel', 'C7', 2, .35, .25), (BAR + BEAT * 2, 'glockenspiel', 'A6', 2, .35, .2),
       (BAR, 'vibraphone', 'F4', 3, .3, -.1), (BAR, 'vibraphone', 'A4', 3, .25, .1), (BAR, 'vibraphone', 'C5', 3, .25, .1)]
# bars 2-5: the path (pizz + glock)
for n in range(2, 6): pizz_bar(n, prog[(n - 2) % 4], .55 + .03 * (n - 2))
for n, mel in zip(range(2, 6), [['C6', 'F6'], ['E6', 'G6'], ['F6', 'A6'], ['D6', 'F6']]):
    ev += [(bar_t(n) + BEAT * 1.5, 'glockenspiel', mel[0], 1.5, .3, .3), (bar_t(n) + BEAT * 3.5, 'glockenspiel', mel[1], 1.5, .28, .3)]
# bar 6 (15-17.5): title, glock arpeggio
pizz_bar(6, 'F', .6)
for i, p in enumerate(['F6', 'A6', 'C7', 'F7']): ev.append((bar_t(6) - .625 + i * BEAT * .5 + .625, 'glockenspiel', p, 2, .4, .2))
# bar 7 (17.5-20): page turn, harp gliss
for i in range(12): ev.append((bar_t(7) + i * .09, 'harp', S.name(M('F3') + [0, 2, 4, 5, 7, 9, 11][i % 7] + 12 * (i // 7)), 1.5, .45, -.2 + i * .04))
# bars 8-11 (20-30): inside, full: pizz + clarinet melody + shaker
mel = [('A4', 0, 1), ('C5', 1, 1), ('F5', 2, 2), ('E5', 4, 1), ('D5', 5, 1), ('C5', 6, 2), ('D5', 8, 1.5), ('F5', 9.5, .5), ('A5', 10, 2), ('G5', 12, 1), ('F5', 13, 1), ('D5', 14, 2)]
for n in range(8, 12): pizz_bar(n, prog[(n - 8) % 4], .62)
for p, bt, d in mel: ev.append((bar_t(8) + bt * BEAT + BAR * 0, 'clarinet', p, d * BEAT * .95, .42, -.15))
for k in range(32): ev.append((bar_t(8) + k * BEAT / 2, 'shaker', None, None, .18 + .08 * (k % 2 == 0), .35))
# bars 12-14 (30-37.5): fault: pizz bass only, sparse, minor
for n, c in zip(range(12, 15), ['Dm', 'Bb', 'C']): pizz_bar(n, c, .5, chords=False)
ev.append((TL['fault'], 'cellos_pizz', 'D2', .8, .8, 0)); ev.append((TL['fault'], 'vibraphone', 'C#5', 1.5, .3, .2)); ev.append((TL['fault'], 'vibraphone', 'D5', 1.5, .3, -.2))
ev.append((bar_t(14) + BEAT * 2, 'glockenspiel', 'E6', 1.5, .25, .2))
# 38.125-41.875: silence (outage). 41.875: UPS bridge, clarinet low + soft vibraphone pulse
for i, (p, bt, d) in enumerate([('D4', 0, 3), ('F4', 3, 3), ('E4', 6, 3), ('G4', 9, 3)]):
    ev.append((TL['ups'] + bt * BEAT * 1.0, 'clarinet', p, d * BEAT, .32, -.1))
for k in range(12): ev.append((TL['ups'] + k * BEAT, 'vibraphone', 'A3' if k % 2 == 0 else 'D4', .4, .16, .1))
# generator running: pizz bass on every beat building to the transfer
for k in range(int((TL['genclose'] - TL['gen']) / BEAT)):
    ev.append((TL['gen'] + k * BEAT, 'cellos_pizz', ['D3', 'D3', 'Bb2', 'C3'][(k // 2) % 4], .5, .35 + .03 * k, -.2))
# 49.375 restore: bright, F major, glock sparkle
for i, p in enumerate(['C6', 'F6', 'A6', 'C7', 'F7']): ev.append((TL['genclose'] + .1 + i * .08, 'glockenspiel', p, 2.5, .38, .2))
r0 = TL['genclose'] + BEAT
for k, c in enumerate(['F', 'C', 'Bb', 'F', 'Dm', 'Bb', 'C']):
    t0 = r0 + k * BAR * .5; b, tri = CH[c]
    ev.append((t0, 'cellos_pizz', b, .6, .6, -.2))
    for i, p in enumerate(tri): ev.append((t0 + BEAT, 'violins_pizz', p, .4, .38, .25))
for p, bt, d in [('C5', 0, 1), ('F5', 1, 1), ('A5', 2, 2), ('G5', 4, 1), ('F5', 5, 1), ('E5', 6, 2), ('F5', 8, 1), ('G5', 9, 1), ('A5', 10, 4)]:
    ev.append((r0 + bt * BEAT, 'clarinet', p, d * BEAT * .95, .4, -.15))
# final: chord at 57.5, glock alone in the last bar
fin = 57.5
for p in ['F2', 'C3']: ev.append((fin, 'cellos_pizz', p, 1, .5, -.2))
for p in ['F4', 'A4', 'C5', 'F5']: ev.append((fin, 'vibraphone', p, 3.5, .28, .1))
ev.append((fin, 'clarinet', 'A4', 2.6, .3, -.1))
for i, p in enumerate(['A6', 'F6', 'C6', 'F6']): ev.append((fin + 1.25 + i * BEAT, 'glockenspiel', p, 2, .22, .2))

music = S.render(ev, dur=DUR + 1)
music = S.room(music, size=.4, mix=.16)
music = music[:N] if len(music) >= N else np.pad(music, ((0, N - len(music)), (0, 0)))
music *= 1.0
music = music / max(1e-9, np.abs(music).max()) * .5

# ---------------- voice ----------------
voice = np.zeros((N, 2), np.float32); speech = np.zeros(N, bool)
for vid, t0 in VO:
    x, sr = sf.read(os.path.join(HERE, 'voices', vid + '.wav'), dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    x = soxr.resample(x, sr, SR)
    x = hp(x, 90); x = norm(x, .9); x = compress(x, thr=.25, ratio=3)
    add(voice, x, t0, 1.0, 0)
    s = int(t0 * SR); speech[s:s + len(x)] = True
rev = S.room(voice, size=.25, mix=.07); voice = rev
# ---------------- foley ----------------
fx = np.zeros((N, 2), np.float32)
def paper(d=.12, v=1.0, lo=1500, hi=7000):
    return norm(bp(noise(d), lo, hi) * env_exp(d, d / 4) * (1 + .5 * (rng.random(int(round(d * SR))) > .97))) * v
def snap(v=1.0):          # pop-up snap: short sine sweep + crinkle
    a = pop(1); b = paper(.08, .6); y = np.zeros(max(len(a), len(b))); y[:len(a)] += a; y[:len(b)] += b; return norm(y) * v
def breaker(v=1.0):       # cardboard clack + low thump
    a = clack(.8, 1); b = thump(.6, 90); y = np.zeros(max(len(a), len(b))); y[:len(a)] += a; y[:len(b)] += b * .7; return norm(y) * v
def zap(d=.6):
    tt = t_(d); g = (rng.random(len(tt)) > .9).astype(float); g = lp(g, 400) > .08
    x = hp(noise(d), 1500) * g * env_exp(d, .25) + np.sin(2 * np.pi * 120 * tt) * np.sign(np.sin(2 * np.pi * 60 * tt)) * .25 * env_exp(d, .2)
    return norm(x)
def sweep(d, f0, f1, v=1.0):
    tt = t_(d); f = f0 * (f1 / f0) ** (tt / d)
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d) ** 2) * v
def beep(v=1.0):
    d = .5; tt = t_(d); x = np.sin(2 * np.pi * 1320 * tt) * ((tt < .12) | ((tt > .22) & (tt < .34))) ; return lp(x, 4000) * .5 * v
for e in EV:
    t, ty = e['t'], e['type']; pan = 0
    if ty == 'clack': add(fx, breaker(), t, .55 * e.get('v', 1), .1)
    elif ty == 'pop': add(fx, snap(), t, .28 * e.get('v', 1), rng.uniform(-.5, .5))
    elif ty == 'fold': add(fx, paper(.18, 1, 900, 5000), t, .12, rng.uniform(-.5, .5))
    elif ty == 'slide': add(fx, norm(bp(noise(e['d']), 800, 3000)) * np.sin(np.pi * t_(e['d']) / e['d']) ** 2, t, .05, -.2)
    elif ty == 'sign':
        add(fx, whoosh(.3), t - .1, .18, 0); add(fx, thump(1, 110), t + .32, .3, 0)
        for k in range(3): add(fx, ding(.3)[:int(.5 * SR)], t + .35 + k * .21, .06 / (k + 1), .2 * (k - 1))
    elif ty == 'page':
        add(fx, whoosh(e['d'] * .8), t + .1, .32, -.2); add(fx, paper(.3, 1, 600, 4000), t + .05, .2, -.3); add(fx, paper(.25, 1, 700, 5000), t + e['d'] - .3, .18, .2)
    elif ty == 'energise': add(fx, sweep(1.2, 50, 120), t, .22, 0)
    elif ty == 'zap': add(fx, zap(.7), t, .5, .5)
    elif ty == 'trip': add(fx, breaker(), t, .7, .5); add(fx, click(1.3, 1), t + .03, .3, .5)
    elif ty == 'ding': add(fx, ding(1), t, .12, .3)
    elif ty == 'outage': add(fx, sweep(.8, 140, 40), t, .16, 0); add(fx, thump(1, 55), t, .35, 0)
    elif ty == 'ups': add(fx, beep(), t, .14, -.2)
    elif ty == 'genstart': add(fx, ignite(1), t + .5, .3, -.5)
    elif ty == 'lock': add(fx, click(.7, 1), t, .45, -.3); add(fx, clack(1.5, .6), t + .06, .2, -.3)
    elif ty == 'restore': add(fx, sweep(1.0, 60, 140), t, .2, 0); add(fx, ding(1), t + .2, .08, 0)
fx[:, 0] = limit(fx[:, 0], .6); fx[:, 1] = limit(fx[:, 1], .6)

# ---------------- ambience ----------------
amb = np.zeros((N, 2), np.float32)
tt = np.arange(N) / SR
room = lp(brown(N / SR), 500) * .05
amb[:, 0] += room; amb[:, 1] += np.roll(room, 2400)
for k in range(int(DUR)):    # quiet clock in the room
    if k % 1 == 0: add(amb, click(1.6, 1)[:int(.03 * SR)], k + .31, .018, -.6)
seg = lambda a, b: np.clip((tt - a) / max(1e-9, b - a), 0, 1)
wind = norm(bp(noise(N / SR), 300, 1600)) * (.6 + .4 * np.sin(2 * np.pi * tt / 7))
wbed = wind * .035 * seg(5, 6.5) * (1 - seg(17.5, 19))
amb[:, 0] += wbed; amb[:, 1] += np.roll(wbed, 600)
hum = sum(a * np.sin(2 * np.pi * f * tt) for f, a in [(100, 1), (200, .5), (300, .3), (400, .15)])
hum = lp(hum + .1 * bp(noise(N / SR), 90, 500), 900)
hon = seg(TL['bus'], TL['bus'] + 1.2) * (1 - seg(TL['outage'], TL['outage'] + .4)) + seg(TL['genclose'], TL['genclose'] + 1.2) * (1 - seg(56, 60))
hb = hum * .03 * hon
amb[:, 0] += hb; amb[:, 1] += hb
# generator chug: low pulses while it runs
grun = seg(TL['gen'] + .7, TL['gen'] + 1.5) * (1 - seg(TL['fold2'], TL['fold2'] + 1.5))
chug = lp(brown(N / SR), 260) * (.55 + .45 * np.sign(np.sin(2 * np.pi * 14 * tt))) * grun
chug = lp(chug, 300) * .12
amb[:, 0] += chug * 1.2; amb[:, 1] += chug * .7

# ---------------- mix ----------------
# music: silent through the outage until the UPS bridge, ducked under speech
mgate = 1 - seg(TL['outage'] - .05, TL['outage'] + .05) * (1 - seg(TL['ups'] - .2, TL['ups']))
duck = np.convolve(speech.astype(float), np.ones(int(.3 * SR)) / int(.3 * SR), mode='same')
mg = (1 - .45 * duck) * mgate
music *= mg[:, None]
out = voice * 1.0 + music * 1.15 + fx * 1.0 + amb * 1.0
# fade out the last 1.2 s with the picture
out *= (1 - seg(DUR - 1.2, DUR))[:, None]
out = out[:int(DUR * SR)]
out = out / max(1e-9, np.abs(out).max()) * .89
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out', 'mix.wav')
sf.write(dst, out.astype(np.float32), SR)
# report: speech vs music RMS
vr = np.sqrt((voice[:int(DUR * SR)][speech[:int(DUR * SR)]] ** 2).mean()); mr = np.sqrt(((music * 1.15)[:int(DUR * SR)][speech[:int(DUR * SR)]] ** 2).mean())
print(f'mix → {dst}  ({DUR:.2f} s)  voice over music in speech: {20 * np.log10(vr / max(mr, 1e-9)):.1f} dB')
print('instruments:', sorted({e[1] for e in ev}))
