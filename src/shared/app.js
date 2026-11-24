/* eslint-disable powerbi-visuals/no-inner-outer-html -- Static templates; external labels pass through escape(). */
'use strict';
(function expose(factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else globalThis.mountCierreDashboard = factory;
})(function mountCierreDashboard(root, data, dependencies, initialState = {}) {
  const {model: CierreModel, classic: CierreClassic, proposal: CierreProposal, icons: lucide, plotly} = dependencies;
  const owner = root.ownerDocument;
  const lifetime = new AbortController();
  const listen = (target, name, callback, capture = false) => target.addEventListener(name, callback, {capture, signal: lifetime.signal});
  // An instance-local DOM boundary supports standalone pages and isolated Power BI visuals.
  const document = {
    body: root, documentElement: root,
    get activeElement() { return root.getRootNode().activeElement || owner.activeElement; },
    getElementById: id => root.querySelector(`[id="${id}"]`),
    querySelector: selector => root.querySelector(selector),
    querySelectorAll: selector => root.querySelectorAll(selector),
    createElement: name => owner.createElement(name),
    addEventListener: (name, callback) => listen(root, name, callback),
  };
  const $ = id => document.getElementById(id);
  const Plotly = {...plotly};
  for (const method of ['react', 'restyle', 'relayout', 'purge']) Plotly[method] = (node, ...args) => plotly[method](typeof node === 'string' ? $(node) : node, ...args);
  const width = () => root.clientWidth || innerWidth;
  const model = CierreModel;
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const closure = months[data.cutoff - 1];
  const state = {page: 'summary', currency: data.default_currency || 'MSoles', month: data.cutoff, category: null, ranking: 'ytd', matrix: 'actual', sortKey: 'category', sortDirection: 'asc'};
  Object.assign(state, initialState);
  const scopeNames = {bancos: 'Bancos', retail: 'Retail', corp_ti: data.entity, banco_chile: 'Banco Chile',
    banco_peru: 'Banco Perú', retail_chile: 'Retail Chile', retail_peru: 'Retail Perú'};
  const scopeLabel = key => key === data.business && key !== 'corp_ti' ? 'Total ' + scopeNames[key] : scopeNames[key];
  let scopeBar;
  let currencyGroup, fixedCurrency;
  const scopeLogos = root.querySelectorAll('.brand [data-scope-logo]');
  if (data.choices) {
    if (!Object.hasOwn(data.choices, state.scope)) state.scope = data.business;
    data.currencies = model.portfolioCurrencies(data, state.scope);
    fixedCurrency = root.querySelector('.fixed-currency');
    currencyGroup = owner.createElement('div');
    currencyGroup.className = 'currency';
    currencyGroup.setAttribute('role', 'group'); currencyGroup.setAttribute('aria-label', 'Moneda');
    const units = new Set([data.default_currency, ...Object.values(data.members).flatMap(m => Object.keys(m.currencies))]);
    for (const unit of units) {
      const button = owner.createElement('button');
      button.type = 'button'; button.dataset.currency = unit; button.textContent = unit;
      currencyGroup.append(button);
    }
    if (units.size > 1) {
      const slot = owner.createElement('div');
      slot.className = 'scope-currency';
      fixedCurrency.replaceWith(slot);
      slot.append(fixedCurrency, currencyGroup);
    } else fixedCurrency.after(currencyGroup);
    scopeBar = owner.createElement('div');
    scopeBar.className = 'scope-bar';
    scopeBar.setAttribute('role', 'group'); scopeBar.setAttribute('aria-label', 'Alcance del reporte');
    const groups = Object.keys(data.choices).filter(k => k !== data.business && !Object.hasOwn(data.members, k));
    for (const key of new Set([data.business, ...groups.flatMap(k => [k, ...data.choices[k]]), ...data.choices[data.business]])) {
      const button = owner.createElement('button');
      button.type = 'button'; button.dataset.scope = key;
      button.textContent = scopeLabel(key);
      scopeBar.append(button);
      listen(button, 'click', () => requestRender({scope: key, category: null}, true));
    }
    document.querySelector('.navigation').before(scopeBar);
  }
  state.month = Math.max(1, Math.min(data.cutoff, state.month));
  if (!data.currencies[state.currency]) state.currency = data.default_currency;
  if (state.category && !data.currencies[state.currency].types[state.page === 'opex' ? 'Opex' : 'Capex']?.rows.some(row => row.category === state.category)) state.category = null;
  const theme = getComputedStyle(document.documentElement);
  const color = name => theme.getPropertyValue(`--${name}`).trim();
  const forced = window.matchMedia('(forced-colors: active)');
  const colors = {};
  let paletteKey;
  function syncPalette() {
    let palette = dependencies.highContrast?.();
    if (!palette && forced.matches) {
      const probe = owner.createElement('span');
      probe.style.forcedColorAdjust = 'none';
      root.append(probe);
      const system = key => {probe.style.color = key; return getComputedStyle(probe).color;};
      palette = {fg: system('CanvasText'), bg: system('Canvas'), selected: system('Highlight')};
      probe.remove();
    }
    const key = JSON.stringify(palette || null);
    if (key === paletteKey) return false;
    paletteKey = key;
    root.dataset.contrast = palette ? 'high' : 'normal';
    for (const role of ['fg', 'bg', 'selected']) {
      if (palette) root.style.setProperty('--hc-' + role, palette[role]);
      else root.style.removeProperty('--hc-' + role);
    }
    Object.assign(colors, {actual: color('actual'), forecast: color('forecast'), budget: color('budget'),
      prior: color(['proposal','classic'].includes(root.dataset.summaryLayout) ? 'prior' : 'actual'), good: color('green'), bad: color('red')});
    return true;
  }
  syncPalette();
  const thousands = new Intl.NumberFormat('es-CL', {maximumFractionDigits: 0, useGrouping: true});
  const amountDecimals = () => 0;
  const amountThreshold = () => 0.5 * 10 ** -amountDecimals();
  const percent = new Intl.NumberFormat('es-CL', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const scenarioKeys = {REAL: 'actual', FCST: 'forecast', PPTO: 'budget'};
  const scenarioValue = (key, text) => `<span class="scenario-text scenario-${key}">${escape(text)}</span>`;
  const scenarioText = text => escape(text).replace(/\b(REAL|FCST|PPTO)\b/g, word => scenarioValue(scenarioKeys[word], word));
  const fmt = value => !Number.isFinite(value) ? 'N/D' : thousands.format(Math.abs(value) < amountThreshold() ? 0 : value);
  const pct = value => !Number.isFinite(value) ? 'N/D' : `${percent.format(Math.abs(value) < 0.005 ? 0 : value)}%`;
  const signed = (value, format = fmt) => !Number.isFinite(value) ? 'N/D' : `${value > 0 && Math.abs(value) >= (format === pct ? 0.005 : amountThreshold()) ? '+' : ''}${format(value)}`;
  const isProposal = document.body.dataset.summaryLayout === 'proposal';
  const signClass = (value, decimals = amountDecimals()) => isProposal ? CierreProposal.visibleSign(value, decimals)
    : value > 0.0000001 ? 'bad' : value < -0.0000001 ? 'good' : 'neutral';
  const selected = () => data.currencies[state.currency];
  const kind = () => state.page === 'opex' ? 'Opex' : 'Capex';
  const month = () => months[state.month - 1];
  const metrics = series => model.metrics(series, state.month, data.cutoff);
  const proposal = isProposal ? CierreProposal.create({data, state, model, month, months, closure, fmt, pct, signed, escape}) : null;
  const integrated = document.body.dataset.summaryLayout === 'integrated';
  const desired = {...state};
  let rendering = false;
  let pending = false;
  let rebuildPending = false;
  let destroyed = false;
  let renderDone = Promise.resolve();
  let finishRender;
  const pdfButton = $('download-pdf');
  const offerPDF = isProposal && ['banco_chile', 'banco_peru'].includes(data.business) && dependencies.delivery && dependencies.pdf;
  let viewRevision = 0, exporting = false;
  function syncPdfButton() {
    if (!offerPDF) return;
    pdfButton.hidden = !offerPDF;
    pdfButton.disabled = !offerPDF || exporting || rendering || document.body.dataset.ready !== 'true' || !!$('report-panel').querySelector('[role=alert]');
    pdfButton.setAttribute('aria-busy', String(exporting));
  }
  if (!offerPDF) pdfButton.remove();
  else listen(pdfButton, 'click', async () => {
    if (pdfButton.disabled || !offerPDF) return;
    const revision = viewRevision;
    const current = () => !destroyed && revision === viewRevision;
    const status = $('pdf-status');
    let submitted = false;
    exporting = true;
    syncPdfButton();
    status.textContent = '';
    try {
      const reason = await dependencies.delivery.check();
      if (!current()) return;
      if (reason) {status.textContent = reason; return;}
      const {bytes, filename} = await dependencies.pdf.create(root, dependencies.pdfLib, {
        business: data.business, entity: data.entity, page: state.page, year: data.year, month: state.month, currency: state.currency,
      }, current);
      if (!current()) return;
      submitted = true;
      const completed = await dependencies.delivery.save(bytes, filename);
      if (!destroyed && !completed) status.textContent = 'No se completó la descarga del PDF.';
    } catch {
      if (current()) status.textContent = 'No se pudo descargar la vista en PDF. Inténtalo de nuevo.';
    } finally {
      exporting = false;
      if (!destroyed) {
        if (!submitted && !current()) status.textContent = 'La vista cambió. Vuelve a descargar el PDF de la selección actual.';
        syncPdfButton();
      }
    }
  });
  let helpTrigger = null;
  let helpAnchor = null;
  let helpPinned = false;
  let helpTimer;

  function closeHelp() {
    clearTimeout(helpTimer);
    if (helpTrigger) {
      helpTrigger.setAttribute('aria-expanded', 'false');
      helpTrigger.removeAttribute('aria-describedby');
    }
    helpTrigger = null;
    helpAnchor = null;
    helpPinned = false;
    $('calculation-tooltip').hidden = true;
  }

  function showHelp(trigger, pinned = false) {
    closeHelp();
    const tooltip = $('calculation-tooltip');
    tooltip.innerHTML = $(trigger.dataset.help).innerHTML;
    tooltip.style.maxHeight = '';
    tooltip.hidden = false;
    helpTrigger = trigger;
    helpPinned = pinned;
    trigger.setAttribute('aria-describedby', tooltip.id);
    trigger.setAttribute('aria-expanded', 'true');
    // The tooltip lives outside the cards to avoid clipping by layout containers.
    const anchor = trigger.getBoundingClientRect();
    helpAnchor = anchor;
    const box = tooltip.getBoundingClientRect();
    const below = innerHeight - anchor.bottom - 20;
    const above = anchor.top - 20;
    const placeBelow = box.height <= below || below >= above;
    tooltip.style.maxHeight = `${Math.max(0, placeBelow ? below : above)}px`;
    const height = tooltip.getBoundingClientRect().height;
    const top = placeBelow ? anchor.bottom + 8 : anchor.top - height - 8;
    tooltip.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(top, innerHeight - height - 12))}px`;
  }

  function helpButton(id, label, content) {
    return `<button type="button" class="help-button" data-help="${id}" aria-label="${escape(label)}" aria-expanded="false"><i data-lucide="info"></i></button><template id="${id}">${content}</template>`;
  }

  function calculationHelp(scope, label, m, annual = false) {
    const amount = (key, n) => scenarioValue(key, `${fmt(n)} ${state.currency}`);
    const term = (text, key, n) => `<p>${scenarioText(text)}: <b>${amount(key, n)}</b></p>`;
    const ratio = (n, result) => m.budgetYear > 0
      ? `<p class="tooltip-formula">${fmt(n)} / ${fmt(m.budgetYear)} × 100 ≈ <b>${pct(result)}</b></p>`
      : '<p class="tooltip-formula">N/D: el PPTO anual no es positivo.</p>';
    const title = `${annual ? 'FCST anual y saldo' : 'Uso y avance esperado del PPTO'} · ${label}`;
    const content = annual
      ? `${term(`REAL enero a ${closure.toLowerCase()} ${data.year}`, 'actual', m.actualAtCutoff)}
        ${term(`FCST restante${data.cutoff < 12 ? ` (${months[data.cutoff].toLowerCase()} a diciembre)` : ' (sin meses pendientes)'}`, 'forecast', m.future)}
        <p class="tooltip-section">${scenarioText('FCST anual = REAL al cierre fuente + FCST restante')}</p>
        <p class="tooltip-formula">${fmt(m.actualAtCutoff)} + ${fmt(m.future)} ≈ <b>${amount('forecast', m.forecastYear)}</b></p>
        <p class="tooltip-section">${scenarioText('Saldo = PPTO anual − REAL al cierre fuente')}</p>
        <p class="tooltip-formula">${fmt(m.budgetYear)} − ${fmt(m.actualAtCutoff)} ≈ <b>${amount('budget', m.available)}</b></p>`
      : `<p class="tooltip-section">${scenarioText('Uso = REAL acumulado / PPTO anual × 100')}</p>${ratio(m.actualYtd, m.usage)}
        ${term(`PPTO acumulado enero a ${month().toLowerCase()}`, 'budget', m.budgetYtd)}
        <p class="tooltip-section">${scenarioText('Esperado = PPTO acumulado / PPTO anual × 100')}</p>${ratio(m.budgetYtd, m.expected)}`;
    return helpButton(`help-${annual ? 'annual' : 'usage'}-${scope}`, `Detalle del cálculo: ${title}`,
      annual ? `<h4>${escape(title)}</h4>${content}<p class="tooltip-note">Importes redondeados; cálculo con precisión completa.</p>` : content + (proposal ? proposal.gapHelp(m) : ''));
  }

  // Coalesce controls while Plotly finishes; never remove an in-flight graph.
  async function requestRender(update = {}, rebuild = false) {
    if (destroyed) return;
    viewRevision++;
    $('pdf-status').textContent = '';
    closeHelp();
    Object.assign(desired, update);
    pending = true;
    rebuildPending ||= rebuild;
    document.body.dataset.ready = 'false';
    syncPdfButton();
    if (rendering) return renderDone;
    rendering = true;
    renderDone = new Promise(resolve => {finishRender = resolve;});
    try {
      while (pending && !destroyed) {
        pending = false;
        const replace = rebuildPending || state.page !== desired.page;
        rebuildPending = false;
        if (scopeBar && state.scope !== desired.scope) data.currencies = model.portfolioCurrencies(data, desired.scope);
        if (!data.currencies[desired.currency]) desired.currency = data.default_currency;
        Object.assign(state, desired);
        if (scopeBar) {
          root.querySelector('.identity h1').textContent = scopeLabel(state.scope);
          for (const button of scopeBar.children) button.setAttribute('aria-pressed', String(button.dataset.scope === state.scope));
          for (const button of currencyGroup.children) button.hidden = !data.currencies[button.dataset.currency];
          currencyGroup.hidden = Object.keys(data.currencies).length === 1;
          fixedCurrency.hidden = !currencyGroup.hidden;
          fixedCurrency.textContent = state.currency;
        }
        if (scopeLogos.length) {
          const brands = new Set(data.choices[state.scope].map(key => data.members[key].brand));
          for (const logo of scopeLogos) logo.toggleAttribute('data-active', brands.has(logo.dataset.scopeLogo));
        }
        await render(replace);
      }
    } catch (error) {
      $('report-panel').innerHTML = '<p role="alert">No se pudo cargar el reporte.</p>';
      console.error(error);
    } finally {
      rendering = false;
      document.body.dataset.ready = 'true';
      syncPdfButton();
      finishRender();
    }
  }

  function segmented(key, options) {
    return `<div class="segmented" role="group" aria-label="${{ranking: 'Período del ranking', matrix: 'Magnitud de la matriz'}[key]}">${options.map(([value, label]) => `<button data-control="${key}" data-value="${value}" aria-pressed="${state[key] === value}">${scenarioText(label)}</button>`).join('')}</div>`;
  }
  function delta(actual, budget) {
    return `<div class="delta-row"><span class="delta ${signClass(actual - budget)}">${signed(actual - budget)} (${signed(model.relative(actual, budget), pct)})</span><span class="delta-reference">vs. ${scenarioValue('budget', 'PPTO')}</span></div>`;
  }
  function legend(items) {
    return `<div class="legend">${items.map(([label, colour, line, dash, role = '']) => `<span><i aria-hidden="true" class="swatch ${role} ${line ? 'line' : ''}${dash === 'dot' ? ' dotted' : ''}" style="--color:${colour}"></i>${scenarioText(label)}</span>`).join('')}</div>`;
  }

  function summaryShell() {
    $('report-panel').innerHTML = `<div id="summary-bands"></div>
      <details id="history-details"><summary>Comparativo con el año anterior</summary><div id="history-content"></div></details>`;
  }

  function integratedSummary(rows) {
    const interval = (start, end) => start === end ? months[start - 1].toLowerCase()
      : `${months[start - 1].slice(0, 3).toLowerCase()}–${months[end - 1].slice(0, 3).toLowerCase()}`;
    const numeric = (key, n, name, css = '') => `<strong class="scenario-text scenario-${key} ${css}" data-metric="${name}">${fmt(n)}</strong>`;
    const clamp = n => Math.max(0, Math.min(100, n ?? 0));
    return `<div class="integrated-grid">${rows.map(([scope, label, series, colour]) => {
      const m = metrics(series);
      const laterActual = model.sum(series.actual.slice(state.month, data.cutoff));
      const fill = clamp(m.usage);
      const onFill = fill >= 34;
      const addition = (key, text, amount, name) => `<div class="closure-input"><i data-lucide="plus" aria-hidden="true"></i><span>${scenarioText(text)}</span>${numeric(key, amount, name)}</div>`;
      const annualHelp = `<p>${scenarioText(`FCST anual = REAL acumulado${state.month < data.cutoff ? ' + REAL posterior conocido' : ''} + FCST pendiente`)}</p>
        <p class="tooltip-formula">${fmt(m.actualYtd)}${state.month < data.cutoff ? ` + ${fmt(laterActual)}` : ''} + ${fmt(m.future)} ≈ ${fmt(m.forecastYear)} ${state.currency}</p>
        <p class="tooltip-section">${scenarioText('Saldo al cierre fuente = PPTO anual − REAL al cierre fuente')}</p>
        <p class="tooltip-formula">${fmt(m.budgetYear)} − ${fmt(m.actualAtCutoff)} ≈ ${fmt(m.available)} ${state.currency}</p>`;
      return `<article class="integrated-card" data-scope="${scope}" style="--scope-color:${colour}">
        <header class="integrated-card-heading"><h3>${label}</h3><span>${state.currency}</span></header>
        <section class="integrated-execution" aria-label="${label}: acumulado">
          <h4>Acumulado <span>${interval(1, state.month)} ${data.year}</span></h4>
          <div class="integrated-metric-pair"><div><div class="metric-caption">${scenarioText('REAL')}</div>${numeric('actual', m.actualYtd, 'actual-ytd', 'integrated-major')}</div>
            <div class="integrated-budget"><div class="metric-caption">${scenarioText('PPTO acumulado')}</div>${numeric('budget', m.budgetYtd, 'budget-ytd', 'integrated-minor')}</div></div>
          <div class="integrated-variance" data-comparison="ytd">${delta(m.actualYtd, m.budgetYtd)}</div>
          <div class="integrated-usage-heading"><span class="label-with-help">Uso anual ${calculationHelp(scope, label, m)}</span><span>${scenarioText('PPTO anual')} ${numeric('budget', m.budgetYear, 'budget-year')}</span></div>
          <div class="integrated-gauge" style="--used:${fill}%;--expected:${clamp(m.expected)}%;--usage-label:${onFill ? fill / 2 : 50}%">
            <div class="gauge-track" role="img" aria-label="${escape(`Uso del PPTO anual: ${pct(m.usage)}; esperado: ${pct(m.expected)}`)}">
              <span class="gauge-fill" ${m.usage === null ? 'hidden' : ''}></span>
              <strong class="gauge-usage ${onFill ? 'on-fill' : ''}" data-metric="usage">${pct(m.usage)}</strong>
              <span class="gauge-target" ${m.expected === null ? 'hidden' : ''} aria-hidden="true"></span>
            </div>
            <div class="gauge-annotation"><span class="gauge-expected">Esperado <strong data-metric="expected">${pct(m.expected)}</strong></span></div>
          </div>
        </section>
        <section class="integrated-closure" aria-label="${label}: cierre anual">
          <h4><span>Cierre anual <span>Fuente ${closure.toLowerCase()}</span></span>${helpButton(`help-integrated-annual-${scope}`, `Cálculo del cierre anual: ${label}`, annualHelp)}</h4>
          <div class="closure-inputs">
            ${state.month < data.cutoff ? addition('actual', `REAL ${interval(state.month + 1, data.cutoff)}`, laterActual, 'known-later') : ''}
            ${addition('forecast', data.cutoff < 12 ? `FCST ${interval(data.cutoff + 1, 12)}` : 'FCST pendiente', m.future, 'future')}
          </div>
          <div class="closure-output"><i data-lucide="corner-down-right" aria-hidden="true"></i><div><div class="metric-caption">${scenarioText(`FCST ${data.year}`)}</div>${numeric('forecast', m.forecastYear, 'forecast-year', 'integrated-major')}</div></div>
          <div class="integrated-variance" data-comparison="annual">${delta(m.forecastYear, m.budgetYear)}</div>
        </section>
        <section class="integrated-month" aria-label="${label}: mes">
          <h4>${month()} <span>${data.year}</span></h4>
          <div class="integrated-metric-pair"><div><div class="metric-caption">${scenarioText('REAL del mes')}</div>${numeric('actual', m.actualMonth, 'actual-month', 'integrated-major')}</div>
            <div class="integrated-budget"><div class="metric-caption">${scenarioText('PPTO del mes')}</div>${numeric('budget', m.budgetMonth, 'budget-month', 'integrated-minor')}</div></div>
          <div class="integrated-variance" data-comparison="month">${delta(m.actualMonth, m.budgetMonth)}</div>
        </section>
      </article>`;
    }).join('')}</div>`;
  }

  function summary() {
    const rows = [['Total', 'Gastos totales', selected().total, color('navy')], ['Opex', 'OPEX', selected().types.Opex.series, color('violet')], ['Capex', 'CAPEX', selected().types.Capex.series, color('magenta')]];
    const value = (n, name, scenario) => `<div class="kpi-value scenario-text scenario-${scenario}" data-metric="${name}">${fmt(n)}<small>${state.currency}</small></div>`;
    const budget = (n, period) => `<div class="kpi-sub">${scenarioValue('budget', `PPTO ${period}`)} ${scenarioValue('budget', fmt(n))}</div>`;
    const inline = (label, n, scenario) => `<div class="inline-metric"><span>${scenarioText(label)}</span>${scenarioValue(scenario, fmt(n))}</div>`;
    const cards = block => rows.map(([scope, label, series, colour]) => {
      const m = metrics(series);
      const content = block === 'execution'
        ? `<div class="metric-block"><div class="kpi-label">${scenarioText('REAL acumulado')}</div>${value(m.actualYtd, 'actual-ytd', 'actual')}${budget(m.budgetYtd, 'acumulado')}${delta(m.actualYtd, m.budgetYtd)}</div>
          <div class="usage-info"><span class="label-with-help"><span>${scenarioText('Uso del PPTO anual')}</span>${calculationHelp(scope, label, m)}</span><strong data-metric="usage">${pct(m.usage)}</strong></div>
          <div class="usage-bar" ${m.usage === null ? 'hidden' : ''} aria-hidden="true"><span class="fill" style="width:${Math.max(0, Math.min(100, m.usage ?? 0))}%"></span><span class="expected" style="left:${Math.max(0, Math.min(99, m.expected ?? 0))}%"></span></div><div class="quiet-note">${scenarioText('Esperado según PPTO acumulado:')} ${scenarioValue('budget', pct(m.expected))}</div>
          <div class="metric-block card-break"><div class="kpi-label">${scenarioText(`REAL del mes · ${month()}`)}</div>${value(m.actualMonth, 'actual-month', 'actual')}${budget(m.budgetMonth, 'del mes')}${delta(m.actualMonth, m.budgetMonth)}</div>`
        : `<div class="metric-block"><div class="kpi-label label-with-help"><span>${scenarioText('FCST anual vigente')}</span>${calculationHelp(scope, label, m, true)}</div>${value(m.forecastYear, 'forecast-year', 'forecast')}${budget(m.budgetYear, 'anual')}${delta(m.forecastYear, m.budgetYear)}</div>
          <div class="card-break">${inline(`REAL a ${closure.toLowerCase()}`, m.actualAtCutoff, 'actual')}${inline('FCST restante', m.future, 'forecast')}${inline('Saldo de PPTO al cierre', m.available, 'budget')}</div>`;
      return `<article class="kpi-card" data-block="${block}" data-scope="${scope}"><h3 class="row-title" style="--row-color:${colour}">${label}</h3>${content}</article>`;
    }).join('');
    $('summary-bands').innerHTML = integrated ? integratedSummary(rows) : `<section class="summary-section"><div class="band-heading"><h3>Ejecución · Enero a ${month().toLowerCase()} ${data.year}</h3><span>${state.currency}</span></div><div class="kpi-grid">${cards('execution')}</div></section>
      <section class="summary-section"><div class="band-heading"><h3>Cierre anual vigente · Fuente ${closure.toLowerCase()} ${data.year}</h3><span>${state.currency}</span></div><div class="kpi-grid">${cards('annual')}</div></section>`;
    $('history-content').innerHTML = selected().total.prior
      ? `<div class="table-wrap" tabindex="0"><table class="history-table"><thead><tr><th>Gasto</th><th>${scenarioText(`REAL ene–${month().slice(0, 3).toLowerCase()} ${data.year - 1}`)}</th><th>${scenarioText(`REAL ene–${month().slice(0, 3).toLowerCase()} ${data.year}`)}</th><th>Variación</th></tr></thead><tbody>${rows.map(([, label, series]) => {const h = metrics(series); return `<tr><th scope="row">${label}</th><td>${scenarioValue('actual', fmt(h.priorYtd))}</td><td>${scenarioValue('actual', fmt(h.actualYtd))}</td><td>${signed(h.actualYtd - h.priorYtd)} (${signed(model.relative(h.actualYtd, h.priorYtd), pct)})</td></tr>`;}).join('')}</tbody></table></div><p class="legend-note">${state.currency} · Períodos equivalentes, enero a ${month().toLowerCase()}.</p>`
      : `<p class="unavailable">${scenarioText(selected().history_note)} No se convierte el histórico de otra moneda.</p>`;
  }

  function detailShell() {
    $('report-panel').innerHTML = `<div class="detail-intro"><div class="detail-focus"><span id="detail-focus"></span><button class="icon-button" id="clear-category" title="Quitar selección de categoría" aria-label="Quitar selección de categoría"><i data-lucide="x"></i></button></div></div>
      <div class="detail-grid">
        <section class="chart-section"><div class="section-heading"><h3>Evolución mensual</h3><span class="chart-unit"></span></div><div id="monthly-legend"></div><div id="monthly-chart" class="plot" role="img" aria-label="Evolución mensual: REAL, PPTO y FCST"></div><p id="history-note" class="legend-note"></p></section>
        <section class="chart-section"><div class="section-heading"><h3>Desviación por categoría</h3><span class="chart-unit"></span></div><div id="ranking-controls"></div><div id="variance-chart" class="plot" role="img" aria-label="Ranking de diferencias frente al presupuesto"></div><p id="ranking-note" class="legend-note"></p></section>
        <section class="chart-section full-width"><div class="section-heading"><h3>Distribución mensual por categoría</h3><div id="matrix-controls"></div></div><div class="table-wrap" tabindex="0" role="region" aria-label="Matriz mensual por categoría"><table id="matrix-table"></table></div><p id="matrix-note" class="legend-note"></p></section>
        <section class="chart-section full-width"><div class="section-heading"><h3>Detalle por categoría</h3><span class="chart-unit"></span></div><div class="table-wrap" tabindex="0" role="region" aria-label="Tabla de gasto por categoría"><table id="category-table"></table></div><p class="legend-note">${scenarioText('Variación = REAL o FCST menos PPTO; porcentaje respecto al PPTO del mismo período.')}</p></section>
      </div>`;
    $('clear-category').addEventListener('click', () => requestRender({category: null}));
  }
  function tableRows(rows, totals) {
    const cells = series => ['month', 'ytd', 'annual'].map(mode => {
      const c = model.comparison(metrics(series), mode);
      return `<td>${scenarioValue(mode === 'annual' ? 'forecast' : 'actual', fmt(c.actual))}</td><td>${scenarioValue('budget', fmt(c.budget))}</td><td class="pct-cell ${signClass(c.delta)}">${signed(c.delta)}<br><span>(${signed(c.percent, pct)})</span></td>`;
    }).join('');
    $('category-table').innerHTML = `<thead><tr><th rowspan="2" scope="col">Categoría</th><th colspan="3" scope="colgroup">${month()} ${data.year}</th><th colspan="3" scope="colgroup">Enero a ${month().toLowerCase()} ${data.year}</th><th colspan="3" scope="colgroup">Anual ${data.year} · Cierre ${closure.toLowerCase()}</th></tr><tr>${['REAL', 'PPTO', 'Variación', 'REAL', 'PPTO', 'Variación', 'FCST', 'PPTO', 'Variación'].map(label => `<th scope="col">${scenarioText(label)}</th>`).join('')}</tr></thead><tbody>` + rows.map(row => `<tr class="${row.category === state.category ? 'selected' : ''}"><th scope="row"><button class="category-button" data-category="${escape(row.category)}" aria-pressed="${row.category === state.category}" title="${escape(row.category)}">${escape(row.label)}</button></th>${cells(row.series)}</tr>`).join('') + `</tbody><tfoot><tr><th scope="row">Total ${kind().toUpperCase()}</th>${cells(totals)}</tr></tfoot>`;
  }
  function matrix(rows, total) {
    const amount = (series, i) => series.actual[i] - (state.matrix === 'variance' ? series.budget[i] : 0);
    const max = Math.max(...rows.flatMap(row => Array.from({length: data.cutoff}, (_, i) => Math.abs(amount(row.series, i)))), 1e-9);
    const cells = (series, category) => Array.from({length: data.cutoff}, (_, i) => {
      const value = amount(series, i);
      const rgb = state.matrix === 'variance' ? (value > 0 ? '197,36,61' : '35,131,62') : '82,49,120';
      const style = `background:rgba(${rgb},${0.04 + 0.23 * Math.abs(value) / max})`;
      const title = `${months[i]} · ${category || 'Total'} · REAL ${fmt(series.actual[i])}; PPTO ${fmt(series.budget[i])} ${state.currency}`;
      const display = state.matrix === 'actual' ? scenarioValue('actual', fmt(value)) : fmt(value);
      return `<td class="${i + 1 === state.month ? 'active-month' : ''}"${category ? ` style="${style}"` : ''}>${category ? `<button class="matrix-cell" data-month="${i + 1}" data-cell-category="${escape(category)}" aria-pressed="${i + 1 === state.month && category === state.category}" title="${escape(title)}">${display}</button>` : display}</td>`;
    }).join('');
    $('matrix-table').innerHTML = `<thead><tr><th scope="col">Categoría</th>${months.slice(0, data.cutoff).map(m => `<th scope="col">${m.slice(0, 3)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${escape(row.label)}</th>${cells(row.series, row.category)}</tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total ${kind().toUpperCase()}</th>${cells(total)}</tr></tfoot>`;
    $('matrix-note').innerHTML = scenarioText(`${state.currency} · ${state.matrix === 'actual' ? 'REAL' : 'REAL menos PPTO; rojo: sobre presupuesto, verde: bajo presupuesto'} · Enero a ${closure.toLowerCase()} ${data.year}.`);
  }

  const plotConfig = {displayModeBar: false, responsive: true, scrollZoom: false};
  const classic = ['classic', 'proposal'].includes(document.body.dataset.summaryLayout) ? CierreClassic.create({
    data, state, $, model, document, Plotly, width, metrics, selected, kind, month, months, closure, colors, color,
    fmt, pct, signed, signClass, escape, delta, legend, calculationHelp, helpButton, plotLayout, plotConfig, proposal,
    toggleCategory: category => requestRender({category: desired.category === category ? null : category}),
  }) : null;
  function plotLayout(extra = {}) {
    const bg = color('plot-paper') || '#fff';
    const layout = {autosize: true, paper_bgcolor: bg, plot_bgcolor: bg, font: {family: 'Segoe UI, Arial, sans-serif', size: classic ? 12 : 11, color: color('muted')},
      margin: {l: 50, r: 18, t: 16, b: 40}, separators: ',.', hoverlabel: {font: {family: 'Arial', size: 12}},
      showlegend: false, xaxis: {fixedrange: true, zeroline: false, gridcolor: '#edf0f2'},
      yaxis: {fixedrange: true, zerolinecolor: '#d3dce2', gridcolor: '#edf0f2'}, ...extra};
    if (root.dataset.contrast === 'high') layout.hoverlabel = {bgcolor: bg, bordercolor: color('muted'), font: {...layout.font}};
    return layout;
  }
  async function detail() {
    const group = selected().types[kind()];
    const focused = group.rows.find(row => row.category === state.category);
    const series = focused ? focused.series : group.series;
    $('detail-focus').textContent = focused ? `${focused.label} · Evolución mensual` : `${kind().toUpperCase()} · Todas las categorías`;
    $('clear-category').disabled = !focused;
    document.querySelectorAll('.chart-unit').forEach(el => {el.textContent = state.currency;});
    $('ranking-controls').innerHTML = segmented('ranking', [['month', 'Mes'], ['ytd', 'Acumulado'], ['annual', 'Cierre anual']]);
    $('matrix-controls').innerHTML = segmented('matrix', [['actual', 'REAL'], ['variance', 'Desviación']]);
    tableRows(group.rows, group.series);
    matrix(group.rows, group.series);
    const legendItems = [[`REAL ${data.year}`, colors.actual], ['PPTO', colors.budget, true]];
    if (data.cutoff < 12) legendItems.splice(1, 0, [`FCST ${months[data.cutoff].slice(0, 3).toLowerCase()}–dic`, colors.forecast]);
    if (series.prior) legendItems.push([`REAL ${data.year - 1}`, colors.prior, true]);
    $('monthly-legend').innerHTML = legend(legendItems);
    $('history-note').innerHTML = scenarioText(`REAL hasta ${closure.toLowerCase()} ${data.year}. ${focused ? `Histórico ${data.year - 1} no incorporado por categoría.` : selected().history_note}`);
    const x = Array.from({length: 12}, (_, i) => i + 1);
    const hover = name => `%{customdata}<br>${name}: %{y:,.0f} ${state.currency}<extra></extra>`;
    const hoverStyle = key => ({bgcolor: '#fff', bordercolor: color('border'), font: {color: colors[key]}});
    const monthly = [
      {type: 'bar', x, y: series.actual, customdata: months, name: `REAL ${data.year}`, marker: {color: colors.actual}, hovertemplate: hover('REAL'), hoverlabel: hoverStyle('actual')},
      {type: 'bar', x, y: series.forecast, customdata: months, name: `FCST ${data.year}`, marker: {color: colors.forecast}, hovertemplate: hover('FCST'), hoverlabel: hoverStyle('forecast')},
      {type: 'scatter', mode: 'lines+markers', x, y: series.budget, customdata: months, name: 'PPTO', line: {color: colors.budget, width: 2}, marker: {size: 4}, hovertemplate: hover('PPTO'), hoverlabel: hoverStyle('budget')},
    ];
    if (series.prior) monthly.push({type: 'scatter', mode: 'lines', x, y: series.prior, customdata: months, name: `REAL ${data.year - 1}`, line: {color: colors.prior, width: 2, dash: 'dot'}, hovertemplate: hover(`REAL ${data.year - 1}`), hoverlabel: hoverStyle('actual')});
    const sorted = group.rows.map(row => ({...row, c: model.comparison(metrics(row.series), state.ranking)})).sort((a, b) => Math.abs(b.c.delta) - Math.abs(a.c.delta));
    const mobile = width() < 600;
    const labels = sorted.map(row => row.label.length > 19 ? row.label.replace(/ (?!.* )/, '<br>') : row.label);
    const variance = [{type: 'bar', orientation: 'h', x: sorted.map(row => row.c.delta), y: labels,
      customdata: sorted.map(row => [row.label, signed(row.c.percent, pct), row.category]), name: 'Variación',
      marker: {color: sorted.map(row => row.c.delta > 0 ? colors.bad : colors.good), opacity: sorted.map(row => !state.category || state.category === row.category ? 1 : 0.4)},
      hovertemplate: `%{customdata[0]}<br>%{x:,.0f} ${state.currency} (%{customdata[1]})<extra></extra>`}];
    $('ranking-note').innerHTML = scenarioText(`${state.ranking === 'annual' ? `FCST anual vigente al cierre de ${closure.toLowerCase()}` : state.ranking === 'month' ? `REAL de ${month().toLowerCase()}` : `REAL de enero a ${month().toLowerCase()}`} menos PPTO equivalente. Rojo: sobre PPTO; verde: bajo PPTO.`);
    $('variance-chart').style.height = `${Math.max(310, sorted.length * 31 + 45)}px`;
    const shapes = [{type: 'rect', xref: 'x', yref: 'paper', x0: state.month - 0.45, x1: state.month + 0.45, y0: 0, y1: 1, fillcolor: '#ffb81c18', line: {width: 0}, layer: 'below'}];
    if (data.cutoff < 12) shapes.push({type: 'line', xref: 'x', yref: 'paper', x0: data.cutoff + 0.5, x1: data.cutoff + 0.5, y0: 0, y1: 1, line: {color: color('prior'), dash: 'dot', width: 1}});
    await Plotly.react('monthly-chart', monthly, plotLayout({barmode: 'relative', bargap: 0.3, shapes,
      xaxis: {fixedrange: true, range: [0.4, 12.6], tickmode: 'array', tickvals: x, ticktext: months.map(m => m.slice(0, 3)), tickfont: {size: mobile ? 9 : 11}},
      yaxis: {fixedrange: true, rangemode: 'tozero', gridcolor: '#edf0f2'}, margin: {l: 45, r: 10, t: 20, b: 38}}), plotConfig);
    await Plotly.react('variance-chart', variance, plotLayout({margin: {l: mobile ? 122 : 150, r: 20, t: 12, b: 35},
      xaxis: {fixedrange: true, gridcolor: '#edf0f2', zeroline: true, zerolinecolor: '#b9c4cc'},
      yaxis: {fixedrange: true, autorange: 'reversed', tickfont: {size: 10}, type: 'category', categoryorder: 'array', categoryarray: labels}}), plotConfig);
    $('variance-chart').removeAllListeners('plotly_click');
    $('variance-chart').on('plotly_click', event => {
      const category = event.points[0].customdata[2];
      requestRender({category: desired.category === category ? null : category});
    });
  }

  function sourceInfo() {
    const ranges = selected().ranges;
    const perimeter = data.choices ? data.choices[state.scope].map(k => scopeNames[k]).join(' + ') : data.entity;
    const aliases = data.choices ? Object.assign({}, ...data.choices[state.scope].map(k => data.members[k].aliases)) : data.aliases;
    $('source-content').innerHTML = `<p><b>Fuente única:</b> ${escape(data.source)} · Hoja ${escape(data.sheet)} · ${escape(perimeter)}. Valores almacenados, sin recalcular vínculos externos. Los subtotales Corp y los bloques Negocio no se añaden.</p>
      <p><b>Períodos:</b> ${scenarioText(`Mes consultado ${month().toLowerCase()} ${data.year}; acumulado enero a ${month().toLowerCase()}. Cierre fuente ${closure.toLowerCase()} ${data.year}. FCST anual vigente = REAL enero a ${closure.toLowerCase()} + FCST posterior hasta diciembre. No representa una proyección histórica del mes consultado.`)}</p>
      <p><b>Escala:</b> ${state.currency === 'MSoles' ? 'MSoles = miles de soles. El bloque de origen ya está en miles de soles; no se divide nuevamente.' : 'MMCLP = Millones de Pesos (CLP). El bloque de origen ya está en esa escala; no se divide nuevamente.'} Cada moneda proviene de su bloque, sin aplicar un tipo de cambio nuevo.</p>
      <p><b>Rangos:</b> ${scenarioText(`REAL + FCST ${ranges.execution_forecast}; PPTO ${ranges.budget}${ranges.prior ? `; REAL ${data.year - 1} ${ranges.prior}` : ''}.`)}</p>
      <p><b>Histórico:</b> ${scenarioText(selected().history_note)}</p>
      ${selected().types.CO ? '<p><b>Composición del Total:</b> OPEX + CAPEX + CO. CO se conserva por separado, sin reclasificarlo. Las páginas OPEX y CAPEX no incluyen CO.</p>' : ''}
      <p><b>Indicadores:</b> ${scenarioText(`Uso = 100 × REAL acumulado / PPTO anual; esperado = 100 × PPTO acumulado / PPTO anual. ${classic ? 'PPTO disponible al mes consultado = PPTO anual menos REAL acumulado al mes. FCST pendiente comprende solo meses posteriores al cierre fuente.' : 'Saldo al cierre = PPTO anual menos REAL al cierre fuente.'} Variación = REAL o FCST menos PPTO. Porcentaje N/D si el denominador no es positivo. Los negativos se conservan; bajo PPTO no implica ahorro definitivo.`)}</p>
      <p><b>Presentación:</b> ${Object.keys(aliases).length ? Object.entries(aliases).map(([key, label]) => `${escape(key)}: ${escape(label)}`).join('; ') + '. ' : 'Categorías originales de la fuente. '}Son rótulos de categoría, no un desglose por proveedor. Montos sin decimales y porcentajes con dos. Punto para miles y coma decimal, sin redondeos intermedios.</p>`;
  }

  async function render(rebuild) {
    const standalone = root === owner.body;
    const scroll = standalone ? window.scrollY : root.scrollTop;
    const active = document.activeElement;
    const focusKey = active?.hasAttribute('data-reset-category') ? ['data-reset-category', '']
      : active?.dataset?.sortKey ? ['data-sort-key', active.dataset.sortKey]
      : active?.dataset?.category ? ['data-category', active.dataset.category]
      : active?.dataset?.control ? ['data-control', active.dataset.control, active.dataset.value]
      : active?.dataset?.cellCategory ? ['data-cell-category', active.dataset.cellCategory, active.dataset.month] : null;
    if (rebuild) document.querySelectorAll('.js-plotly-plot').forEach(el => Plotly.purge(el));
    Object.assign(document.body.dataset, {page: state.page, currency: state.currency, month: state.month});
    document.querySelectorAll('button[data-page]').forEach(button => {const active = button.dataset.page === state.page; button.setAttribute('aria-selected', active); button.tabIndex = active ? 0 : -1;});
    document.querySelectorAll('button[data-currency]').forEach(button => button.setAttribute('aria-pressed', button.dataset.currency === state.currency));
    $('month').value = state.month;
    $('month-label').textContent = `${month()} ${data.year}`;
    document.querySelectorAll('[data-month-option]').forEach(option => option.setAttribute('aria-selected', String(Number(option.dataset.monthOption) === state.month)));
    $('report-panel').setAttribute('aria-labelledby', `tab-${state.page}`);
    if ($('context')) $('context').textContent = `FUENTE · CIERRE ${closure.toUpperCase()} ${data.year}`;
    $('page-title').textContent = `${state.page === 'summary' ? classic ? 'Gastos Tecnológicos' : 'Gastos tecnológicos' : kind().toUpperCase()} | ${classic && state.month === data.cutoff ? 'Cierre ' : ''}${month()} ${data.year}`;
    $('footer-cutoff').textContent = `${closure} ${data.year} · ${state.currency}`;
    $('layout-label').hidden = !integrated || state.page !== 'summary';
    $('month-status').hidden = !classic && state.month === data.cutoff;
    $('month-status').classList.toggle('sr-only', !!classic);
    $('month-status').innerHTML = scenarioText(`Ejecución a ${month().toLowerCase()}. FCST anual vigente al cierre de ${closure.toLowerCase()} ${data.year}.`);
    if (classic) {
      if (state.page === 'summary') classic.summary();
      else {
        if (rebuild) classic.detailShell();
        await classic.detail();
      }
    } else if (state.page === 'summary') {
      if (rebuild) summaryShell();
      summary();
    } else {
      if (rebuild) detailShell();
      await detail();
    }
    sourceInfo();
    lucide.createIcons({root, icons: lucide.icons});
    if (!rebuild) {
      if (focusKey) Array.from(document.querySelectorAll(`[${focusKey[0]}]`)).find(el => el.getAttribute(focusKey[0]) === focusKey[1] && (!focusKey[2] || (el.dataset.value || el.dataset.month) === focusKey[2]))?.focus({preventScroll: true});
      if (standalone) window.scrollTo({top: scroll, behavior: 'instant'});
      else root.scrollTop = scroll;
    }
  }

  function scheduleHelpClose() {
    if (!helpPinned && !helpTrigger?.matches(':focus-visible')) helpTimer = setTimeout(closeHelp, 150);
  }
  document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const button = event.target.closest('[data-help]');
    if (button) {
      clearTimeout(helpTimer);
      if (button !== helpTrigger) showHelp(button);
    } else if ($('calculation-tooltip').contains(event.target)) clearTimeout(helpTimer);
  });
  document.addEventListener('pointerout', event => {
    if (event.pointerType !== 'mouse' || !helpTrigger) return;
    const tooltip = $('calculation-tooltip');
    if ((helpTrigger.contains(event.target) || tooltip.contains(event.target)) &&
        !helpTrigger.contains(event.relatedTarget) && !tooltip.contains(event.relatedTarget)) scheduleHelpClose();
  });
  document.addEventListener('focusin', event => {
    if (event.target.matches('[data-help]:focus-visible')) showHelp(event.target);
    else if (helpTrigger && !helpTrigger.contains(event.target)) closeHelp();
  });
  document.addEventListener('focusout', event => {
    if (event.target === helpTrigger) closeHelp();
  });
  document.addEventListener('pointerdown', event => {
    if (helpTrigger && !helpTrigger.contains(event.target) && !$('calculation-tooltip').contains(event.target)) closeHelp();
  });
  document.addEventListener('keydown', event => {if (event.key === 'Escape') closeHelp();});
  listen(window, 'scroll', event => {
    if (!helpTrigger || (event.target instanceof Node && $('calculation-tooltip').contains(event.target))) return;
    // Ignore a queued scroll event from bringing the trigger into view before opening.
    const anchor = helpTrigger.getBoundingClientRect();
    if (Math.abs(anchor.top - helpAnchor.top) > 0.5 || Math.abs(anchor.left - helpAnchor.left) > 0.5) closeHelp();
  }, true);
  listen(window, 'resize', closeHelp);
  if (classic) listen(matchMedia('(max-width: 599px)'), 'change', () => {
    if (desired.page !== 'summary') requestRender();
  });

  $('report-panel').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) {
      const row = classic && event.target.closest('tr[data-row-category], tr[data-row-total]');
      if (row) requestRender({category: row.hasAttribute('data-row-total') || desired.category === row.dataset.rowCategory ? null : row.dataset.rowCategory});
      return;
    }
    if (button.dataset.help) {
      if (button === helpTrigger && helpPinned) closeHelp();
      else showHelp(button, true);
    } else if (button.hasAttribute('data-reset-category')) requestRender({category: null});
    else if (button.dataset.sortKey) {
      const key = button.dataset.sortKey;
      requestRender({sortKey: key, sortDirection: desired.sortKey === key ? desired.sortDirection === 'asc' ? 'desc' : 'asc' : key === 'category' ? 'asc' : 'desc'});
    } else if (button.dataset.control) requestRender({[button.dataset.control]: button.dataset.value});
    else if (button.dataset.cellCategory) requestRender({category: button.dataset.cellCategory, month: Number(button.dataset.month)});
    else if (button.dataset.category) requestRender({category: desired.category === button.dataset.category ? null : button.dataset.category});
  });
  // In-DOM listbox avoids native popup behavior inside the Service visual iframe.
  const monthControl = $('month');
  const monthList = $('month-options');
  let activeMonth = state.month;
  monthList.innerHTML = months.slice(0, data.cutoff).map((m, i) => `<div id="month-option-${i + 1}" role="option" data-month-option="${i + 1}" aria-selected="${i + 1 === state.month}">${m} ${data.year}</div>`).join('');
  function closeMonth() {
    monthList.hidden = true;
    monthControl.setAttribute('aria-expanded', 'false');
    monthControl.removeAttribute('aria-activedescendant');
  }
  function highlightMonth(value) {
    activeMonth = Math.max(1, Math.min(data.cutoff, value));
    document.querySelectorAll('[data-month-option]').forEach(option => option.classList.toggle('active', Number(option.dataset.monthOption) === activeMonth));
    monthControl.setAttribute('aria-activedescendant', `month-option-${activeMonth}`);
    const option = $(`month-option-${activeMonth}`);
    monthList.scrollTop = Math.max(0, option.offsetTop - monthList.clientHeight + option.offsetHeight);
  }
  function openMonth() {
    closeHelp();
    monthList.hidden = false;
    const bottom = Math.min(owner.documentElement.clientHeight, root.getBoundingClientRect().bottom);
    monthList.style.maxHeight = `${Math.max(44, Math.min(288, bottom - monthList.getBoundingClientRect().top - 8))}px`;
    monthControl.setAttribute('aria-expanded', 'true');
    highlightMonth(desired.month);
  }
  function chooseMonth(value) {
    closeMonth();
    monthControl.focus({preventScroll: true});
    requestRender({month: value});
  }
  listen(monthControl, 'click', () => monthList.hidden ? openMonth() : closeMonth());
  listen(monthList, 'click', event => {
    const option = event.target.closest('[data-month-option]');
    if (option) chooseMonth(Number(option.dataset.monthOption));
  });
  listen(monthList, 'mousedown', event => event.preventDefault());
  listen(monthControl, 'keydown', event => {
    const key = event.key;
    if (key === 'Tab' || key === 'Escape') {closeMonth(); return;}
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) return;
    event.preventDefault();
    if (monthList.hidden) {openMonth(); return;}
    if (key === 'Enter' || key === ' ') chooseMonth(activeMonth);
    else highlightMonth(key === 'Home' ? 1 : key === 'End' ? data.cutoff : activeMonth + (key === 'ArrowDown' ? 1 : -1));
  });
  listen(owner, 'pointerdown', event => {
    if (!event.composedPath().includes($('month-picker'))) closeMonth();
  });
  listen(monthControl, 'blur', closeMonth);
  listen(window, 'resize', closeMonth);
  document.querySelectorAll('button[data-currency]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.currency !== desired.currency) requestRender({currency: button.dataset.currency});
  }));
  document.querySelectorAll('button[data-page]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.page !== desired.page) requestRender({page: button.dataset.page, category: null, sortKey: 'category', sortDirection: 'asc'}, true);
  }));
  document.querySelector('.tabs').addEventListener('keydown', event => {
    const tabs = Array.from(document.querySelectorAll('[role=tab]'));
    const current = tabs.indexOf(document.activeElement);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[index].focus(); tabs[index].click();
  });
  const resize = () => requestRender({}, syncPalette());
  listen(forced, 'change', resize);
  const ready = requestRender({}, true);
  return {
    ready,
    state: () => ({...desired}),
    resize,
    async destroy() {
      destroyed = true;
      pending = false;
      lifetime.abort();
      closeHelp();
      await renderDone;
      classic?.destroy();
      document.querySelectorAll('.js-plotly-plot').forEach(el => Plotly.purge(el));
    },
  };
});
