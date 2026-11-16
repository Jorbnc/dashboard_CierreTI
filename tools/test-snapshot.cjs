/* Tests the exact private packages without model data or any outbound requests. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {unzipSync} = require('fflate');
const {chromium, firefox, expect} = require('@playwright/test');
const {check} = require('./check-snapshot.cjs');
const root = path.resolve(__dirname, '..');
async function main() {
  assert.ok(process.argv[2], 'Indicar carpeta de entrega');
  const delivery = path.resolve(process.argv[2]), manifest = check(delivery), documents = {};
  for (const [business, info] of Object.entries(manifest.packages)) {
    const zip = unzipSync(fs.readFileSync(path.join(delivery, 'artifacts', `${business}.pbiviz`)));
    const resource = JSON.parse(Buffer.from(zip[`resources/${info.guid}.pbiviz.json`]).toString());
    const base = `/${business}`;
    documents[base] = ['text/html', `<!doctype html><html><body style="margin:0"><iframe title="SDK" src="${base}/frame" sandbox="allow-scripts" style="width:100vw;height:100vh;border:0"></iframe></body></html>`];
    documents[`${base}/frame`] = ['text/html', `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data: blob:; connect-src 'none'"><link rel="stylesheet" href="${base}/visual.css"></head><body style="margin:0"><div id="host"></div><script src="/host.js"></script><script src="${base}/visual.js"></script><script src="${base}/start.js"></script></body></html>`];
    documents[`${base}/visual.js`] = ['text/javascript', resource.content.js];
    documents[`${base}/visual.css`] = ['text/css', resource.content.css];
    documents[`${base}/start.js`] = ['text/javascript', `const events=[]; const instance=powerbi.visuals.plugins[${JSON.stringify(info.guid)}].create({element:document.getElementById('host'),host:{eventService:{renderingStarted:()=>events.push('start'),renderingFinished:()=>events.push('finish'),renderingFailed:()=>events.push('fail')},fetchMoreData:()=>{throw new Error('Snapshot no debe pedir datos');}}}); window.harness={events,update(type=2){instance.update({type,viewport:{width:innerWidth,height:innerHeight},dataViews:[]});},destroy(){instance.destroy();}};`];
    documents[`${base}/preview`] = ['text/html', fs.readFileSync(path.join(delivery, 'previews', `${business}.html`))];
  }
  documents['/host.js'] = ['text/javascript', 'window.powerbi = {};'];
  const server = http.createServer((req, res) => {
    const value = documents[req.url]; res.writeHead(value ? 200 : 404, {'Content-Type': `${value?.[0] || 'text/plain'}; charset=utf-8`}); res.end(value?.[1] || 'Not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const screenshots = path.join(root, 'test-results', manifest.id); fs.mkdirSync(screenshots, {recursive: true});
  try {
    for (const engine of [chromium, firefox]) {
      const browser = await engine.launch();
      try {
        for (const business of Object.keys(manifest.packages)) {
          const context = await browser.newContext({viewport: {width: 1600, height: 960}});
          const errors = [], external = [];
          await context.route('**/*', route => {
            if (!route.request().url().startsWith(base)) {external.push(route.request().url()); return route.abort();}
            return route.continue();
          });
          const page = await context.newPage(), preview = await context.newPage();
          for (const p of [page, preview]) p.on('pageerror', e => errors.push(e.message));
          await page.goto(`${base}/${business}`);
          const frame = page.frames().find(f => f.url().endsWith('/frame'));
          await frame.waitForFunction(() => window.harness);
          // First update may be resize, not Data. The visual must still load.
          await frame.evaluate(() => window.harness.update(4));
          const app = frame.locator('.cierre-app');
          await expect(app).toHaveAttribute('data-ready', 'true');
          await preview.goto(`${base}/${business}/preview`);
          const reference = preview.locator('body');
          const ready = async () => {await expect(app).toHaveAttribute('data-ready', 'true'); await expect(reference).toHaveAttribute('data-ready', 'true');};
          await ready();
          const currencies = business === 'banco_peru' ? ['MSoles', 'MMCLP'] : ['MMCLP'];
          for (const unit of currencies) {
            if (currencies.length > 1) for (const target of [app, reference]) await target.locator(`[data-currency="${unit}"]`).click();
            for (const month of [manifest.source.cutoff, 1, Math.max(1, manifest.source.cutoff - 1)]) {
              for (const target of [app, reference]) await target.locator('#month').selectOption(String(month));
              await ready();
              // Financial DOM of the SDK must be identical to the independently generated HTML.
              assert.deepEqual(await app.locator('#report-panel [data-metric]').allTextContents(), await reference.locator('#report-panel [data-metric]').allTextContents());
              assert.ok(await app.locator('#report-panel [data-metric]').count() > 10);
            }
          }
          for (const tab of ['opex', 'capex']) {
            for (const target of [app, reference]) await target.locator(`#tab-${tab}`).click();
            await ready();
            assert.equal(await app.locator('#category-table').innerText(), await reference.locator('#category-table').innerText());
            for (const chart of ['monthly-chart', 'variance-chart', 'annual-chart']) {
              const plot = app.locator(`#${chart} .barlayer .point`);
              if (await app.locator(`#${chart}`).count()) {
                await expect(plot).not.toHaveCount(0);
                const traces = node => node.data.map(({name, x, y}) => ({name, x, y}));
                assert.deepEqual(await app.locator(`#${chart}`).evaluate(traces), await reference.locator(`#${chart}`).evaluate(traces));
              }
            }
            for (const target of [app, reference]) await target.locator('[data-sort-key=actualYtd]').click();
            await ready();
            assert.equal(await app.locator('#category-table').innerText(), await reference.locator('#category-table').innerText());
            for (const target of [app, reference]) await target.locator('[data-category]').first().click();
            await ready();
            assert.equal(await app.locator('#detail-focus').innerText(), await reference.locator('#detail-focus').innerText());
          }
          await page.screenshot({path: path.join(screenshots, `${engine.name()}-${business}-desktop.png`)});
          const state = await app.locator('#month').inputValue();
          await page.setViewportSize({width: 390, height: 844});
          await frame.evaluate(() => {window.harness.update(2); window.harness.update(4); window.harness.update(2);});
          await expect(app).toHaveAttribute('data-page', 'capex');
          await expect(app.locator('#month')).toHaveValue(state); await ready();
          await page.screenshot({path: path.join(screenshots, `${engine.name()}-${business}-mobile.png`)});
          assert.deepEqual(await frame.evaluate(() => window.harness.events.filter(e => e === 'fail')), []);
          // A renderer failure during resize must fail, clear the app and permit recovery.
          await app.evaluate(node => {const alert = document.createElement('div'); alert.setAttribute('role', 'alert'); node.append(alert);});
          await frame.evaluate(() => window.harness.update(4));
          await expect(app).toContainText('No se pudo renderizar');
          await frame.evaluate(() => window.harness.update(2));
          await expect(app).toHaveAttribute('data-page', 'summary'); await ready();
          assert.deepEqual(await frame.evaluate(() => window.harness.events.filter(e => e === 'fail')), ['fail']);
          await frame.evaluate(() => window.harness.destroy());
          await expect(frame.locator('.cierre-app')).toHaveCount(0);
          assert.deepEqual(errors, []); assert.deepEqual(external, []);
          await context.close();
          console.log(`${engine.name()}: ${business}, arranque sin DataView, importes iguales al HTML, tabs/mes/moneda/orden/filtro/resize.`);
        }
      } finally {await browser.close();}
    }
  } finally {server.close();}
}
main().catch(e => {console.error(e); process.exitCode = 1;});
