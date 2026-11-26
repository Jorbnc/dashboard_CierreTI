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
    window.testPalette = {isHighContrast:false, foreground:{value:'#fff'}, background:{value:'#151515'}, foregroundSelected:{value:'#ffff00'}};
    window.downloadAccesses = 0;`],
  '/start.js': ['text/javascript', `const events=[], requests=[], instances=[]; const host={colorPalette:window.testPalette,get downloadService(){window.downloadAccesses++;throw Error('Descarga no habilitada');},eventService:{renderingStarted:()=>events.push('start'),renderingFinished:()=>events.push('finish'),renderingFailed:()=>events.push('fail')},fetchMoreData:a=>{requests.push(a);return window.harness.allowMore;}}; const plugin=powerbi.visuals.plugins[${JSON.stringify(visual.guid)}]; instances.push(plugin.create({element:document.getElementById('host1'),host})); window.harness={events,requests,allowMore:true,update(view,type=2,width=innerWidth,height=innerHeight,index=0){instances[index].update({type,viewport:{width,height},dataViews:view?[view]:[]});},second(){instances.push(plugin.create({element:document.getElementById('host2'),host}));},destroy(){instances.forEach(v=>v.destroy());}};`],
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
        const checkLogoSizes = async () => {
          const logos = app.locator('.masthead .brand').getByRole('img');
          const bankSize = (await app.getAttribute('data-brand')) === 'corp' ? 72 : 80;
          for (const img of await logos.all()) {
            const bank = await img.getAttribute('alt') === 'Banco Ripley';
            const box = await img.boundingBox();
            assert.equal(box.width, bank ? bankSize : 96);
            assert.ok(Math.abs(box.height - (bank ? bankSize : 96 * 1116 / 3000)) < 0.05);
          }
        };
        const checkDetailTitles = async () => {
          await expect(app.locator('#execution-panel h3')).toHaveText('Ejecución y desviación');
          await expect(app.locator('#annual-panel h3')).toHaveText('PPTO FY vs Forecast FY vs Real acumulado');
          const brand = await app.getAttribute('data-brand'), bank = brand === 'bank', retail = brand === 'retail';
          const chartColors = node => node.data.filter(t => t.type === 'bar').map(t => t.marker.color);
          const monthly = bank ? ['#523178','#a58bc9'] : retail ? ['#333333','#6a6a6a'] : ['#414146','#939198'];
          const swatches = bank ? ['rgb(165, 139, 201)','rgb(82, 49, 120)'] : retail ? ['rgb(106, 106, 106)','rgb(51, 51, 51)'] : ['rgb(147, 145, 152)','rgb(65, 65, 70)'];
          assert.deepEqual(await app.locator('#annual-chart').evaluate(chartColors), ['#ffb81c',monthly[1],monthly[0]]);
          assert.deepEqual(await app.locator('#annual-legend .swatch').evaluateAll(keys=>keys.map(k=>getComputedStyle(k).backgroundColor)),
            ['rgb(255, 184, 28)',...swatches]);
          assert.deepEqual(await app.locator('#monthly-chart').evaluate(chartColors), monthly);
          const forecastKey = app.locator('#monthly-legend .legend > span').filter({hasText: /^Forecast /i}).locator('.swatch');
          await expect(forecastKey).toHaveCSS('background-color', swatches[0]);
          for (const name of ['monthly','annual']) {
            const plot = app.locator('#'+name+'-chart');
            assert.deepEqual(await plot.evaluate(el=>el.data.filter(t=>t.type==='bar').map(t=>t.marker.pattern?.shape || '')),
              name === 'monthly' ? ['','/'] : ['','/','']);
            await expect(app.locator('#'+name+'-legend .forecast-hatch')).toHaveCSS('background-image',/repeating-linear-gradient/);
          }
          await expect(app.locator('#category-table thead th').first()).toHaveCSS('background-color',retail ? 'rgb(241, 241, 241)' : swatches[1]);
          await expect(app.locator('#category-table tfoot td').first()).toHaveCSS('background-color',bank ? 'rgb(241, 236, 247)' : retail ? 'rgb(225, 225, 225)' : 'rgb(234, 232, 235)');
        };
        for (const business of ['banco_peru', 'banco_chile', 'retail_chile', 'retail_peru']) {
          await update(dataView(fixture(business)));
          await expect(app).toHaveAttribute('data-currency', scopes[business].default); await ready();
          await checkLogoSizes();
          await checkSourceBadge();
          await expect(app.locator('[role=tab]')).toHaveCount(3);
          const annual = app.locator('[data-scope=Total] [data-metric=annual-yoy]');
          const hasPrior = business.startsWith('banco');
          await expect(annual).toHaveText(hasPrior ? '+78 (+100,00%)' : 'N/D');
          await expect(annual).toHaveClass(hasPrior ? 'delta bad' : 'delta neutral');
          await expect(app.locator('[data-kpi="2"] .annual-history .delta-reference').first()).toHaveText('vs 2029 REAL');
          await expect(app.locator('#download-pdf,#pdf-status,footer')).toHaveCount(0);
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
        }
        for (const key of ['bancos','retail','corp_ti']) {
          await update(dataView(portfolioFixture(key))); await ready();
          await checkSourceBadge();
          const retail = key === 'retail';
          const accent = key === 'bancos' ? 'rgb(82, 49, 120)' : retail ? 'rgb(253, 0, 140)' : 'rgb(34, 30, 32)';
          const ink = retail ? 'rgb(51, 51, 51)' : accent;
          const header = app.locator('.column-heads > div').first();
          await expect(header).toHaveCSS('background-color', retail ? 'rgb(219, 219, 219)' : accent);
          await expect(header).toHaveCSS('border-radius', '8px');
          await expect(app.locator('.scope-bar [aria-pressed=false]').first()).toHaveCSS('color', ink);
          await expect(app.locator('.tabs [aria-selected=false] svg').first()).toHaveCSS('stroke', ink);
          const logo = app.locator('.masthead .brand').getByRole('img');
          await expect(app.locator('.scope-bar + .navigation')).toHaveCount(1);
          if (key === 'corp_ti') {
            await expect(logo).toHaveCount(2);
            const {PNG} = require('playwright-core/lib/utilsBundle');
            const png = PNG.sync.read(await app.locator('.brand .bank-logo').screenshot());
            const rgb = (x,y) => [...png.data.subarray(4*(y*png.width+x),4*(y*png.width+x)+3)];
            assert.deepEqual(rgb(10,10), [34,30,32], 'the original purple tile must not appear');
            assert.ok(rgb(38,54)[0] > 240 && rgb(38,54)[1] > 150, 'bank underline must remain visible');
          }
          for (const button of await app.locator('.scope-bar button').all()) {
            await button.click(); await ready();
            const scope = await button.getAttribute('data-scope');
            await expect(button).toHaveCSS('background-color', accent);
            const actual = app.locator('[data-scope=Total] [data-metric=actual-month]');
            await expect(actual.locator('.kpi-number')).toHaveCSS('color', ink);
            await expect(actual.locator('small')).toHaveCSS('color', retail ? 'rgb(86, 86, 86)' : 'rgb(110, 102, 128)');
            await checkLogoSizes();
            const country = {banco_chile:'Chile', banco_peru:'Perú', retail_chile:'Chile', retail_peru:'Perú'}[scope];
            const flags = app.locator('.identity').getByRole('img');
            await expect(app.locator('.identity h1')).toHaveText(scope === 'corp_ti' ? 'Ripley Corp'
              : scope.startsWith('banco') ? 'Banco Ripley' : 'Retail');
            const countries = country ? [country] : ['Chile','Perú'];
            await expect(flags).toHaveCount(countries.length);
            for (const [i, country] of countries.entries()) {
              const flag = flags.nth(i);
              await expect(flag).toHaveAccessibleName(country);
              const svg = fs.readFileSync(path.join(root,'src/shared/branding',country === 'Chile' ? 'chile.svg' : 'peru.svg'));
              await expect(flag).toHaveAttribute('src','data:image/svg+xml;base64,'+svg.toString('base64'));
            }
            if (scope === 'corp_ti') await expect(logo).toHaveCount(2);
            else {
              const bank = scope.startsWith('banco');
              await expect(logo).toHaveCount(1);
              await expect(logo).toHaveAccessibleName(bank ? 'Banco Ripley' : 'Ripley');
              const img = fs.readFileSync(path.join(root, 'src/shared/branding', bank ? 'banco_ripley.png' : 'retail_ripley.png'));
              assert.equal(await logo.getAttribute('src'), 'data:image/png;base64,' + img.toString('base64'));
            }
            const expected = {corp_ti:45,bancos:20,retail:25,banco_chile:10,banco_peru:10,retail_chile:15,retail_peru:10}[scope];
            await expect(app.locator('[data-scope=Total] [data-metric=annual-yoy]')).toHaveText(
              scope==='bancos' ? '+156 (+100,00%)' : scope.startsWith('banco_') ? '+78 (+100,00%)' : 'N/D');
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
            await expect(app.locator('.identity h1')).toHaveText('Banco Ripley');
            await expect(app.locator('.identity').getByRole('img')).toHaveAccessibleName('Perú');
            await expect(app).toHaveAttribute('data-currency','MSoles');
            await app.locator('button[data-scope=corp_ti]').click(); await ready();
            await expect(logo).toHaveCount(2);
            await expect(app.locator('.identity').getByRole('img')).toHaveCount(2);
            await expect(app).toHaveAttribute('data-currency','MMCLP');
          }
          for (const tab of ['opex','capex']) {
            await app.locator('#tab-'+tab).click(); await ready();
            await checkDetailTitles(); await checkSourceBadge();
            await expect(app.locator('#tab-'+tab)).toHaveCSS('background-color', accent);
            for (const title of await app.locator('.detail-grid h3').all()) await expect(title).toHaveCSS('color', retail ? 'rgb(34, 30, 32)' : accent);
          }
          await expect(app.locator('#monthly-chart .barlayer .point')).not.toHaveCount(0);
        }
        for (const active of [true,false]) {
          await frame.evaluate(active => {testPalette.isHighContrast=active; harness.update(null,16);}, active);
          await expect(app).toHaveAttribute('data-contrast',active ? 'high' : 'normal'); await ready();
          await expect(app).toHaveAttribute('data-page','capex');
          if (active) {
            const chart = app.locator('#monthly-chart');
            assert.deepEqual(await chart.evaluate(el=>[el.layout.paper_bgcolor,el.data[1].marker.pattern.shape,el.data[2].line.color]), ['#151515','/','#fff']);
            await expect(app.locator('#tab-capex')).toHaveCSS('text-decoration-line','underline');
          } else await checkDetailTitles();
        }
        await page.setViewportSize({width: 390, height: 844});
        await frame.evaluate(() => window.harness.update(null, 4)); await ready();
        await expect(app).toHaveAttribute('data-page', 'capex');
        await checkLogoSizes();
        await page.screenshot({path: path.join(root, `test-results/${engine.name()}-mobile.png`)});
        await frame.evaluate(() => window.harness.second());
        await frame.evaluate(view => window.harness.update(view, 2, 390, 844, 1), dataView(fixture('banco_chile')));
        await expect(frame.locator('#host2 .cierre-app')).toHaveAttribute('data-ready', 'true');
        await expect(app).toHaveAttribute('data-page', 'capex');
        await expect(frame.locator('#host2 .cierre-app')).toHaveAttribute('data-page', 'summary');
        assert.deepEqual(await frame.evaluate(() => window.harness.events.filter(e => e === 'fail')), []);
        for (const [factor,expected,tone] of [[0,'+156 (N/D)','neutral'],[-1,'+312 (N/D)','neutral'],[1,'0 (0,00%)','neutral'],[1.00001,'0 (0,00%)','neutral'],[2,'-156 (-50,00%)','good']]) {
          const rows = fixture('banco_chile');
          rows.forEach(r=>{if(r.prior!==null) r.prior=factor*(r.actual??r.forecast);});
          await update(dataView(rows)); await ready(); await app.locator('#tab-summary').click(); await ready();
          const chip=app.locator('[data-scope=Total] [data-metric=annual-yoy]');
          await expect(chip).toHaveText(expected); await expect(chip).toHaveClass('delta '+tone);
        }
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
        assert.equal(await frame.evaluate(() => window.downloadAccesses),0);
        assert.deepEqual(errors, []);
        assert.deepEqual(requests.filter(url => !url.startsWith(base) && !url.startsWith('data:image/')), []);
        console.log(`${engine.name()}: paquete real, 4 negocios, tabs, moneda, mes, resize, dos instancias y rechazos verificados.`);
      } finally {await browser.close();}
    }
  } finally {server.close();}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
