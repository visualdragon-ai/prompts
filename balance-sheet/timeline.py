"""One timeline for the film: where each narration line starts, its phrases, and the subtitle cues.
Reads voice/lines.json + voice/out/dur.json (Kokoro), writes timeline.json (page + mix) and subtitles_en.srt.
The picture in index.html is timed to these line starts; if the voice changes, check each line still ends before the next start."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, 'voice/lines.json')))
D = json.load(open(os.path.join(HERE, 'voice/out/dur.json')))
GAP = {'v12': 0.72}               # the three questions get room between them
IN_GAP = 0.32                     # breath between the phrases of one line
START = {'v01': 1.90, 'v02': 4.70, 'v03': 8.60, 'v04': 12.40, 'v05': 14.80, 'v06': 17.90,
         'v07': 20.70, 'v08': 25.70, 'v09': 31.00, 'v10': 35.40, 'v11': 38.60, 'v12': 43.00, 'v13': 50.40}
SUB = {
 'v01': 'A balance sheet answers one question:',
 'v02': 'What does a business own, and who paid for it?',
 'v03': 'On the left, assets: everything it owns.',
 'v04': 'Cash, flour, and a big oven.',
 'v05': 'Together, $100,000.',
 'v06': 'The right side shows who paid for it all.',
 'v07': 'Liabilities are what it owes: a bank loan, and unpaid bills.',
 'v08': "Equity is what's left for the owners.",
 'v09': 'Follow one dollar. Borrowed from the bank, it became part of the oven.',
 'v10': "That's why both sides always balance.",
 'v11': 'So, to read any balance sheet, ask three questions.',
 'v12': "What does it own? What does it owe? And what's left?",
 'v13': 'Assets = Liabilities + Equity.',
}
FILM = 58.0
# a line starts at its planned time, or later if the previous subtitle needs longer on screen
prev_end = 0.0
for lid in list(START):
    START[lid] = round(max(START[lid], prev_end), 3)
    ch = [c for c in C if c['id'].startswith(lid + '_')]
    end = START[lid] + sum(D[c['id']] for c in ch) + GAP.get(lid, IN_GAP) * (len(ch) - 1)
    prev_end = START[lid] + max(1.8, end - START[lid] + 0.6) + 0.12
lines = []
for lid, t in START.items():
    ch = [c for c in C if c['id'].startswith(lid + '_')]
    parts = []
    for c in ch:
        parts.append({'id': c['id'], 't': round(t, 3), 'dur': D[c['id']]}); t += D[c['id']] + GAP.get(lid, IN_GAP)
    end = parts[-1]['t'] + parts[-1]['dur']
    lines.append({'id': lid, 't0': START[lid], 't1': round(end, 3), 'parts': parts, 'en': SUB[lid]})
for i, L in enumerate(lines):
    need = max(1.8, L['t1'] - L['t0'] + 0.6)
    nxt = lines[i + 1]['t0'] - 0.12 if i + 1 < len(lines) else FILM - 0.3
    assert i + 1 == len(lines) or L['t1'] < lines[i + 1]['t0'] - 0.2, (L['id'], 'overlaps the next line')
    L['c0'] = L['t0']; L['c1'] = round(min(nxt, L['t0'] + need + 0.5), 3)
    assert L['c1'] - L['c0'] >= need - 1e-6, (L['id'], L['c1'] - L['c0'], need)
json.dump({'dur': FILM, 'lines': lines}, open(os.path.join(HERE, 'timeline.json'), 'w'), indent=1)
def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60); return f'{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'
with open(os.path.join(HERE, 'subtitles_en.srt'), 'w') as f:
    for i, L in enumerate(lines, 1):
        f.write(f"{i}\n{ts(L['c0'])} --> {ts(L['c1'])}\n{L['en']}\n\n")
for L in lines:
    words = len(L['en'].split()); print(L['id'], L['t0'], L['t1'], f"cue {L['c0']}-{L['c1']}", f"{words / (L['t1'] - L['t0']):.2f} w/s")
