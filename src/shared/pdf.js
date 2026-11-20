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
})({async create(root, lib, state, current) {
  const doc = root.ownerDocument;
  const ensureCurrent = () => {if (!current()) throw new Error('Vista modificada');};
  await doc.fonts.ready;
  ensureCurrent();
  const width = root.clientWidth, height = root.scrollHeight;
  if (!width || !height) throw new Error('Vista sin dimensiones');
  // Keep the active layout's CSS pixels. Increase only the raster resolution.
  const scale = Math.min(2, 8192 / Math.max(width, height), Math.sqrt(16000000 / (width * height)));
  if (scale < 1) throw new Error('Vista demasiado grande para capturarla sin recortes');

  const standalone = root === doc.body;
  const styles = standalone ? [...doc.querySelectorAll('head style')] : [...root.getRootNode().children].filter(n => n.tagName === 'STYLE');
  // The SVG image viewport can differ from the host at 2x. Keep the host's breakpoints.
  const screenRules = rules => [...rules].map(rule => rule.type === CSSRule.MEDIA_RULE
    ? (doc.defaultView.matchMedia(rule.conditionText).matches ? screenRules(rule.cssRules) : '')
    : rule.cssText).join('\n');
  const css = styles.map(style => screenRules(style.sheet.cssRules)).join('\n');
  if (!css) throw new Error('Estilos del dashboard no disponibles');
  const copy = root.cloneNode(false);
  // Never clone the inline workbook payload, JS bundles or off-screen Plotly measurement nodes.
  for (const child of root.children) {
    if (child.matches('.navigation, .masthead, main, footer')) copy.append(child.cloneNode(true));
  }
  copy.querySelectorAll('template, script, .hoverlayer > *, .modebar-container').forEach(n => n.remove());
  const download = copy.querySelector('#download-pdf');
  download.disabled = false;
  download.removeAttribute('aria-busy');
  copy.querySelector('#month-options').hidden = true;
  copy.querySelector('#month').setAttribute('aria-expanded','false');
  const wrap = root.querySelector('.table-wrap');
  if (wrap) {
    Object.assign(copy.querySelector('.table-wrap').style, {overflow:'hidden', height:wrap.getBoundingClientRect().height+'px'});
    if (wrap.scrollLeft) copy.querySelector('#category-table').style.transform = 'translateX(-' + wrap.scrollLeft + 'px)';
  }
  Object.assign(copy.style, {width: width+'px', height: height+'px', overflow:'hidden', margin:'0'});
  const html = doc.createElement('html'), head = doc.createElement('head'), style = doc.createElement('style');
  html.lang = 'es';
  style.textContent = css; head.append(style); html.append(head);
  if (standalone) html.append(copy);
  else {
    const body = doc.createElement('body'); body.style.margin = '0'; body.append(copy); html.append(body);
  }
  const markup = new XMLSerializer().serializeToString(html);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><foreignObject width="100%" height="100%">'+markup+'</foreignObject></svg>';
  const image = new Image();
  await new Promise((ok,fail) => {
    image.onload = ok; image.onerror = fail;
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  ensureCurrent();
  const canvas = doc.createElement('canvas');
  canvas.width = Math.round(width*scale); canvas.height = Math.round(height*scale);
  let bytes;
  try {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
    if (!blob) throw new Error('No se obtuvo la imagen del dashboard');
    bytes = await blob.arrayBuffer();
  } finally { canvas.width = canvas.height = 0; }

  ensureCurrent();
  const pdf = await lib.PDFDocument.create();
  pdf.setTitle(state.entity + ' | ' + root.querySelector('#page-title').textContent);
  pdf.setSubject([state.currency,root.querySelector('#detail-focus')?.textContent].filter(Boolean).join(' · '));
  const page = pdf.addPage([width*.75,height*.75]);
  page.drawImage(await pdf.embedPng(bytes),{x:0,y:0,width:page.getWidth(),height:page.getHeight()});
  const view = {summary:'Gastos_TI',opex:'OPEX',capex:'CAPEX'}[state.page];
  const period = state.year + '-' + String(state.month).padStart(2,'0');
  return {bytes:await pdf.save(), filename:[state.business,view,period,state.currency].join('_')+'.pdf'};
}});
