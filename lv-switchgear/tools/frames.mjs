// Resumable frame renderer for slow (software WebGL) machines: frames/f_00000.jpg …, skips frames already on disk.
//   cd "$LIB" && node <project>/tools/frames.mjs <project> [--fps 24] [--workers 2] [--from 0] [--to N]
// Then encode: ffmpeg -framerate 24 -i <project>/frames/f_%05d.jpg -c:v libx264 -crf 14 -pix_fmt yuv420p <project>/out/video.mp4
import fs from 'fs'; import path from 'path';
const LIB = process.env.LIB || process.cwd();
const { openDemo, closeServer, glLost } = await import(path.join(LIB, 'core/render/page.mjs'));
const args = process.argv.slice(2), dir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FPS = +opt('--fps', 24), WK = +opt('--workers', 2);
const out = path.join(dir, 'frames'); fs.mkdirSync(out, { recursive: true });
const probe = await openDemo(dir, {}); const DUR = await probe.page.evaluate(() => window.DUR); await probe.browser.close();
const TOTAL = Math.round(DUR * FPS), A = +opt('--from', 0), B = Math.min(TOTAL, +opt('--to', TOTAL));
const name = f => path.join(out, `f_${String(f).padStart(5, '0')}.jpg`);
const todo = []; for (let f = A; f < B; f++) if (!fs.existsSync(name(f))) todo.push(f);
console.log(`${TOTAL} frames total, ${todo.length} to render with ${WK} workers`);
const t0 = Date.now(); let done = 0;
await Promise.all([...Array(WK)].map(async (_, w) => {
  const mine = todo.filter((_, i) => i % WK === w); if (!mine.length) return;
  let { browser, page } = await openDemo(dir, {});
  for (const f of mine) {
    for (let tries = 0; ; tries++) {
      try {
        await page.evaluate(t => window.render(t), f / FPS);
        const buf = await page.screenshot({ type: 'jpeg', quality: 95, timeout: 180000 });
        fs.writeFileSync(name(f) + '.tmp', buf); fs.renameSync(name(f) + '.tmp', name(f)); break;
      } catch (e) {
        if (tries >= 2) throw e;
        console.log(`w${w} frame ${f}: ${String(e.message).split('\n')[0]} — reopening the page`);
        try { await browser.close(); } catch {} ({ browser, page } = await openDemo(dir, {}));
      }
    }
    if (++done % 24 === 0) { const lost = await glLost(page); if (lost) throw new Error('WebGL context lost: ' + lost); const el = (Date.now() - t0) / 1000; console.log(`${done}/${todo.length}  ${el.toFixed(0)}s  eta ${((todo.length - done) * el / done / 60).toFixed(0)} min`); }
  }
  await browser.close();
}));
closeServer(); console.log('frames done'); process.exit(0);
