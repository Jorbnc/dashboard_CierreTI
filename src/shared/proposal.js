/* Optional presentation features; all source amounts and financial windows remain unchanged. */
globalThis.CierreProposal = {
  visibleSign(value, decimals = 3) {
    if (!Number.isFinite(value) || Math.abs(value) < 0.5 * 10 ** -decimals) return 'neutral';
    return value > 0 ? 'bad' : value < 0 ? 'good' : 'neutral';
  },
  create({data, state, model, month, months, closure, fmt, pct, signed, escape}) {
    const gapHelp = m => `<p class="tooltip-section">Brecha = Uso − Esperado (puntos porcentuales)</p><p class="tooltip-formula">${Number.isFinite(m.usage) && Number.isFinite(m.expected)
      ? `${pct(m.usage)} − ${pct(m.expected)} ≈ <b>${signed(m.usage - m.expected, pct).replace('%', ' p.p.')}</b>`
      : 'N/D: El PPTO anual no es positivo.'}</p><p>La variación frente al PPTO acumulado usa otro denominador: ${signed(model.relative(m.actualYtd, m.budgetYtd), pct)}.</p>`;
    function monthlyTraces(traces, series) {
      traces.forEach((trace, index) => {
        const scenario = index === 0 ? `REAL ${data.year}` : index === 1 ? `FCST ${data.year}` : index === 2 ? `PPTO ${data.year}` : `REAL ${data.year - 1}`;
        trace.customdata = trace.y.map((value, i) => [fmt(value), signed(value - series.budget[i]), signed(model.relative(value, series.budget[i]), pct)]);
        trace.hovertemplate = `${scenario}: %{customdata[0]}${index < 2 ? '<br>Variación vs. PPTO: %{customdata[1]} (%{customdata[2]})' : ''}<extra></extra>`;
      });
      return traces;
    }
    const varianceText = row => `<b>${escape(row.label)} · ${state.currency}</b><br>Enero–${month().toLowerCase()} ${data.year}<br>REAL: ${fmt(row.m.actualYtd)}<br>PPTO: ${fmt(row.m.budgetYtd)}<br>Desviación: ${signed(row.m.actualYtd - row.m.budgetYtd)} (${signed(row.m.ytdPercent, pct)})`;
    const monthlyLayout = (kind, label) => ({hovermode: 'x unified', hoverlabel: {bgcolor: '#fff', bordercolor: '#d9d0e6', font: {family: 'Segoe UI, Arial, sans-serif', size: 12, color: '#2b2340'}},
      xaxis: {unifiedhovertitle: {text: `<b>Mes %{x} · ${data.year} · ${kind.toUpperCase()} · ${state.currency}</b><br>${escape(label)}`}}});
    return {gapHelp, monthlyTraces, varianceText, monthlyLayout};
  },
};
