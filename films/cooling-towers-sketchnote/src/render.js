const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const N = +process.argv[2] || 4;
(async () => {
  const b = await chromium.launch();
  const probe = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await probe.goto('file://' + __dirname + '/index.html');
  const film = await probe.evaluate(() => window.FILM_READY);
  fs.writeFileSync('film_meta.json', JSON.stringify(film));
  await probe.close();
  const fps = 30, total = Math.ceil(film.duration * fps);
  console.log('frames', total);
  const per = Math.ceil(total / N);
  let done = 0;
  await Promise.all([...Array(N).keys()].map(async w => {
    const a = w * per, z = Math.min(total, a + per);
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.goto('file://' + __dirname + '/index.html');
    await p.evaluate(() => window.FILM_READY);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), `seg_${w}.mp4`]);
    for (let f = a; f < z; f++) {
      await p.evaluate(t => window.render(t), f / fps);
      const buf = await p.screenshot({ type: 'jpeg', quality: 94 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 300 === 0) console.log('done', done, '/', total);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }));
  fs.writeFileSync('segs.txt', [...Array(N).keys()].map(w => `file 'seg_${w}.mp4'`).join('\n'));
  await b.close();
  console.log('frames rendered');
})();
