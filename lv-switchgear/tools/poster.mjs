// Clean poster still (no subtitles): cd "$LIB" && node <project>/tools/poster.mjs <project> [t=29.5]
import fs from 'fs'; import path from 'path';
const LIB = process.env.LIB || process.cwd();
const { openDemo, closeServer } = await import(path.join(LIB, 'core/render/page.mjs'));
const dir = path.resolve(process.argv[2]), t = +(process.argv[3] || 29.5);
const { browser, page } = await openDemo(dir, { q: 'nosubs=1' });
await page.evaluate(t => window.render(t), t);
fs.writeFileSync(path.join(dir, 'poster.jpg'), await page.screenshot({ type: 'jpeg', quality: 92, timeout: 180000 }));
await browser.close(); closeServer(); console.log('poster.jpg at', t, 's'); process.exit(0);
