# Dashboard Cierre TI

Un repositorio independiente, un visual SDK compartido **sin cifras incrustadas** y cuatro PBIP: Banco Chile, Banco Peru, Retail Chile y Retail Peru. El flujo predeterminado es **XLSX directo con Power Query M** en `powerbi/`. Windows usa solo **Git Bash + Power BI Desktop**, sin Python, Node ni manejo regular de JSON.

El usuario confirmo **funcionamiento en Desktop el 16/11/2026**, tras retirar hashes y corregir `pWorkbookPath`; despues informo acceso de un destinatario a Service con un problema del selector en Opera. No equivale a aceptacion financiera y funcional exhaustiva de los cuatro modelos. El parser oficial Power Query en Linux valida sintaxis, no ejecucion. La evidencia snapshot `2609-v0.2.0.1` es de otra via, no prueba de XLSX nativo.

## Preparar en Linux

### Descarga de PDF en bancos (0.1.0.9)

`Descargar PDF` guarda solo Gastos TI, OPEX o CAPEX con el mes, moneda, categoría y orden actuales. El PDF se genera en memoria, sin servicio externo. En Desktop/Service se entrega exclusivamente por la [File Download API](https://learn.microsoft.com/en-us/power-bi/developer/visuals/file-download-api): requiere permiso del tenant y consentimiento del usuario; denegarlo no bloquea el reporte. El menú nativo Exportar no cambia.

En Linux, después de preparar los dos bancos, compilar y probar el visual, usar `npm run package:projects -- --business banco_chile banco_peru` y `npm run check`. El manifiesto registra ambos bancos; Retail sigue en 0.1.0.7. En Windows, sincronizar con Desktop cerrado, probar CAPEX del mes en cada PBIP y republicar para verificar la descarga con un lector en Service. No cambiar modelo ni parámetro por este ajuste.

### Nombres activos y formato anterior (0.1.0.8)

**0.1.0.8:** solo en Banco Chile y Banco Peru, OPEX/CAPEX muestran `Ejecución y desviación` y `Ppto FY vs Forecast FY vs Real acumulado`, sin el prefijo `Categoría Comité` ni su separador. No cambiaron datos, filtros ni categorias.

En Windows, sincronizar con Desktop cerrado, abrir los PBIP existentes, comprobar los titulos en OPEX/CAPEX, Guardar y republicar los bancos. Mantener `pWorkbookPath`; Actualizar solo si falta cache o se cambia la fuente. No requiere nuevos PBIP ni descarga PBIX. La validacion local no sustituye la comprobacion en Desktop/Service.

Validacion 0.1.0.8: 93 pruebas Python, 33 Node, 10 pruebas HTML y simulacion del paquete SDK en Chromium/Firefox. Datos identicos; ambos bancos contienen exactamente el paquete compilado. Solo cuatro recursos bancarios del visual cambiaron dentro de los PBIP; los otros 60 archivos y Retail permanecen intactos. MkDocs verificado.

Banco Chile usa **Gastos TI BR CL.pbip** y Banco Peru **Gastos TI BR PE.pbip**, con sus carpetas homonimas `.Report` y `.SemanticModel` dentro de la carpeta tecnica del negocio. Se retiran los antiguos `banco_chile.*` y `banco_peru.*`, no objetos de Service. `tools/project-paths.cjs` conserva las claves financieras y dirige los generadores a los proyectos guardados por Desktop, sin reconstruirlos ni sustituir sus identidades.

El visual **0.1.0.7** retira el indicador **Fuente XLSX: [Mes] [Ano]** en las tres paginas de Banco Chile y Banco Peru, tanto en HTML como en Power BI. Conserva moneda/escala, selector y referencias al periodo; no cambia cifras, modelos ni parametros. Retail conserva el indicador azul `#237bb5` con texto blanco y fecha del cierre fuente, no del mes seleccionado. **Retail queda en espera:** mantiene ambos nombres y modelos separados, sin fusionarse ni publicarse automaticamente.

Validacion local 0.1.0.7: 88 pruebas Python, 32 Node, 20 pruebas HTML (2610 y regresion aislada 2609), dos pruebas documentales y simulacion del paquete SDK en Chromium/Firefox. Se comprobaron paginas, meses, monedas y escritorio/movil. Los cuatro datasets y el XLSX permanecen identicos; dentro de los PBIP solo cambiaron los ocho recursos del visual, conservando los otros 56 archivos. Desktop/Service sigue requiriendo comprobacion tras sincronizar y republicar.

### Procedimiento de renombre

El usuario confirma que el recorrido **Service -> descarga PBIX -> Desktop -> guardado PBIP** conserva enlaces y permisos compartidos. Esta es evidencia reportada de los casos realizados, no una garantia universal ni la aceptacion cloud de cada nueva compilacion. Cambiar solo `displayName` no resolvio el intento anterior; no se toma como procedimiento suficiente.

1. Registrar enlace, IDs y permisos actuales; renombrar el reporte y modelo existentes en Service.
2. Descargar el PBIX del reporte renombrado, abrirlo en Desktop y guardar como PBIP en la carpeta de su negocio. Conservar el anterior hasta comprobar el nuevo proyecto y su modelo local.
3. Revisar definiciones, conexiones, `pWorkbookPath`, identidades y cifras; incorporar solo archivos versionables. Actualizar `tools/project-paths.cjs` y retirar el PBIP anterior con sus carpetas una vez validado. No copiar identidades del proyecto retirado sobre el nuevo.
4. Sincronizar los cambios de codigo entre Windows y Linux con revision y commits acotados, sin PBIX, XLSX, `.pbi/` ni cifras. No se hace push automatico.
5. Abrir el PBIP activo, guardar y publicar al workspace original verificando destino/reemplazo. Comprobar el enlace previamente compartido, ausencia de duplicados, IDs/asociacion y acceso de un destinatario con sus permisos anteriores. Si el destino es dudoso, cancelar; no borrar el objeto original.

La descarga se realiza para el renombre, **no para cada actualizacion**. Tras sincronizar 0.1.0.7 con Desktop cerrado, verificar la ausencia del indicador en los bancos, los controles y cifras, Guardar y republicar los bancos. Un clon sin cache requiere Refresh. Retail permanece en espera. `release:local` prepara los cuatro proyectos en Linux sin publicar; `package:projects` y `configure:xlsx` tambien admiten `--business <negocio>` para entregas acotadas.

Los proyectos guardados por Desktop referencian `report/3.4.0` y `visualContainer/2.14.0`. Si sus URLs oficiales siguen devolviendo 404, `check:schemas` no puede completarse: registrar la limitacion sin rebajar versiones ni declarar esos archivos validados. Las pruebas Linux no sustituyen Desktop/Service.

Comprobacion local de 0.1.0.6: 29 pruebas Node y el paquete real en Chromium/Firefox correctos; 56 archivos PBIP/definiciones conservados byte por byte y cuatro datasets numericamente identicos. Los recursos SDK son la unica modificacion dentro de los proyectos retenidos. La comprobacion adicional de esquemas valida 36 definiciones; otras cuatro (dos por banco) quedan pendientes por los 404 anteriores. La nueva publicacion y sus permisos se verifican en Windows/Service, no desde estas pruebas.

### Migracion 0.1.0.3: MMCLP en millones

En los cuatro dashboards **MMCLP = millones de CLP**; **MSoles = miles de soles** se mantiene en Banco Peru desde 0.1.0.2. Importes enteros, punto para miles y coma decimal en porcentajes. Python y M conservan los importes de ambos bloques, sin dividir nuevamente por 1.000. Historico, PPTO, FCST y ajustes usan la misma escala; los importes economicos y porcentajes no cambian. No se modifican las reglas de Comite canonico, Steerco ni Finbot. Consultar las referencias financieras privadas en `previews/`, nunca incorporarlas a Git.

Sincronizar modelo y visual juntos, revisar cambios Windows, confirmar `pWorkbookPath`, **Refresh, comprobar, Save y republicar los cuatro PBIP**. La cache CLP anterior esta en miles de millones y no debe reutilizarse con la nueva unidad. No se requiere otro XLSX ni Node/Python Windows. Los snapshots historicos conservan su escala/version congelada y no se sobrescriben.

La actualizacion **0.1.0.4**, incluida en 0.1.0.7, cambia solo la interfaz: **Millones de Pesos** como descripcion de MMCLP y etiquetas REAL/PPTO del mes seleccionado en la evolucion mensual de OPEX/CAPEX. Responden a mes, moneda y categoria; no cambian datos, M ni parametros. Desde 0.1.0.3 ya migrada, sincronizar con Desktop cerrado, comprobar, Save y republicar los negocios autorizados. Un clon sin cache requiere Refresh; para versiones anteriores aplicar la migracion de escala descrita arriba.

El mes usa un listbox dentro del visual, con clic y teclado, en lugar del select nativo. El usuario reporto un problema del desplegable en Service/Opera; no se ha demostrado su causa ni validado esta correccion en ese entorno. Probar tambien en Edge/Chrome, incluidos en la [lista oficial de navegadores soportados](https://learn.microsoft.com/en-us/power-bi/fundamentals/power-bi-browsers). No relajar el sandbox ni pedir habilitar popups.

Desde **CierreGastosTI**, seleccionar el agregado. La entrega bancaria vigente usa hoja `BASE` del archivo final (no la Base transaccional); los archivos anteriores usan `Comité`:

```bash
source activate_venv.sh
python tools/reportes_visuals/cierre_mensual/preparar_powerbi.py \
  --source input/datos/dashboard_cierre/2610_dashboard_data_final.xlsx \
  --deployment-dir deploy/dashboard_CierreTI \
  --business banco_chile banco_peru
```

Python sigue siendo referencia/generador Linux. Sincroniza `src/shared/` y genera JSON/HTML de los negocios seleccionados, `data/preparation.json` y `previews/informe_generacion.md`; sin `--business` prepara los cuatro. La preparacion y compilacion comparan bytes con copias privadas en `.tmp/preparation-reference/` y `.tmp/build-reference/`, sin hashes. Revisar excepciones, faltantes y discrepancias; no aprobar fallos fatales ni nuevas correcciones. Estos archivos son privados, no la fuente del modelo Windows.

Para instalacion inicial o cambios de UI/SDK, desde **este repositorio, solo Linux**, con Node >=22.13:

```bash
npm ci
npx playwright install chromium firefox
npm run release:local
npm run check:schemas
```

`release:local` prueba, compila e instala `artifacts/cierre-gastos-ti.pbiviz` sin datos. Su `package:projects` **ejecuta automaticamente `configure:xlsx`**: no se requiere un segundo comando. Migra solo particiones de origen y parametros/funciones M de los cuatro modelos existentes, preservando layout, identidades, enlaces y `pWorkbookPath` existente. Particiones personalizadas desconocidas deben revisarse, no sobrescribirse.

`npm run configure:xlsx` es opcional para refrescar solo el adaptador. `npm run test:powerquery` comprueba sintaxis con `@microsoft/powerquery-parser` y contratos locales, no el runtime M. La lectura usa solo `powerquery/fxCierreXlsx.pq` y `fxCierreSum.pq`. No se usan hashes en lectura, metadatos, visual ni entrega. La migracion retira funcion, columna y enlace obsoletos desde `0.1.0.1`; la entrega vigente `0.1.0.7` conserva esos 24 campos y usa las escalas indicadas arriba.

No ejecutar build/prepare/package simultaneos ni sincronizar datos/assets durante compilacion; `.tmp/build.lock` se comparte con snapshot y no se borra para forzar acceso. Un cambio mensual compatible de datos **no requiere recompilar el visual**.

## Sincronizar Linux a Windows

Git lleva solo codigo, plantillas y recursos compilados sin cifras. El XLSX y las referencias se reciben por un canal privado autorizado. El libro contiene cuatro negocios: solo para operadores autorizados para todos, no usuarios finales de uno.

En **Git Bash**, para un clon nuevo y codigo previamente aprobado/enviado:

```bash
git clone git@github.com:Jorbnc/dashboard_CierreTI.git
cd dashboard_CierreTI
git status --short
```

En clones existentes, cerrar Desktop y revisar cambios locales, rama y remoto antes de sincronizar. No borrar ni resetear trabajo Windows; conservar copias privadas. No se hace push automatico ni se han verificado permisos remotos. No ejecutar npm/Python en Windows ni transferir caches como sustituto de Refresh.

1. Recibir el XLSX explicito. El parametro conserva la ruta local anterior: para esta entrega bancaria cambiar el nombre a `2610_dashboard_data_final.xlsx` en cada PBIP (hoja `BASE`, todavia agregado). Usar ruta absoluta Windows, no `/c/...` de Git Bash. No se busca automaticamente el archivo mas reciente.
2. Abrir `powerbi/banco_peru/Gastos TI BR PE.pbip` **del clon raiz**, con sus carpetas `.Report` y `.SemanticModel`, no un PBIP de `releases/`.
3. En **Transformar datos > Administrar parametros**, confirmar o cambiar `pWorkbookPath`. Se configura una vez por PBIP mientras la ruta siga igual; si cambia el nombre mensual, cambia el parametro.
4. Aplicar y **Actualizar / Refresh**. Un clon fresco no contiene datos importados porque `.pbi/cache.abf` se excluye de Git. Si solo aparece `pDataFile`, revisar la migracion Linux, no introducir JSON en este flujo.
5. Comparar con el HTML del mismo XLSX: importes, precision, nulos, mes actual/anterior, Gastos TI/OPEX/CAPEX, categoria, orden, ambas monedas de Banco Peru, historia y CO. No dar por probada la paridad solo porque abra.
6. **Guardar / Save**, cerrar, reabrir y comprobar. Repetir carga y aceptacion en cada modelo que vaya a actualizarse.
7. Publicar manualmente solo los negocios autorizados al workspace correspondiente, **nunca Publicar en web**. Verificar cifras, enlace previo y permisos en Service; Retail permanece en espera. Guardar o hacer push no publica datos.

La ruta es editable por proyecto: se guarda en `definition/expressions.tmdl` de la carpeta `.SemanticModel` vinculada al PBIP (Banco Peru: `Gastos TI BR PE.SemanticModel`). El valor inicial para proyectos nuevos esta en `tools/configure-xlsx.cjs`; el generador conserva rutas existentes. `Cierre` usa `File.Contents(pWorkbookPath)`, sin otra carpeta fija. Si un error sigue mostrando la ruta anterior, revisar el valor actual en el PBIP abierto, aplicar/guardar y reabrir la revision sincronizada con Desktop cerrado. Cambiar un parametro no actualiza los otros tres proyectos. La ruta OneDrive es local y su disponibilidad se comprueba en Windows, no desde Linux.

| Negocio | Ruta desde este repositorio | Monedas | Service |
| --- | --- | --- | --- |
| Banco Chile | `powerbi/banco_chile/Gastos TI BR CL.pbip` | MMCLP | Renombrado por usuario; verificar nueva entrega al publicar |
| Banco Peru | `powerbi/banco_peru/Gastos TI BR PE.pbip` | MSoles y MMCLP | Renombrado por usuario; verificar nueva entrega al publicar |
| Retail Chile | `powerbi/retail_chile/retail_chile.pbip` | MMCLP | En espera; solo formato local |
| Retail Peru | `powerbi/retail_peru/retail_peru.pbip` | MMCLP | En espera; solo formato local |

Retail Peru no tiene bloque en soles en el agregado 2609: las filas 98-106 pertenecen a RETAIL y los rotulos Soles de la fila 57 corresponden a Banco Peru. No habilitar MSoles cambiando solo el boton ni aplicando el cambio bancario. Se requieren series Retail validadas o una politica de conversion aprobada, y ampliar coherentemente referencia Python, lector M, adaptador DataView y QA.

## Siguiente cierre

### Agregado 2610: lector actualizado, visual sin cambios

**Revision final aprobada el 20/11/2026:** solo `2610_dashboard_data_final.xlsx` usa hoja `BASE`. Se preservan sus nuevos importes de Core/Capex y distribucion mensual de PPTO. FCST mantiene C:N. El historico soles ya incluye No Direccionable: la excepcion interpreta sus fechas 2026 como 2025, valida detalle/subtotales/anuales y no suma de nuevo AW66:BH66. BI28 mal rotulado, K76 y defectos del FORECAST auxiliar se reportan fuera del HTML, sin correcciones implicitas. El XLSX permanece intacto; los parrafos siguientes describen la revision inicial.

Para instalar el lector final, `npm run package:projects`; no requiere recompilar el visual 0.1.0.7. Se conservan identidades, diseno, parametros locales y salidas Retail. Despues de la preparacion bancaria, el QA privado se regenera con `npm run qa:powerquery -- --business banco_chile banco_peru`; snapshot sigue exigiendo los cuatro negocios coherentes. En Windows, sincronizar con Desktop cerrado, seleccionar la ruta al archivo final en ambos PBIP, **Actualizar, verificar, Guardar y republicar**. No basta con cambiar el nombre del archivo o guardar una cache anterior. No se hace push/publicacion automatica; la validacion local no acredita Desktop/Service.

Validacion de la revision final: 93 pruebas Python y 33 Node; 1980 posiciones contra el XLSX y 360 tarjetas anuales en Chromium/Firefox, ademas de acumulados, porcentajes y curvas. Libros fuente intactos; regresiones 2609/2610 original sin cambios. Solo cuatro lectores M modificados dentro de los PBIP; los otros 60 archivos, parametros e identidades se conservan. QA privado bancario: 2640 posiciones monetarias, pendiente de ejecutar en Desktop. La evidencia siguiente corresponde a la politica anterior al archivo final.

Inspeccion del 17/11/2026: C:N (REAL + Proyeccion) y R:AC (PPTO) conservan posiciones y categorias. El historico bancario se movio a AW:BH, anual BI. `fxCierreXlsx` acepta las dos posiciones conocidas AJ/AV con etiqueta, fechas y cuadraturas estrictas; duplicados o errores historicos quedan N/D. Los diagnosticos no se muestran en el visual.

**FCST vigente desde el 19/11/2026:** los bancos usan Real + Proyeccion C:N completo: REAL hasta el cierre y proyeccion posterior (C:L y M:N en 2610). Reemplaza la seleccion de AQ:AR del 18/11. Categorias, tipos, Total y anuales se validan; tarjetas, comparaciones y graficos comparten estas series. AF:AS solo se audita, sin reconstruir AQ29 ni inferir AF6, y nunca es fallback de datos requeridos invalidos. No cambia REAL, PPTO, historia, 2609 o Retail. Consultar el informe privado de generacion; Actualizar en Desktop antes de guardar y republicar.

Validacion local de esta regla: 88 pruebas Python y 32 Node; 1980 posiciones bancarias contrastadas contra C:N/PPTO y 360 valores de cards anuales comprobados en Chromium/Firefox entre meses, monedas y tamanos, ademas de curvas mensuales/categorias. REAL, PPTO, historia, 2609 y Retail no cambian; solo cuatro expressions.tmdl dentro de los PBIP, sin modificar los otros 60 archivos. Pendientes de origen: conciliar REAL Peru entre monedas y corregir fechas/subtotales del historico soles. AQ29/AS29 y AF6 siguen como observaciones auxiliares, sin influir en el calculo. El parser M no ejecuta Desktop; las consultas QA privadas se regeneraron con la referencia vigente.

En 2610 el titulo del historico de Banco Peru en MSoles indica 2025, pero sus fechas siguen siendo 2026. El usuario autorizo una excepcion propia para este archivo: AW59:BH77 es REAL 2025, y AW66:BH66 (No Direccionable) se incorpora una vez al Capex/Total historico tras validar el subtotal original. Se exige fuente exacta, cierre 2026-10, entidad/moneda, encabezados AV58=2025 REAL y BI58=R25, meses ordenados y cuadraturas. No modifica el XLSX, importes 2026, PPTO ni FCST; no habilita historia por categoria ni hereda la excepcion a otros cierres. Los detalles quedan en previews/informe_generacion.md, fuera del visual. Retail sigue sin historico ni moneda adicional.

La actualizacion de datos 2610 instala el lector en los cuatro modelos con `npm run package:projects`, que invoca `configure:xlsx` y actualiza el manifiesto reutilizando el paquete compilado; no requirio recompilar el visual 0.1.0.6 entonces vigente. La version 0.1.0.7 es una actualizacion posterior de interfaz. Se conservan identidades, layout y `pWorkbookPath`. Sincronizar con Desktop cerrado, cambiar el parametro al XLSX privado **2610**, Actualizar, comprobar y Guardar; publicar solo los bancos autorizados. Retail permanece en espera. Los cambios de ruta no se aplican automaticamente en Linux.

Las referencias privadas de `data/`, `previews/` y las consultas opcionales de `data/qa/` corresponden a 2610. Python se contrasto directamente contra las celdas, incluyendo nulos; los tests de M en Linux validan sintaxis, no ejecutan el motor Desktop. Esta entrega no implica publicacion ni aceptacion Desktop/Service de octubre.

Evidencia inicial 2610: 3.792 posiciones monetarias comparadas directamente con el XLSX. Tras habilitar la historia en soles: 84 pruebas Python y 31 Node; 36 importes historicos mensuales y sus 36 acumulados contrastados con las celdas; 240 comparativos visibles verificados en Chromium/Firefox, escritorio/movil, meses y monedas, mas curvas historicas y exclusiones por categoria. Regresion 2609 sin cambios de payload; en 2610 solo cambia la historia MSoles de Banco Peru. Dentro de los PBIP solo se actualizaron los cuatro `expressions.tmdl`; los otros 60 archivos se conservaron byte por byte, incluidos parametros e identidades. `npm run check` confirma enlaces, recursos y funciones instaladas. Estas pruebas no ejecutan M ni sustituyen la comprobacion Desktop/Service.

### Operacion mensual

Recibir el nuevo `YYMM_dashboard_data.xlsx` por canal autorizado; actualizar `pWorkbookPath` en los PBIP que vayan a actualizarse, **Refresh, comprobar, Save y publicar manualmente**. Mantener Retail en espera hasta nueva indicacion. Sin cambios de UI/SDK no hay compilacion mensual en Linux ni Windows. Una correccion del mismo archivo requiere verificar procedencia/autorizacion, refrescar y republicar; cambiar parametro si cambia la ruta.

Esquema soportado estricto: un cierre desconocido requiere validacion estructural/financiera. Historia en soles y `No Direccionable` tienen autorizaciones individuales para `2609_dashboard_data.xlsx`/2026-09 y `2610_dashboard_data.xlsx`/2026-10: Banco Peru, MSoles, encabezados/rangos propios y cuadraturas. Esto no certifica identidad binaria del archivo ni autoriza otras correcciones. No inventar historia Retail, soles adicionales ni reclasificar CO. No hay SharePoint, gateway o refresh cloud configurados sobre la ruta local.

La hoja 2609 tiene dimension `B1:CB362`, comprobada con openpyxl. Solo se admite el origen conocido B1/B2 (`Pesos Chilenos`, `Real + Proyección`): si el host lo devuelve en `Column1`, se antepone A vacia; si lo devuelve en `Column2` con A vacia, se conserva. Cualquier otro origen falla, sin adivinar offsets. La confirmacion operativa no identifica cual representacion utilizo Desktop.

## Comprobaciones

QA exhaustivo **opcional**, desde Linux y con referencias Python coherentes ya preparadas:

```bash
npm run qa:powerquery
```

Genera `data/qa/<business>.pq` privados. En una copia de aceptacion Desktop, crear consulta en blanco, pegar el contenido en Editor avanzado, deshabilitar carga y evaluar. Compara los **24 campos**, nulos y numeros sin redondear (tolerancias `1e-10` absoluta y `1e-12` relativa): **3792 posiciones monetarias** entre cuatro negocios para 2609. Registrar resultados solo despues de ejecutarlos; **QA exhaustivo pendiente**. No son dependencias de produccion y nunca van a Git ni al modelo publicado.

Auditoria opcional previa a publicar: `= Value.Metadata(Cierre)[CierreDiagnostics]` en una consulta en blanco sin carga. Inspeccionar **inmediatamente el resultado del lector en el editor, antes de otras transformaciones**: `history_notes`, `source_findings` y ajustes por moneda en `currencies`. Si `Cierre` ya fue transformada, consultar el resultado original de `fxCierreXlsx`. Los metadatos pueden perderse y no se guardan automaticamente en el modelo; validar su forma en Desktop y conservar diagnosticos fuera del visual.

El codigo fuerza la auditoria Retail con `List.Buffer(Findings)`, aunque no se consulten metadatos. Evidencia local tras retirar hashes: 76 pruebas Python, 20 Node, visual 0.1.0.1 en Chromium/Firefox, 32 definiciones frente a 8 esquemas y MkDocs estricto. La correccion posterior de ruta elevo Node a 21 pruebas. Las 3792 posiciones monetarias coinciden exactamente con la referencia anterior. Estas pruebas locales no ejecutan M ni Desktop/Service; la confirmacion del usuario es evidencia distinta. No cambiar flags de aceptacion formal a partir de una confirmacion general.

### Resolucion de carga y aprendizajes

Incidencia reportada en los cuatro PBIP el 16/11/2026. Los diagnosticos de Desktop 2.159.1231.0 confirman cuatro caidas Mashup `0xC00000FD` incluso con la mitigacion anterior. No identifican la funcion culpable. El commit `e9adacf` retiro hashes de todo el pipeline sin cambiar cifras ni cuadraturas. El posterior `DataSource.NotFound` mostro la antigua ruta; `c7cec1d` actualizo los cuatro parametros y el valor inicial del generador a la ubicacion OneDrive solicitada. Despues el usuario confirmo funcionamiento Desktop. No se demuestra que el hash fuera la causa unica ni por que la primera edicion del parametro no persistio.

- Separar acceso al archivo, transformacion M, modelo, visual y publicacion. El mensaje interno y el paso concreto importan mas que el envoltorio OLE DB/ODBC; conservar diagnosticos en privado.
- Sincronizar modelos, enlaces y visual compatibles como conjunto: retirar solo una funcion deja contratos inconsistentes. No reconstruir ni renombrar los cuatro proyectos para cambiar una ruta.
- Cada PBIP conserva su parametro; el valor inicial del generador no reemplaza personalizaciones. Aplicar, guardar y comprobar el proyecto realmente abierto. OneDrive local no significa conector cloud ni refresh de Service.
- La lectura exige contexto y cuadraturas, no hashes. Esos controles no acreditan identidad binaria ni autorizan nuevas correcciones. Preservar excepciones y nulos, sin inventar datos o monedas.
- Un clon requiere Refresh, no caches, Python, Node, JSON o ZIP obligatorios en Windows. Un cambio compatible de datos no requiere rebuild del visual. Git, carga de datos y publicacion son pasos distintos.
- Operacion confirmada, paridad numerica completa y permisos/publicacion son evidencias separadas. La cronologia y matriz detalladas se mantienen en MkDocs, no se infieren de la compilacion.

Si el problema reaparece: cerrar Desktop y revisar `git status --short`. Preservar y conciliar ediciones locales; cuando la revision este en el remoto, sincronizar con `git pull --ff-only`. Se requieren juntos los modelos, enlaces y recursos compilados nuevos, no solo una funcion M. Reabrir, confirmar `pWorkbookPath` y Actualizar. No ejecutar npm/Python ni configurar JSON en Windows. Retirar consultas diagnosticas creadas manualmente que dependan de la funcion eliminada. Si persiste, registrar paso, version y nuevos diagnosticos; aislar `Excel.Workbook` de `fxCierreXlsx` en una copia de prueba, sin omitir validaciones financieras.

## Seguridad y autoridad

- Sincronizar assets originales solo mediante `preparar_powerbi.py`; no editar `src/shared/` a mano.
- `data/` (incluido QA), `previews/`, `releases/`, `dist/`, `.tmp/`, `src/generated/`, `.pbi/`, XLSX/PBIX, informes y credenciales son privados e ignorados. Nunca Git, incluso privado; las consultas QA tambien contienen cifras.
- `powerbi/` y `artifacts/cierre-gastos-ti.pbiviz` contienen definiciones y codigo sin cifras. No copiar recursos snapshot con datos a esas rutas. Revisar diffs y usar rutas Git explicitas; nunca forzar ignorados ni hacer `git add .`.
- Las ediciones Windows no vuelven automaticamente a Linux. Revisar incorporacion de codigo/definiciones, sin parametros personales, caches ni consultas QA financieras.
- Cada modelo carga solo su negocio; filtros y pestanas no son permisos. No se presupone RLS implementado y RLS no protege cifras incrustadas en snapshot.

## Snapshot opcional congelado

Alternativa privada construida en Linux, **no ZIP obligatorio para Windows**. `npm run release:snapshot -- --version 0.2.0.2` requiere una version nueva disponible por cierre/correccion. Crea `releases/<cierre>-v<version>/` con cuatro PBIP/paquetes con cifras y GUID distintos estables, previews/informe, manifiesto e instrucciones, mas ZIP sin checksum. No sobrescribe releases ni modelos raiz. Incluye comparacion de cifras, recursos, host simulado y esquemas. El manifiesto esquema 2 registra archivos y tamanos, no acredita identidad binaria.

Revalidacion opcional de una nueva entrega (usar su identificador real). Las releases anteriores al esquema 2 se conservan y usan sus herramientas de origen:

```bash
npm run check:snapshot -- releases/<id>
npm run test:snapshot -- releases/<id>
npm run check:schemas -- releases/<id>
```

Solo al elegir snapshot, transferir el ZIP por canal autorizado al publicador de los cuatro negocios; confirmar procedencia/version y extraer a una carpeta nueva. Abrir sus PBIP, comparar HTML y publicar manualmente; conservar originales y copias privadas de trabajo. No configurar `pDataFile`/`pWorkbookPath` ni refrescar fuente externa: modelo tecnico vacio, sin DataView; cifras incrustadas. Cada cambio requiere version/rebuild y republicacion. La evidencia historica `0.2.0.1` no valida este cambio, M, Desktop ni Service.

## Alternativa con modelo importado

El modelo **JSON** anterior, con `pDataFile`, evita duplicar la lectura Python en M. No es el modelo XLSX nativo ni un paso Windows obligatorio. Elegirlo solo en una copia separada con esas particiones; `package:projects` vigente configura XLSX automaticamente. Para JSON, transferir referencias privadas, configurar su ruta, Refresh, comprobar y publicar; no revertir los cuatro modelos raiz por defecto.

Guia completa y evidencia en MkDocs de CierreGastosTI: **Reportes y dashboards > Dashboards > Dashboard de cierre TI > Entrega en Power BI**. Apertura documental en Linux: `npm run docs` desde el principal.
