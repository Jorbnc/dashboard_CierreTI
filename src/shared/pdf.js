/*!
 * Bundled PDF components (MIT):
 * pdf-lib (c) 2019 Andrew Dillon; @pdf-lib/standard-fonts (c) 2018 Andrew Dillon;
 * @pdf-lib/upng (c) 2017 Photopea; pako (c) 2014-2017 Vitaly Puzrin and Andrei Tuputcyn.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/* Print the rendered selection, not the source workbook or another financial model. */
'use strict';
(function expose(api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else globalThis.CierrePDF = api;
})({async create(root, lib, plotly, state, current) {
  const $ = selector => root.querySelector(selector);
  const all = (selector, node = root) => [...node.querySelectorAll(selector)];
  const text = node => (node?.innerText || '').trim().replace(/\u00a0/g, ' ').replace(/−/g, '-').replace(/Δ%/g, 'Var.%');
  const oneLine = value => value.replace(/\s+/g, ' ').trim();
  const ensureCurrent = () => {if (!current()) throw new Error('Vista modificada');};
  const pdf = await lib.PDFDocument.create();
  const regular = await pdf.embedFont(lib.StandardFonts.Helvetica);
  const bold = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  const ink = lib.rgb(.13,.10,.20), purple = lib.rgb(.30,.16,.44), muted = lib.rgb(.33,.32,.39);
  const tint = lib.rgb(.95,.93,.97), rule = lib.rgb(.86,.84,.89);
  const [W,H] = lib.PageSizes.A4.slice().reverse(), M = 28, area = W - 2*M;
  const title = text($('#page-title')), focus = text($('#detail-focus'));
  const unit = text($('#unit-label')), source = text($('#footer-cutoff')).split(' · ')[0];
  const heading = state.entity + '  |  ' + title;
  pdf.setTitle(heading);
  pdf.setSubject([unit, focus].filter(Boolean).join(' · '));
  let page;
  const draw = (str, x, y, size = 10, font = regular, color = ink) =>
    page.drawText(str, {x, y: H-y-size, size, font, color});
  const line = (x1,y,x2,color = rule) =>
    page.drawLine({start: {x:x1,y:H-y}, end: {x:x2,y:H-y}, thickness:.7, color});
  const rect = (x,y,w,h,color) => page.drawRectangle({x,y:H-y-h,width:w,height:h,color});
  function wrap(str, width, size, font = regular) {
    return str.split(/\n+/).flatMap(paragraph => {
      const rows = [];
      let row = '';
      for (const word of paragraph.trim().split(/\s+/)) {
        if (row && font.widthOfTextAtSize(row + ' ' + word, size) > width) {rows.push(row); row = '';}
        row += (row ? ' ' : '') + word;
      }
      rows.push(row);
      return rows;
    });
  }
  function newPage() {
    ensureCurrent();
    page = pdf.addPage([W,H]);
    rect(0,0,W,5,purple);
    draw(state.entity, M, 15, 11, bold, purple);
    draw(title, M, 33, 19, bold);
    const detail = [unit, 'Cierre fuente: ' + source, focus].filter(Boolean).join('   |   ');
    draw(detail, M, 61, 10, regular, muted);
    line(M, 81, W-M);
  }
  function summary() {
    const bands = all('.summary-section'), cols = all('.column-heads > div > span');
    if (cols.length !== 5 || bands.length !== 3) throw new Error('Resumen incompleto');
    const w = area / cols.length;
    cols.forEach((c,i) => wrap(oneLine(c.textContent), w-12, 11, bold)
      .forEach((s,j) => draw(s, M+i*w+5, 94+j*14, 11, bold, purple)));
    let y = 133;
    for (const band of bands) {
      const cards = all('.kpi-card', band);
      if (cards.length !== cols.length) throw new Error('Indicadores incompletos');
      rect(M, y, area, 20, tint);
      draw(band.getAttribute('aria-label'), M+5, y+4, 10, bold, purple);
      let bottom = y+84;
      cards.forEach((c,i) => {
        const x = M+i*w+5, value = c.querySelector('.kpi-value');
        const unitNode = value.querySelector('small');
        const primary = unitNode ? value.firstChild.textContent.trim() + ' ' + text(unitNode) : oneLine(text(value));
        draw(primary, x, y+27, 17, bold);
        let cy = y+53;
        for (const node of all('.kpi-sub, .delta-row, .delta.neutral:not(.delta-row .delta), .quiet-note', c)) {
          const str = node.classList.contains('delta-row') ? oneLine(text(node)) : text(node);
          for (const row of wrap(str, w-12, 9)) {draw(row, x, cy, 9, regular, muted); cy += 12;}
        }
        bottom = Math.max(bottom, cy);
      });
      y = bottom+15;
    }
  }
  // Export only chart marks/labels. Rasterize a self-contained SVG as a data URI;
  // a blob-origin SVG can taint canvas inside Power BI's opaque-origin iframe.
  async function figure(id, x, top, width, pxWidth, pxHeight) {
    ensureCurrent();
    const panel = $('#' + id + '-panel'), graph = panel.querySelector('.js-plotly-plot');
    if (!graph?.data?.length) throw new Error('Gráfico incompleto');
    const headingLines = wrap(text(panel.querySelector('h3')), width, 12, bold);
    for (const row of headingLines) {draw(row, x, top, 12, bold, purple); top += 15;}
    const period = oneLine(text(panel.querySelector('.period-note')));
    if (period) {draw(period, x, top, 9, regular, muted); top += 15;}
    const svg = await plotly.toImage(graph, {format:'svg', width:pxWidth, height:pxHeight});
    ensureCurrent();
    const img = new Image();
    await new Promise((ok, fail) => {img.onload = ok; img.onerror = fail; img.src = svg;});
    const canvas = root.ownerDocument.createElement('canvas');
    canvas.width = pxWidth*2; canvas.height = pxHeight*2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const png = await pdf.embedPng(canvas.toDataURL('image/png'));
    const h = width*pxHeight/pxWidth;
    page.drawImage(png,{x,y:H-top-h,width,height:h});
    top += h+4;
    let lx = x;
    for (const entry of all('.legend > span', panel)) {
      const swatch = entry.querySelector('.swatch');
      const label = oneLine(text(entry)), length = 19+regular.widthOfTextAtSize(label,9);
      if (lx+length > x+width) {lx=x; top+=13;}
      const color = lib.componentsToColor(getComputedStyle(swatch).getPropertyValue('--color').trim()
        .match(/^#([0-9a-f]{6})$/i)?.[1].match(/../g).map(v=>parseInt(v,16)/255) || [.3,.2,.4]);
      if (swatch.classList.contains('line')) page.drawLine({start:{x:lx,y:H-top-6},end:{x:lx+10,y:H-top-6},thickness:1.5,color,dashArray:swatch.classList.contains('dotted')?[2,2]:undefined});
      else rect(lx,top+2,9,7,color);
      draw(label,lx+13,top,9); lx+=length+7;
    }
    top+=17;
    const note = text(panel.querySelector('.legend-note'));
    if (note) for (const row of wrap(note,width,9)) {draw(row,x,top,9,regular,muted); top+=12;}
    return top;
  }
  function table(top) {
    const node = $('#category-table'), head = [...node.tHead.rows[0].cells].map(c => c.querySelector('.sort-button span'));
    const records = [...node.tBodies[0].rows, ...node.tFoot.rows];
    if (head.length !== 9 || !records.at(-1)?.hasAttribute('data-row-total')) throw new Error('Tabla incompleta');
    const first = 146, col = (area-first)/(head.length-1);
    const section = text($('#execution-panel h3')) + ' (' + state.currency + ')';
    function header() {
      draw(section,M,top,12,bold,purple); top+=20;
      rect(M,top,area,31,tint);
      head.forEach((item,i) => {
        const x = i ? M+first+(i-1)*col : M;
        const label = item.firstChild.textContent.replace(/Δ%/g,'Var.%');
        draw(label,x+4,top+4,9,bold,purple);
        const period = text(item.querySelector('small')); if (period) draw(period,x+4,top+17,8,regular,muted);
      });
      top+=31;
    }
    if(top+90 > H-35) {newPage(); top=92;}
    header();
    for (const row of records) {
      const strong = row.hasAttribute('data-row-total') || row.classList.contains('selected');
      const font = strong ? bold : regular;
      const labels = wrap(text(row.cells[0]),first-12,10,font);
      const h = Math.max(17,labels.length*12+4);
      if (top+h > H-33) {newPage(); top=92; header();}
      if (strong) rect(M,top,area,h,tint);
      labels.forEach((s,j)=>draw(s,M+4,top+2+12*j,10,font));
      [...row.cells].slice(1).forEach((cell,i)=>{
        const s = text(cell);
        draw(s,M+first+(i+1)*col-5-font.widthOfTextAtSize(s,10),top+2,10,font);
      });
      top+=h; line(M,top,M+area);
    }
  }
  newPage();
  if (state.page === 'summary') summary();
  else {
    const y = await figure('monthly',M,92,area,1080,235);
    table(y+11);
    newPage();
    const w=(area-18)/2;
    const h=Math.max(300, Math.min(550, 88+all('#category-table tbody tr').length*31));
    await figure('variance',M,96,w,525,h);
    await figure('annual',M+w+18,96,w,525,h);
  }
  const pages=pdf.getPages();
  pages.forEach((p,i) => {page=p; line(M,H-25,W-M); draw('Cierre mensual TI',M,H-21,8,regular,muted); draw((i+1)+' / '+pages.length,W-M-25,H-21,8,regular,muted);});
  ensureCurrent();
  return {bytes:await pdf.save(), filename:[state.business, {summary:'Gastos_TI',opex:'OPEX',capex:'CAPEX'}[state.page],
    state.year+'-'+String(state.month).padStart(2,'0'),state.currency].join('_')+'.pdf'};
}});
