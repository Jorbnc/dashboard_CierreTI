import powerbi from 'powerbi-visuals-api';
import {markup, styles, brands} from './generated/ui';
import {fromDataView, fromRows} from './adapter';
import {snapshot} from './generated/source';
import mount = require('./generated/app');
import model = require('./generated/model');
import classic = require('./generated/classic');
import proposal = require('./generated/proposal');
import pdf = require('./generated/pdf');
import * as pdfLib from 'pdf-lib';
import Plotly = require('plotly.js-dist-min');
import * as lucide from 'lucide';
import '../style/visual.less';

export class Visual implements powerbi.extensibility.visual.IVisual {
  private host: powerbi.extensibility.visual.IVisualHost;
  private container: HTMLElement;
  private content: HTMLElement;
  private app: ReturnType<typeof mount> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private revision = 0;
  private destroyed = false;
  private business = '';

  private pdfDelivery() {
    const service = this.host.downloadService;
    return {
      async check() {
        if (!service?.exportStatus || !service.exportVisualsContentExtended) return 'Este visor no admite la descarga de PDF.';
        const status = await service.exportStatus();
        if (status === powerbi.PrivilegeStatus.Allowed) return null;
        return status === powerbi.PrivilegeStatus.DisabledByAdmin
          ? 'La organización no permite descargas desde visuales personalizados.'
          : 'La descarga desde este visual no está habilitada en Power BI.';
      },
      async save(bytes: Uint8Array, name: string) {
        if (bytes.byteLength > 30000000) throw new Error('El PDF supera el límite de descarga.');
        const blocks: string[] = [];
        for (let i=0; i<bytes.length; i+=8192) blocks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
        const result = await service.exportVisualsContentExtended(btoa(blocks.join('')), name, 'base64', 'Vista del cierre de gastos TI (PDF)');
        return result.downloadCompleted;
      },
    };
  }

  private async unmount(): Promise<void> {
    const app = this.app;
    this.app = null;
    await app?.destroy();
  }

  constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
    if (!options) throw new Error('Se requiere el contenedor y host de Power BI.');
    this.host = options.host;
    this.container = document.createElement('div');
    this.container.style.cssText = 'width:100%;height:100%;overflow:hidden;';
    options.element.append(this.container);
    const shadow = this.container.attachShadow({mode: 'open'});
    const style = document.createElement('style');
    // Plotly installs core rules on the document. Mirror those rules into the isolation boundary.
    const plotlyStyle = document.getElementById('plotly.js-style-global') as HTMLStyleElement | null;
    const plotlyCss = Array.from(plotlyStyle?.sheet?.cssRules || []).map(rule => rule.cssText).join('\n');
    style.textContent = plotlyCss + '\n' + styles;
    this.content = document.createElement('div');
    this.content.className = 'cierre-app';
    this.content.dataset.summaryLayout = 'proposal';
    shadow.append(style, this.content);
    this.content.textContent = snapshot ? 'Cargando cierre...' : 'Vincular las series mensuales del negocio.';
  }

  public update(options: powerbi.extensibility.visual.VisualUpdateOptions): void {
    this.container.style.width = Math.max(0, options.viewport.width) + 'px';
    this.container.style.height = Math.max(0, options.viewport.height) + 'px';
    // A snapshot must also mount on an initial resize/format update with no DataView.
    const dataChange = snapshot ? !this.app : !!(options.type & powerbi.VisualUpdateType.Data);
    const revision = dataChange ? ++this.revision : this.revision;
    this.queue = this.queue.then(async () => {
      if (this.destroyed || revision !== this.revision) return;
      this.host.eventService?.renderingStarted(options);
      try {
        if (!dataChange && this.app) { await this.app.resize(); }
        else if (dataChange) {
          const saved = this.app?.state();
          await this.unmount();
          this.content.replaceChildren();
          const view = options.dataViews?.[0];
          if (!snapshot && view?.metadata?.segment) {
            this.content.textContent = 'Recibiendo las series completas…';
            if (!this.host.fetchMoreData(true)) throw new Error('Entrega incompleta; no se muestran totales parciales.');
          } else {
            const data = snapshot ? fromRows(snapshot.rows) : fromDataView(view);
            if (snapshot && data.business !== snapshot.business) throw new Error('Snapshot de otro negocio.');
            if (revision !== this.revision || this.destroyed) return;
            this.content.dataset.brand = data.brand;
            const country = data.business.endsWith('peru') ? 'peru' : 'chile';
            const countryName = country === 'peru' ? 'Perú' : 'Chile';
            const bank = data.brand === 'bank';
            const units = [data.default_currency, ...Object.keys(data.currencies).filter(u => u !== data.default_currency)];
            const replacements: Record<string, string> = {
              ENTITY: data.entity,
              IDENTITY: 'members' in data ? `<h1>${data.entity}</h1>` : `<img class="country-flag" src="${brands[country]}" alt="${countryName}" width="40" height="34"><h1>${bank ? 'Banco Ripley' : 'Retail'}</h1>`,
              BRAND: (data.brand === 'corp' ? ['bank', 'retail'] : [data.brand]).map(brand => {
                const isBank = brand === 'bank';
                const scopeAttr = data.brand === 'corp' ? ` data-scope-logo="${brand}"` : '';
                return `<img class="${brand}-logo"${scopeAttr} src="${isBank ? brands.bank : brands.retail}" alt="${isBank ? 'Banco Ripley' : 'Ripley'}" width="${isBank ? 88 : 180}" height="${isBank ? 88 : 67}">`;
              }).join(''),
              CURRENCY: units.length > 1 ? `<div class="currency" role="group" aria-label="Moneda">${units.map(u => `<button type="button" data-currency="${u}">${u}</button>`).join('')}</div>` : '<span class="fixed-currency">MMCLP</span>',
            };
            // Identity and currencies are allow-listed by the adapter; financial text is escaped by the renderer.
            // eslint-disable-next-line powerbi-visuals/no-inner-outer-html -- Static markup and allow-listed identities only.
            this.content.innerHTML = markup.replace(/\/\*__(ENTITY|IDENTITY|BRAND|CURRENCY)__\*\//g, (_, key) => replacements[key]);
            this.app = mount(this.content, data, {model, classic, proposal, plotly: Plotly, icons: lucide, pdf, pdfLib,
              delivery: ['banco_chile', 'banco_peru'].includes(data.business) && !snapshot ? this.pdfDelivery() : null}, this.business === data.business ? saved : {});
            this.business = data.business;
            await this.app.ready;
          }
        }
        if (this.content.querySelector('[role="alert"]')) throw new Error('No se pudo renderizar el reporte.');
        this.host.eventService?.renderingFinished(options);
      } catch (error) {
        try {await this.unmount();} catch { /* Keep the update queue usable after cleanup failure. */ }
        this.content.textContent = error instanceof Error ? error.message : 'No se pudo cargar el reporte.';
        this.host.eventService?.renderingFailed(options, 'Datos incompletos o contrato inválido.');
      }
    });
  }
  public getFormattingModel(): powerbi.visuals.FormattingModel { return {cards: []}; }
  public destroy(): void {
    this.destroyed = true; this.revision++;
    void this.queue.finally(async () => {
      try {await this.unmount();} finally {this.container.remove();}
    }).catch(() => {this.container.remove();});
  }
}
