/* Original report layout, sharing the validated financial windows and UI controller. */
/* eslint-disable powerbi-visuals/no-inner-outer-html -- Static templates; external category labels pass through escape(). */
globalThis.CierreClassic = {
  monetaryAxis(values, width, measureText) {
    const finite = values.filter(Number.isFinite);
    const min = Math.min(0, ...finite), max = Math.max(0, ...finite);
    const emptyRange = min === max;
    const span = emptyRange ? 1 : max - min;
    const lower = min < 0 ? min - span * 0.05 : 0;
    const upper = emptyRange ? 1 : max > 0 ? max + span * 0.05 : 0;
    const exponent = Math.floor(Math.log10(span));
    const clean = n => n === 0 ? 0 : Number(n.toPrecision(15));
    const candidates = [];
    // Evaluate a bounded set of readable steps; neither currency nor file enters the rule.
    for (let power = exponent - 2; power <= exponent + 1; power++) {
      const format = new Intl.NumberFormat('es-CL', {maximumFractionDigits: Math.min(20, Math.max(0, -power))});
      for (const factor of [1, 2, 5]) {
        const step = factor * 10 ** power;
        const first = Math.floor(lower / step), last = emptyRange ? Math.floor(upper / step) : Math.ceil(upper / step);
        const count = last - first + 1;
        if (count < 2 || count > 9) continue;
        const ticks = Array.from({length: count}, (_, i) => clean((first + i) * step));
        const labels = ticks.map(n => format.format(n));
        const gap = width / (count - 1);
        candidates.push({range: emptyRange ? [0, 1] : [ticks[0], ticks.at(-1)], ticks, labels, count,
          fits: gap >= Math.max(40, ...labels.map(text => measureText(text) + 12)), score: Math.abs(gap - 75)});
      }
    }
    const legible = candidates.filter(c => c.fits);
    const preferred = legible.filter(c => c.count >= (width >= 300 ? 5 : 3));
    const pool = preferred.length ? preferred : legible.length ? legible : candidates;
    pool.sort((a, b) => a.score - b.score || a.count - b.count);
    const best = pool[0];
    return {autorange: false, range: best.range, tickmode: 'array', tickangle: 0,
      tickvals: best.fits ? best.ticks : [0], ticktext: best.fits ? best.labels : ['0']};
  },
  create({data, state, $, model, document, Plotly, width, metrics, selected, kind, month, months, closure, colors, color,
    fmt, pct, signed, signClass, escape, delta, legend, calculationHelp, helpButton, plotLayout, plotConfig, toggleCategory, proposal = null}) {
    let rendered = null;
    let annualObserver = null;
    let annualResizeFrame = 0;
    const axisMeasure = document.createElement('canvas').getContext('2d');
    function annualAxis(chart, traces, layout) {
      axisMeasure.font = `${layout.font.size}px ${layout.font.family}`;
      const width = chart.clientWidth - layout.margin.l - layout.margin.r;
      return CierreClassic.monetaryAxis(traces.flatMap(trace => trace.x), width, text => axisMeasure.measureText(text).width);
    }
    function stopAnnualObserver() {
      annualObserver?.disconnect();
      annualObserver = null;
      cancelAnimationFrame(annualResizeFrame);
    }
    function observeAnnual(chart) {
      let lastWidth = chart.clientWidth;
      annualObserver = new ResizeObserver(() => {
        cancelAnimationFrame(annualResizeFrame);
        annualResizeFrame = requestAnimationFrame(() => {
          if (!chart.isConnected || !chart.layout || chart.clientWidth === lastWidth || chart.clientWidth === 0) return;
          lastWidth = chart.clientWidth;
          const axis = annualAxis(chart, chart.data, chart.layout);
          const changes = {autosize: true};
          for (const [key, value] of Object.entries(axis)) {
            if (JSON.stringify(chart.layout.xaxis[key]) !== JSON.stringify(value)) changes[`xaxis.${key}`] = value;
          }
          // Resize only this plot; unchanged ticks need no axis update or data rebuild.
          Plotly.relayout(chart, changes);
        });
      });
      annualObserver.observe(chart);
    }
    const columns = [
      ['category', 'Categoría'], ['actualMonth', 'Real mes'], ['monthPercent', 'Δ% mes'],
      ['actualYtd', 'Real acumulado'], ['budgetYtd', 'Ppto acumulado'], ['ytdPercent', 'Δ% acumulado'],
      ['forecastYear', 'Fcst FY'], ['budgetYear', 'Ppto FY'], ['annualPercent', 'Δ% FY'],
    ];
    const collator = new Intl.Collator('es', {sensitivity: 'base', numeric: true});
    const ytdPeriod = () => `Enero–${month().toLowerCase()} ${data.year}`;
    const forecastPeriod = () => data.cutoff < 12
      ? `REAL enero–${closure.toLowerCase()}; FCST ${months[data.cutoff].toLowerCase()}–diciembre ${data.year}.`
      : `REAL enero–diciembre ${data.year}; sin meses futuros de FCST.`;
    const forecastHelp = id => helpButton(id, 'Vigencia del FCST anual',
      `<p>FCST anual vigente al cierre de ${closure.toLowerCase()} ${data.year}.</p><p>${forecastPeriod()}</p><p>No cambia al seleccionar otro mes.</p>`);

    function componentsHelp() {
      if (!selected().types.CO) return '';
      const m = metrics(selected().types.CO.series);
      return helpButton('help-components', 'Composición del Total: incluye CO',
        `<p><b>Total = OPEX + CAPEX + CO</b></p><p>CO se conserva sin reclasificar; no está incluido en las páginas OPEX y CAPEX.</p>` +
        `<p>CO · REAL ${month().toLowerCase()}: ${fmt(m.actualMonth)} ${state.currency}<br>REAL ${ytdPeriod()}: ${fmt(m.actualYtd)} ${state.currency}<br>FCST anual: ${fmt(m.forecastYear)} ${state.currency}<br>PPTO anual: ${fmt(m.budgetYear)} ${state.currency}</p>`);
    }
    const measured = row => {
      const m = metrics(row.series);
      return {...row, m: {...m, monthPercent: model.relative(m.actualMonth, m.budgetMonth),
        ytdPercent: model.relative(m.actualYtd, m.budgetYtd), annualPercent: model.relative(m.forecastYear, m.budgetYear)}};
    };
    function sortedRows(rows) {
      return rows.map(measured).sort((a, b) => {
        const alphabetical = collator.compare(a.label, b.label) || collator.compare(a.category, b.category);
        if (state.sortKey === 'category') return alphabetical * (state.sortDirection === 'asc' ? 1 : -1);
        const av = a.m[state.sortKey], bv = b.m[state.sortKey];
        // Missing ratios stay last in both directions; ties keep a stable alphabetical order.
        if (!Number.isFinite(av) || !Number.isFinite(bv)) return Number.isFinite(av) ? -1 : Number.isFinite(bv) ? 1 : alphabetical;
        return (av - bv) * (state.sortDirection === 'asc' ? 1 : -1) || alphabetical;
      });
    }

    function summary() {
      stopAnnualObserver();
      const labels = [`${month()} ${data.year}`, `Acumulado a ${month().toLowerCase()}`, `Forecast ${data.year}`,
        `${data.year} vs. ${data.year - 1} acumulado`, 'Uso del PPTO anual'];
      const validity = `<small class="forecast-validity">Cierre: ${closure.toLowerCase()} ${data.year}</small>`;
      const card = (scope, i, content) => `<article class="kpi-card" data-scope="${scope}" data-kpi="${i}" aria-label="${escape(labels[i])}"><div class="kpi-label">${labels[i]}${i === 2 ? validity : ''}</div>${content}</article>`;
      const value = (n, name) => `<div class="kpi-value" data-metric="${name}">${fmt(n)}<small>${state.currency}</small></div>`;
      const rows = [['Total', 'Gastos totales', selected().total, color('navy')], ['Opex', 'OPEX', selected().types.Opex.series, color('violet')], ['Capex', 'CAPEX', selected().types.Capex.series, color('magenta')]];
      $('report-panel').innerHTML = `<div class="column-heads" aria-hidden="true">${labels.map((l, i) => `<div><span>${l}</span>${i === 2 ? validity : ''}</div>`).join('')}</div>` + rows.map(([scope, label, series, colour]) => {
        const m = metrics(series);
        const history = m.priorYtd === null
          ? `<div class="kpi-value unavailable">N/D</div><div class="kpi-sub">Histórico ${data.year - 1} no disponible en ${state.currency}.</div>`
          : `${proposal ? proposal.historyValue(scope, label, m) : `<div class="kpi-value" data-metric="yoy">${signed(model.relative(m.actualYtd, m.priorYtd), pct)}</div>`}<div class="kpi-sub">REAL ${data.year - 1}: ${fmt(m.priorYtd)}<br>REAL ${data.year}: ${fmt(m.actualYtd)} ${state.currency}</div><div class="delta neutral">Forecast anual vs. ${data.year - 1}: ${signed(model.relative(m.forecastYear, m.priorYear), pct)}</div>`;
        return `<section class="summary-section" aria-label="${label}"><h3 class="row-title" style="--row-color:${colour}">${label}${scope === 'Total' ? componentsHelp() : ''}</h3><div class="kpi-grid">` +
          card(scope, 0, value(m.actualMonth, 'actual-month') + `<div class="kpi-sub">PPTO: ${fmt(m.budgetMonth)} ${state.currency}</div>` + delta(m.actualMonth, m.budgetMonth)) +
          card(scope, 1, value(m.actualYtd, 'actual-ytd') + `<div class="kpi-sub">PPTO: ${fmt(m.budgetYtd)} ${state.currency}</div>` + delta(m.actualYtd, m.budgetYtd)) +
          card(scope, 2, value(m.forecastYear, 'forecast-year') + `<div class="kpi-sub">PPTO anual: ${fmt(m.budgetYear)} ${state.currency}</div>` + delta(m.forecastYear, m.budgetYear)) +
          card(scope, 3, history) +
          card(scope, 4, `<div class="label-with-help"><div class="kpi-value" data-metric="usage">${pct(m.usage)}</div>${calculationHelp(scope, label, m)}</div><div class="kpi-sub">Esperado a ${month().toLowerCase()}: <span data-metric="expected">${pct(m.expected)}</span></div><div class="usage-bar" ${m.usage === null ? 'hidden' : ''} aria-hidden="true"><span class="fill" style="width:${Math.max(0, Math.min(100, m.usage ?? 0))}%"></span><span class="expected" style="left:${Math.max(0, Math.min(99, m.expected ?? 0))}%"></span></div><div class="quiet-note">PPTO disponible a ${month().toLowerCase()}: ${fmt(m.budgetYear - m.actualYtd)}<br>FCST ${data.cutoff < 12 ? `${months[data.cutoff].slice(0, 3).toLowerCase()}–dic` : 'pendiente'}: ${fmt(m.future)} ${state.currency}</div>`) +
          '</div></section>';
      }).join('');
    }

    function detailShell() {
      stopAnnualObserver();
      rendered = null;
      const panel = (id, title, body) => `<section class="chart-section" id="${id}"><div class="section-heading"><h3>${title}</h3>${id === 'execution-panel' ? '<span class="chart-unit"></span>' : ''}</div>${body}</section>`;
      $('report-panel').innerHTML = `<div class="detail-intro"><div class="detail-focus"><span id="detail-focus"></span><button class="icon-button" data-reset-category title="Mostrar todas las categorías" aria-label="Mostrar todas las categorías"><i data-lucide="x"></i></button></div></div><div class="detail-grid">` +
        panel('monthly-panel', `Evolución mensual ${data.year}: Real + Forecast vs Presupuesto`, '<p id="monthly-period" class="period-note"></p><div id="monthly-chart" class="plot" role="img" aria-label="Evolución mensual"></div><div id="monthly-legend"></div><p id="history-note" class="legend-note"></p>') +
        panel('variance-panel', 'Desviaciones acumuladas por categoría', '<p id="variance-period" class="period-note"></p><div id="variance-chart" class="plot" role="img" aria-label="Desviaciones acumuladas por categoría"></div>' + legend([['Mayor gasto vs Ppto', colors.bad], ['Menor gasto vs Ppto', colors.good]])) +
        panel('execution-panel', 'Ejecución y desviación', '<div class="table-wrap" tabindex="0" role="region" aria-label="Ejecución y desviación por categoría"><table id="category-table"></table></div>') +
        panel('annual-panel', 'Ppto FY vs Forecast FY vs Real acumulado', `<p class="period-note">FCST al cierre de ${closure.toLowerCase()} ${data.year} ${forecastHelp('help-forecast-plot')}</p><div id="annual-chart" class="plot" role="img" aria-label="Presupuesto anual, forecast anual y real acumulado por categoría"></div><div id="annual-legend"></div>`) + '</div>';
    }

    function table(rows, totals) {
      const cells = m => columns.slice(1).map(([key]) => {
        const percent = key.endsWith('Percent');
        return `<td data-value="${m[key] ?? ''}"${percent ? ` class="pct-cell ${signClass(m[key], 2)}"` : ''}>${percent ? signed(m[key], pct) : fmt(m[key])}</td>`;
      }).join('');
      $('category-table').innerHTML = `<thead><tr>${columns.map(([key, label]) => {
        const period = ['actualMonth', 'monthPercent'].includes(key) ? `${month()} ${data.year}`
          : ['actualYtd', 'budgetYtd', 'ytdPercent'].includes(key) ? ytdPeriod() : '';
        const shortPeriod = period ? `${period.startsWith('Enero–') ? 'Ene–' : ''}${month().slice(0, 3).toLowerCase()} ${data.year}` : '';
        const active = state.sortKey === key;
        const direction = active && state.sortDirection === 'asc' ? 'desc' : active ? 'asc' : key === 'category' ? 'asc' : 'desc';
        const icon = active ? state.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down' : 'arrow-up-down';
        return `<th scope="col" aria-sort="${active ? state.sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'}"><button class="sort-button" data-sort-key="${key}" aria-label="Ordenar ${label} ${direction === 'asc' ? 'ascendente' : 'descendente'}" title="Ordenar ${label} ${direction === 'asc' ? 'ascendente' : 'descendente'}"><span>${label}${period ? `<small class="table-period" title="${period}">${shortPeriod}</small>` : ''}</span><i data-lucide="${icon}"></i></button>${key === 'forecastYear' ? forecastHelp('help-forecast-table') : ''}</th>`;
      }).join('')}</tr></thead><tbody>${rows.map(row => `<tr data-row-category="${escape(row.category)}" class="${state.category === row.category ? 'selected' : ''}"><th scope="row"><button class="category-button" data-category="${escape(row.category)}" aria-pressed="${state.category === row.category}">${escape(row.label)}</button></th>${cells(row.m)}</tr>`).join('')}</tbody><tfoot><tr data-row-total><th scope="row"><button class="category-button" data-reset-category aria-pressed="${state.category === null}" title="Mostrar todas las categorías">Total</button></th>${cells(measured({series: totals}).m)}</tr></tfoot>`;
    }

    function monthlyAnnotation(series) {
      const index = state.month - 1;
      const real = series.actual[index], budget = series.budget[index];
      // A shared clear band keeps both labels above all bars/lines, including on narrow screens.
      const top = Math.max(0, ...Object.values(series).flat().filter(Number.isFinite));
      return {name: 'selected-month-values', xref: 'paper', x: (state.month - 0.4) / 12.2,
        xanchor: state.month >= 4 && state.month <= 9 ? 'center' : 'auto',
        yref: 'y', y: top, yanchor: 'bottom', yshift: 8, showarrow: false,
        align: 'left', font: {family: 'Segoe UI, Arial, sans-serif', size: 12},
        text: `<span style="color:${colors.actual}"><b>REAL ${data.year}: ${fmt(real)}</b></span><br>` +
          `<span style="color:#805600"><b>PPTO ${data.year}: ${fmt(budget)}</b></span>`};
    }

    async function detail() {
      const group = selected().types[kind()];
      const rows = sortedRows(group.rows);
      const focused = rows.find(r => r.category === state.category);
      const series = focused ? focused.series : group.series;
      $('detail-focus').textContent = `${kind().toUpperCase()} · ${focused ? focused.label : 'Todas las categorías'}`;
      document.querySelector('.detail-focus [data-reset-category]').hidden = !focused;
      document.querySelectorAll('.chart-unit').forEach(el => {el.textContent = state.currency;});
      table(rows, group.series);
      $('monthly-period').textContent = forecastPeriod();
      $('variance-period').textContent = `REAL − PPTO · ${ytdPeriod()}`;
      $('annual-legend').innerHTML = legend([[`Real enero–${month().toLowerCase()}`, colors.actual], ['Forecast FY', colors.forecast], ['Ppto FY', colors.budget]]);
      const historyDash = 'dot';
      const legends = [[`Real ${data.year}`, colors.actual], [`Forecast ${data.year}`, colors.forecast], ['Presupuesto', colors.budget, true]];
      if (series.prior) legends.push([`Real ${data.year - 1}`, colors.prior, true, historyDash]);
      $('monthly-legend').innerHTML = legend(legends);
      $('history-note').textContent = focused && !series.prior ? `Histórico ${data.year - 1} no incorporado por categoría.` : selected().history_note;
      const x = Array.from({length: 12}, (_, i) => i + 1);
      const hover = name => `%{customdata}<br>${name}: %{y:,.0f} ${state.currency}<extra></extra>`;
      const monthly = [
        {type: 'bar', x, y: series.actual, customdata: months, name: 'Real', marker: {color: colors.actual}, hovertemplate: hover('Real')},
        {type: 'bar', x, y: series.forecast, customdata: months, name: 'Forecast', marker: {color: colors.forecast}, hovertemplate: hover('Forecast')},
        {type: 'scatter', mode: 'lines+markers', x, y: series.budget, customdata: months, name: 'Presupuesto', line: {color: colors.budget, width: 3}, marker: {size: 5}, hovertemplate: hover('Presupuesto')},
      ];
      if (series.prior) monthly.push({type: 'scatter', mode: 'lines', x, y: series.prior, customdata: months, name: `Real ${data.year - 1}`, line: {color: colors.prior, width: 2, dash: historyDash}, hovertemplate: hover(`Real ${data.year - 1}`)});
      const ids = rows.map(r => r.category);
      const opacity = rows.map(r => !focused || r.category === focused.category ? 1 : 0.35);
      const differences = rows.map(r => r.m.actualYtd - r.m.budgetYtd);
      const differenceColors = differences.map(n => signClass(n) === 'neutral' ? color('muted') : colors[signClass(n)]);
      const customdata = rows.map(r => [r.label, r.category]);
      const variance = [{type: 'bar', orientation: 'h', x: differences, y: ids, customdata, name: 'Real − Ppto',
        marker: {color: differenceColors, opacity},
        text: differences.map(n => signed(n)), textposition: 'outside', textangle: 0,
        textfont: {color: differenceColors, size: 12}, constraintext: 'none', cliponaxis: false,
        hovertext: proposal ? rows.map(proposal.varianceText) : undefined,
        hovertemplate: proposal ? '%{hovertext}<extra></extra>' : `%{customdata[0]}<br>Real − Ppto: %{x:,.0f} ${state.currency}<extra></extra>`}];
      const annual = [['Ppto FY', 'budgetYear', colors.budget], ['Forecast FY', 'forecastYear', colors.forecast], ['Real acumulado', 'actualYtd', colors.actual]].map(([name, key, colour]) => ({
        type: 'bar', orientation: 'h', name, x: rows.map(r => r.m[key]), y: ids, customdata,
        marker: {color: colour, opacity}, hovertemplate: `%{customdata[0]}<br>${name}: %{x:,.0f} ${state.currency}<extra></extra>`,
      }));
      const narrow = width() < 600;
      const monetaryTitle = {text: state.currency, standoff: 8, font: {size: 12}};
      const horizontal = {margin: {l: narrow ? 132 : 174, r: 16, t: 8, b: 50},
        xaxis: {title: monetaryTitle, automargin: true, fixedrange: true, tickformat: ',.0f', gridcolor: '#ece7f3', zeroline: true, zerolinecolor: '#8c8c99'},
        yaxis: {fixedrange: true, autorange: 'reversed', tickfont: {size: 13}, ticklabelstandoff: 6, type: 'category', categoryorder: 'array', categoryarray: ids,
          tickmode: 'array', tickvals: ids, ticktext: rows.map(r => escape(r.label).replace(/ (?!.* )(?=.{0,15}$)/, narrow && r.label.length > 20 ? '<br>' : ' '))}};
      // Reserve the axis-title space without compressing category rows.
      $('monthly-chart').style.height = '250px';
      $('variance-chart').style.height = `${Math.max(180, rows.length * (narrow ? 32 : 22) + 38) + 20}px`;
      $('annual-chart').style.height = `${Math.max(208, rows.length * (narrow ? 34 : 26) + 38) + 20}px`;
      const shapes = [{type: 'rect', xref: 'x', yref: 'paper', x0: state.month - 0.45, x1: state.month + 0.45, y0: 0, y1: 1, fillcolor: '#ffb81c18', line: {width: 0}, layer: 'below'}];
      const snapshot = {page: state.page, currency: state.currency, month: state.month, category: state.category,
        sortKey: state.sortKey, sortDirection: state.sortDirection, narrow};
      const changed = keys => !proposal || !rendered || keys.some(key => snapshot[key] !== rendered[key]);
      // Sorting changes category plots, but not the monthly series. Selection only changes their emphasis.
      if (changed(['page', 'currency', 'month', 'category', 'narrow'])) {
        const enhancement = proposal ? proposal.monthlyLayout(kind(), focused?.label || 'Todas las categorías') : {};
        await Plotly.react('monthly-chart', proposal ? proposal.monthlyTraces(monthly, series) : monthly,
          plotLayout({barmode: 'relative', bargap: 0.3, shapes, ...enhancement, annotations: [monthlyAnnotation(series)],
            xaxis: {fixedrange: true, range: [0.4, 12.6], tickmode: 'array', tickvals: x, ticktext: months.map(m => m.slice(0, 3)), tickfont: {size: 13}, ...enhancement.xaxis},
            yaxis: {title: monetaryTitle, automargin: true, fixedrange: true, tickformat: ',.0f', rangemode: 'tozero', gridcolor: '#ece7f3'}, margin: {l: 72, r: 10, t: 12, b: 36}}), plotConfig);
        $('monthly-chart').setAttribute('aria-label', `${kind().toUpperCase()} · ${focused?.label || 'Todas las categorías'} · ${month()} ${data.year}: REAL ${fmt(series.actual[state.month - 1])}; PPTO ${fmt(series.budget[state.month - 1])} ${state.currency}`);
      }
      if (changed(['page', 'currency', 'month', 'sortKey', 'sortDirection', 'narrow'])) {
        const varianceLayout = plotLayout({...horizontal, xaxis: {...horizontal.xaxis}});
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = `12px ${varianceLayout.font.family}`;
        const labelSpace = Math.ceil(Math.max(...variance[0].text.map(text => measure.measureText(text).width))) + 8;
        // Reserve both bar ends without moving category labels or shrinking their font.
        varianceLayout.margin = {...horizontal.margin, l: horizontal.margin.l + labelSpace, r: horizontal.margin.r + labelSpace};
        varianceLayout.yaxis = {...horizontal.yaxis, ticklabelstandoff: horizontal.yaxis.ticklabelstandoff + labelSpace};
        await Plotly.react('variance-chart', variance, varianceLayout, plotConfig);
        stopAnnualObserver();
        const annualChart = $('annual-chart');
        const annualLayout = plotLayout({...horizontal, barmode: 'group', bargap: 0.22});
        const edgeLabelWidth = Math.max(...annual.flatMap(trace => trace.x).map(n => measure.measureText(fmt(n)).width));
        annualLayout.margin = {...horizontal.margin, r: Math.max(horizontal.margin.r, Math.ceil(edgeLabelWidth / 2) + 8)};
        annualLayout.xaxis = {...horizontal.xaxis, ...annualAxis(annualChart, annual, annualLayout)};
        await Plotly.react(annualChart, annual, annualLayout, plotConfig);
        observeAnnual(annualChart);
      } else if (changed(['category'])) {
        await Plotly.restyle('variance-chart', {'marker.opacity': [opacity]});
        await Plotly.restyle('annual-chart', {'marker.opacity': [opacity]});
      }
      rendered = snapshot;
      for (const id of ['variance-chart', 'annual-chart']) {
        $(id).removeAllListeners('plotly_click');
        $(id).on('plotly_click', event => {
          const category = event.points[0].customdata[1];
          toggleCategory(category);
        });
      }
    }
    return {summary, detailShell, detail, destroy: stopAnnualObserver};
  },
};
