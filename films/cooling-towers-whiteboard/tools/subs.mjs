// Export the burned-in subtitle timetable → out/subs.json (core/render/srt.py turns it into subtitles_en.srt)
//   node tools/subs.mjs   (LIB in the environment)
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const { openDemo, closeServer } = await import(pathToFileURL(path.join(process.env.LIB, 'core/render/page.mjs')).href);
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { browser, page } = await openDemo(dir);
const subs = await page.evaluate(() => window.SUBS.map(s => ({ t0: +s.t0.toFixed(2), t1: +s.t1.toFixed(2), text: s.text })));
fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
fs.writeFileSync(path.join(dir, 'out/subs.json'), JSON.stringify(subs, null, 1)); console.log('subs', subs.length);
await browser.close(); closeServer();
