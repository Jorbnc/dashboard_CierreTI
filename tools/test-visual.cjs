/* Browser simulation of the packaged SDK, not a substitute for Desktop/Service QA. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {unzipSync} = require('fflate');
const {chromium, firefox, expect} = require('@playwright/test');
const {fixture, dataView, portfolioFixture} = require('../tests/adapter.test.cjs');
const {scopes} = require('../src/adapter');
const {visual} = require('../pbiviz.json');
const root = path.resolve(__dirname, '..');
const zip = unzipSync(fs.readFileSync(path.join(root, 'dist', `${visual.guid}.${visual.version}.pbiviz`)));
const resource = JSON.parse(Buffer.from(zip[`resources/${visual.guid}.pbiviz.json`]).toString());
const documents = {
  '/': ['text/html', '<!doctype html><html><body style="margin:0"><iframe title="SDK" src="/frame" sandbox="allow-scripts" style="width:100vw;height:100vh;border:0"></iframe></body></html>'],
  '/frame': ['text/html', `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data: blob:; connect-src 'none'"><link rel="stylesheet" href="/visual.css"></head><body style="margin:0"><div id="host1"></div><div id="host2"></div><script src="/host.js"></script><script src="/visual.js"></script><script src="/start.js"></script></body></html>`],
  '/visual.js': ['text/javascript', resource.content.js], '/visual.css': ['text/css', resource.content.css],
  '/host.js': ['text/javascript', `window.powerbi = {};
    window.downloadProbe = {status:0, calls:[], complete:true};
    window.testDownload = {exportStatus:async()=>downloadProbe.pause ? new Promise(resolve=>{downloadProbe.resume=()=>resolve(0);}) : downloadProbe.status, exportVisualsContentExtended:async(content,name,type)=>{
      downloadProbe.calls.push({content,name,type}); return {downloadCompleted:downloadProbe.complete,fileName:name};}};`],
  '/start.js': ['text/javascript', `const events=[], requests=[], instances=[]; const host={downloadService:window.testDownload,eventService:{renderingStarted:()=>events.push('start'),renderingFinished:()=>events.push('finish'),renderingFailed:()=>events.push('fail')},fetchMoreData:a=>{requests.push(a);return window.harness.allowMore;}}; const plugin=powerbi.visuals.plugins[${JSON.stringify(visual.guid)}]; instances.push(plugin.create({element:document.getElementById('host1'),host})); window.harness={events,requests,allowMore:true,update(view,type=2,width=innerWidth,height=innerHeight,index=0){instances[index].update({type,viewport:{width,height},dataViews:view?[view]:[]});},second(){instances.push(plugin.create({element:document.getElementById('host2'),host}));},destroy(){instances.forEach(v=>v.destroy());}};`],
};
async function main() {
  fs.mkdirSync(path.join(root, 'test-results'), {recursive: true});
  const server = http.createServer((req, res) => {
    const entry = documents[req.url];
    res.writeHead(entry ? 200 : 404, {'Content-Type': (entry?.[0] || 'text/plain') + '; charset=utf-8'}); res.end(entry?.[1] || 'Not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const engine of [chromium, firefox]) {
      const browser = await engine.launch();
      try {
        const page = await browser.newPage({viewport: {width: 1600, height: 960}});
        const errors = [], requests = [];
        page.on('pageerror', e => {errors.push(e.message); console.error(e.message);}); page.on('request', r => requests.push(r.url()));
        page.on('console', msg => {if (msg.type() === 'error') console.error(msg.text());});
        const base = `http://127.0.0.1:${server.address().port}`;
        await page.goto(base);
        const frame = page.frames().find(f => f.url().endsWith('/frame'));
        await frame.waitForFunction(() => window.harness);
        const app = frame.locator('#host1 .cierre-app');
        const ready = () => expect(app).toHaveAttribute('data-ready', 'true');
        const update = async view => {
          const before = await frame.evaluate(() => window.harness.events.filter(e => e === 'finish' || e === 'fail').length);
          await frame.evaluate(data => window.harness.update(data), view);
          await frame.waitForFunction(count => window.harness.events.filter(e => e === 'finish' || e === 'fail').length > count, before);
        };
        const checkSourceBadge = async () => {
          await expect(app.getByText(/^Fuente XLSX:/)).toHaveCount(0);
          await expect(app.locator('#unit-label, .page-heading')).toHaveCount(0);
        };
        const checkDetailTitles = async () => {
          await expect(app.locator('#execution-panel h3')).toHaveText('Ejecución y desviación');
          await expect(app.locator('#annual-panel h3')).toHaveText('Ppto FY vs Forecast FY vs Real acumulado');
        };
        for (const business of ['banco_peru', 'banco_chile', 'retail_chile', 'retail_peru']) {
          await update(dataView(fixture(business)));
          await expect(app).toHaveAttribute('data-currency', scopes[business].default); await ready();
          await checkSourceBadge();
          await expect(app.locator('[role=tab]')).toHaveCount(3);
          const download = app.locator('#download-pdf');
          if (business.startsWith('retail')) await expect(download).toBeHidden();
          if (business === 'banco_peru') {
            await frame.evaluate(()=>{downloadProbe.status=3;});
            await download.click();
            await expect(app.locator('#pdf-status')).toContainText('organización');
            assert.equal(await frame.evaluate(()=>downloadProbe.calls.length),0);
            await frame.evaluate(()=>{downloadProbe.pause=true;});
            await download.click();
            await app.locator('#tab-opex').click(); await ready();
            await frame.evaluate(()=>{downloadProbe.pause=false; downloadProbe.resume();});
            await expect(app.locator('#pdf-status')).toContainText('La vista cambió');
            assert.equal(await frame.evaluate(()=>downloadProbe.calls.length),0);
            await app.locator('#tab-summary').click(); await ready();
            await frame.evaluate(()=>{downloadProbe.status=0; downloadProbe.complete=false;});
            await download.evaluate(button=>{button.click(); button.click();});
            await expect(app.locator('#pdf-status')).toContainText('No se completó');
            assert.equal(await frame.evaluate(()=>downloadProbe.calls.length),1);
            await frame.evaluate(()=>{downloadProbe.complete=true; downloadProbe.calls=[];});
          }
          await app.locator('#month').click(); await app.locator('[data-month-option="3"]').click(); await ready();
          await checkSourceBadge();
          await expect(app.locator('[data-scope=Total][data-kpi="0"] [data-metric=actual-month]')).toHaveText(`${business === 'retail_chile' ? '9' : '6'}${scopes[business].default}`);
          await expect(app.locator('.fixed-currency:visible, .currency button[aria-pressed=true]:visible')).toHaveText(scopes[business].default);
          for (const tab of ['opex', 'capex']) {
            await app.locator(`#tab-${tab}`).click(); await ready();
            await checkSourceBadge();
            await checkDetailTitles();
            await expect(app.locator('#monthly-chart .barlayer .point')).not.toHaveCount(0);
            await expect(app.locator('#monthly-chart .annotation-text')).toContainText('REAL 2030: 3');
            await expect(app.locator('#monthly-chart .annotation-text')).toContainText('PPTO 2030: 3');
            await expect(app.locator('#annual-chart .barlayer .point')).not.toHaveCount(0);
            await app.locator('[data-sort-key=actualYtd]').click(); await ready();
            await app.locator('[data-category]').first().click(); await ready();
            await expect(app.locator('#detail-focus')).toContainText('Ejemplo');
            await checkDetailTitles();
          }
          if (business === 'banco_peru') {
            await app.locator('[data-currency=MMCLP]').click(); await ready();
            await update(dataView(fixture(business))); await ready();
            await expect(app).toHaveAttribute('data-page', 'capex');
            await expect(app.locator('#month')).toHaveAttribute('value', '3');
            await expect(app).toHaveAttribute('data-currency', 'MMCLP');
            await checkSourceBadge();
            await checkDetailTitles();
            await page.screenshot({path: path.join(root, `test-results/${engine.name()}-peru-desktop.png`)});
          }
          if (business.startsWith('banco')) {
            await download.click();
            await expect(download).toBeEnabled({timeout:15000});
            await expect(app.locator('#pdf-status')).toHaveText('');
            const calls = await frame.evaluate(()=>downloadProbe.calls.splice(0));
            assert.equal(calls.length,1);
            const {content,name,type} = calls[0];
            assert.equal(name,business+'_CAPEX_2030-03_MMCLP.pdf');
            assert.equal(type,'base64');
            const doc = await require('pdf-lib').PDFDocument.load(Buffer.from(content,'base64'));
            assert.equal(doc.getPageCount(),1);
            assert.equal(doc.getPages()[0].getWidth(),(await app.evaluate(el=>el.clientWidth))*.75);
            assert.match(doc.getSubject(),/Ejemplo/);
          }
        }
        for (const key of ['bancos','retail','corp_ti']) {
          await update(dataView(portfolioFixture(key))); await ready();
          await checkSourceBadge();
          const logo = app.locator('.masthead .brand').getByRole('img');
          await expect(app.locator('.scope-bar + .navigation')).toHaveCount(1);
          if (key === 'corp_ti') await expect(logo).toHaveCount(2);
          for (const button of await app.locator('.scope-bar button').all()) {
            await button.click(); await ready();
            const scope = await button.getAttribute('data-scope');
            await expect(app.locator('.identity h1')).toHaveText(await button.innerText());
            if (scope === 'corp_ti') await expect(logo).toHaveCount(2);
            else {
              const bank = scope.startsWith('banco');
              await expect(logo).toHaveCount(1);
              await expect(logo).toHaveAccessibleName(bank ? 'Banco Ripley' : 'Ripley');
              const img = fs.readFileSync(path.join(root, 'src/shared/branding', bank ? 'banco_ripley.png' : 'retail_ripley.png'));
              assert.equal(await logo.getAttribute('src'), 'data:image/png;base64,' + img.toString('base64'));
            }
            const expected = {corp_ti:45,bancos:20,retail:25,banco_chile:10,banco_peru:10,retail_chile:15,retail_peru:10}[scope];
            await expect(app.locator('[data-kpi="0"][data-scope=Total] [data-metric=actual-month]')).toHaveText(expected+'MMCLP');
            if (scope === 'banco_peru') {
              await app.getByRole('button',{name:'MSoles',exact:true}).click(); await ready();
              await expect(app.locator('[data-kpi="0"][data-scope=Total] [data-metric=actual-month]')).toHaveText(expected+'MSoles');
            } else await expect(app.getByRole('button',{name:'MSoles',exact:true})).toHaveCount(0);
            await expect(app.locator('#download-pdf')).toHaveCount(0);
          }
          if (key === 'corp_ti') {
            await app.locator('button[data-scope=banco_peru]').click(); await ready();
            await app.locator('[data-currency=MSoles]').click(); await ready();
            await update(dataView(portfolioFixture(key))); await ready();
            await expect(logo).toHaveAccessibleName('Banco Ripley');
            await expect(app.locator('.identity h1')).toHaveText('Banco Perú');
            await expect(app).toHaveAttribute('data-currency','MSoles');
            await app.locator('button[data-scope=corp_ti]').click(); await ready();
            await expect(logo).toHaveCount(2);
            await expect(app).toHaveAttribute('data-currency','MMCLP');
          }
          for (const tab of ['opex','capex']) {
            await app.locator('#tab-'+tab).click(); await ready();
            await checkDetailTitles(); await checkSourceBadge();
          }
          await expect(app.locator('#monthly-chart .barlayer .point')).not.toHaveCount(0);
        }
        await page.setViewportSize({width: 390, height: 844});
        await frame.evaluate(() => window.harness.update(null, 4)); await ready();
        await expect(app).toHaveAttribute('data-page', 'capex');
        await page.screenshot({path: path.join(root, `test-results/${engine.name()}-mobile.png`)});
        await frame.evaluate(() => window.harness.second());
        await frame.evaluate(view => window.harness.update(view, 2, 390, 844, 1), dataView(fixture('banco_chile')));
        await expect(frame.locator('#host2 .cierre-app')).toHaveAttribute('data-ready', 'true');
        await expect(app).toHaveAttribute('data-page', 'capex');
        await expect(frame.locator('#host2 .cierre-app')).toHaveAttribute('data-page', 'summary');
        assert.deepEqual(await frame.evaluate(() => window.harness.events.filter(e => e === 'fail')), []);
        const hostile = fixture();
        hostile.filter(r => r.level === 'category').forEach(r => {r.label = '<img src=x onerror="window.compromised=true">';});
        await update(dataView(hostile));
        await app.locator('#tab-opex').click(); await ready();
        await expect(app.locator('#category-table img')).toHaveCount(0);
        assert.equal(await frame.evaluate(() => !!window.compromised), false);
        await update(dataView(fixture().slice(1)));
        await expect(app).toContainText('Entrega incompleta');
        await expect(app.locator('.kpi-card')).toHaveCount(0);
        const partial = dataView(fixture()); partial.metadata.segment = {};
        await frame.evaluate(view => window.harness.update(view), partial);
        await expect(app).toContainText('Recibiendo');
        assert.deepEqual(await frame.evaluate(() => window.harness.requests), [true]);
        await frame.evaluate(() => {window.harness.allowMore = false;});
        await frame.evaluate(view => window.harness.update(view), partial);
        await expect(app).toContainText('Entrega incompleta');
        await frame.evaluate(() => window.harness.destroy());
        await expect(frame.locator('.cierre-app')).toHaveCount(0);
        assert.deepEqual(errors, []);
        assert.deepEqual(requests.filter(url => !url.startsWith(base) && !url.startsWith('data:image/')), []);
        console.log(`${engine.name()}: paquete real, 4 negocios, tabs, moneda, mes, resize, dos instancias y rechazos verificados.`);
      } finally {await browser.close();}
    }
  } finally {server.close();}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
