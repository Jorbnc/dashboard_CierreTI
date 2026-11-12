# Dashboard Cierre TI

Repositorio de entrega independiente: **cuatro proyectos Power BI, un visual SDK compartido** y cuatro previews HTML locales. Estado: preparación y pruebas locales; apertura en Desktop y publicación en Service pendientes. Sin remoto configurado.

| Negocio | Proyecto | Preview privado | Enlace Service |
| --- | --- | --- | --- |
| Banco Ripley Chile | [banco_chile.pbip](powerbi/banco_chile/banco_chile.pbip) | `previews/banco_chile.html` | Pendiente de publicación |
| Banco Ripley Perú | [banco_peru.pbip](powerbi/banco_peru/banco_peru.pbip) | `previews/banco_peru.html` | Pendiente de publicación |
| Retail Chile | [retail_chile.pbip](powerbi/retail_chile/retail_chile.pbip) | `previews/retail_chile.html` | Pendiente de publicación |
| Retail Perú | [retail_peru.pbip](powerbi/retail_peru/retail_peru.pbip) | `previews/retail_peru.html` | Pendiente de publicación |

## Responsabilidades

- CierreGastosTI conserva Python, reglas financieras y assets originales. `src/shared/` es una copia sincronizada con huellas; no editarla aquí.
- Este repositorio mantiene el adaptador DataView, paquete SDK, definiciones PBIP, pruebas y entrega. No contiene una segunda implementación de cálculos financieros.
- `data/`, `previews/`, `.pbi/`, PBIX y XLSX son privados e ignorados. Los modelos importados en Desktop/Service sí contienen cifras; aplicar permisos por negocio en el workspace.
- `artifacts/cierre-gastos-ti.pbiviz` contiene código, estilos y marcas, no cifras del cierre. No usa endpoints ni Python dentro de Service.

## Preparar una entrega

Desde **CierreGastosTI**, con su entorno Python:

```bash
source activate_venv.sh
python tools/reportes_visuals/cierre_mensual/preparar_powerbi.py \
  --source input/dashboard_cierre_gastos_TI/2609_dashboard_data.xlsx \
  --deployment-dir deploy/dashboard_CierreTI
```

Revisar y resumir `previews/informe_generacion.md`. El comando verifica todos los negocios antes de escribir, copia los assets, genera cuatro JSON y cuatro HTML. No cambia proyectos guardados en Desktop ni publica. Usar una fuente explícita en cada cierre.

Desde **este repositorio**, Node >=22.13:

```bash
npm ci
npm test
npm run build
npm run test:visual
npm run package:projects
npm run check
```

La comprobación adicional `npm run check:schemas` descarga solo esquemas públicos de Microsoft y valida las definiciones localmente; no transmite datos ni reemplaza una apertura en Desktop.

La prueba de navegador necesita Chromium y Firefox de Playwright (`npx playwright install chromium firefox`). Usa datos sintéticos, un host simulado, el JS del paquete real y red bloqueada. No certifica el motor de Power Query/TMDL, los permisos del tenant ni Desktop/Service.

`package:projects` crea las definiciones solo si no existen; después actualiza los recursos de nuestro visual. Conserva rutas configuradas, diseños y versiones de esquema guardados por Desktop. `check` detecta enlaces incompatibles; no los repara silenciosamente. Un cambio de esquema de datos requiere migración explícita, no borrar y regenerar proyectos publicados.

La compilación registra sus entradas y la huella del paquete. Si código, dependencias o paquete cambiaron después, `package:projects` exige recompilar antes de instalar recursos; no atribuye fuentes nuevas a un binario antiguo. `npm run release:local` reúne pruebas, compilación, simulación, preparación y control, sin publicar ni hacer commit/push.

## Abrir y publicar

1. En Windows, obtener este repo privado y transferir **por canal autorizado** los JSON de `data/`. No agregar los JSON al commit.
2. Habilitar PBIP/TMDL/PBIR si la versión de Desktop lo requiere. Abrir primero `powerbi/banco_peru/banco_peru.pbip`.
3. En Transformar datos → Administrar parámetros, cambiar `pDataFile` a la ruta absoluta del JSON de ese negocio. `C:\CierreTI\data\banco_peru.json` es un valor inicial de ejemplo. Aplicar y actualizar.
4. Revisar Gastos TI, OPEX y CAPEX, mes, moneda y categorías. Banco Perú ofrece MSoles/MMCLP; los demás, MMCLP. Comprobar cifras contra el HTML de la misma generación.
5. Guardar, cerrar y reabrir el PBIP. Publicar manualmente al workspace autorizado y probar el reporte en Service. La política del tenant debe permitir este visual privado; no es un visual certificado.
6. Repetir con los otros tres PBIP. Cada uno tiene su propio modelo y solo importa su JSON; no usa un filtro visual como control de acceso.
7. Registrar los cuatro enlaces de reporte en la tabla anterior. No usar «Publicar en web». No crear un remoto ni hacer push sin confirmar URL privada y permisos.

## Actualización por cierre

Regenerar los JSON con Python, revisar el informe, reemplazar los archivos privados en Windows, actualizar cada modelo en Desktop y volver a publicar al mismo destino. Mantener IDs y nombres para conservar los enlaces. El FCST anual corresponde al cierre fuente; cambiar el mes dentro del visual no reconstruye proyecciones pasadas.

No programar refresh en Service contra `File.Contents` de una ruta personal: este flujo es manual. SharePoint/gateway y automatización son una fase posterior. Un push a GitHub no actualiza datos ni publica reportes.

Para cambios de interfaz o adaptador: sincronizar, probar, incrementar versión del visual, compilar, instalar el paquete en los cuatro proyectos, abrir/validar en Desktop y publicar. Versionar definiciones y `artifacts/` en un commit coherente; no incluir cachés ni capturas con datos.

## Controles y límites

Se exige un negocio/cierre/fuente, monedas admitidas, identificadores únicos, doce meses por serie, ventanas REAL/FCST válidas y cuadraturas por nivel. `expected_rows` detecta filtros externos o entregas parciales; los filtros mes/categoría se manejan dentro del visual. Subtotales y categorías no deben sumarse conjuntamente como una tabla transaccional.

Las irregularidades conocidas se revisan en el informe privado: histórico Retail ausente, excepción autorizada en Banco Perú y subtotales auxiliares no conciliados. No se incrustan advertencias financieras en la interfaz ni se ocultan errores de carga.

El SDK puede advertir sobre funciones opcionales de visuales públicos (selección cruzada, formato, exportación). Aquí el reporte usa un visual de página completa con controles propios. El auditor npm registra dependencias de desarrollo con avisos; revisar antes de actualizar el SDK. No ejecutar `audit fix --force` sin una validación completa.

## Evidencia local inicial

Comprobado el 12/11/2026: siete pruebas de contrato; paquete SDK en Chromium y Firefox con los cuatro negocios, dos instancias aisladas, navegación, redimensionado, texto hostil y carga parcial; 32 definiciones contra ocho esquemas Microsoft. La exportación/reconstrucción conserva exactamente las 3.792 posiciones monetarias de los cuatro HTML de referencia (incluidos nulos). La fuente y el HTML histórico alternativo conservan sus hashes.

El repositorio analítico pasó 74 pruebas Python y la regresión de 94 pruebas de interfaz. La guía del área pasó construcción, enlaces y cuatro pruebas de navegador. Son evidencias locales, no ejecución de Desktop/Service. No se incluyen cifras privadas ni capturas reales en este repositorio. `npm audit --omit=dev` no reportó vulnerabilidades de producción; el SDK conserva diez avisos moderados en dependencias de desarrollo.
