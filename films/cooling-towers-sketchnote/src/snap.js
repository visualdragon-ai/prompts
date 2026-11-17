const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('file://' + __dirname + '/index.html');
  const film = await p.evaluate(() => window.FILM_READY);
  console.log('duration', film.duration.toFixed(2), 'errors', errs, JSON.stringify(film.cams.map(c=>c[0].toFixed(1))));
  const times = process.argv.slice(2).map(Number);
  for (const t of times) {
    await p.evaluate(t => window.render(t), t);
    await p.screenshot({ path: `snap_${t}.png` });
  }
  await b.close();
})();
