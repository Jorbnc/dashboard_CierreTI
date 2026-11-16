# Dashboard Cierre TI

Un repositorio independiente, un visual SDK compartido **sin cifras incrustadas** y cuatro PBIP: Banco Chile, Banco Peru, Retail Chile y Retail Peru. El flujo predeterminado es **XLSX directo con Power Query M** en `powerbi/`. Windows usa solo **Git Bash + Power BI Desktop**, sin Python, Node ni manejo regular de JSON.

El usuario confirmo **funcionamiento en Desktop el 16/11/2026**, tras retirar hashes y corregir `pWorkbookPath`; despues informo acceso de un destinatario a Service con un problema del selector en Opera. No equivale a aceptacion financiera y funcional exhaustiva de los cuatro modelos. El parser oficial Power Query en Linux valida sintaxis, no ejecucion. La evidencia snapshot `2609-v0.2.0.1` es de otra via, no prueba de XLSX nativo.

## Preparar en Linux

### Migracion 0.1.0.2: escala y selector

En este dashboard **MSoles = miles de soles**, con importes enteros, punto para miles y coma decimal en porcentajes. M conserva los importes del bloque soles sin dividir por 1.000; MMCLP no cambia. Historico y ajustes usan la misma escala; los porcentajes no cambian. No se modifican las reglas del reporte canonico Comite ni Finbot. Consultar las referencias financieras privadas en `previews/`, nunca incorporarlas a Git.

Sincronizar modelo y visual juntos, preservar cambios Windows, confirmar `pWorkbookPath`, **Refresh, comprobar, Save y republicar**. El visual nuevo no debe usarse con la cache anterior en millones. No se requiere otro XLSX ni Node/Python Windows.

El mes usa un listbox dentro del visual, con clic y teclado, en lugar del select nativo. El usuario reporto un problema del desplegable en Service/Opera; no se ha demostrado su causa ni validado esta correccion en ese entorno. Probar tambien en Edge/Chrome, incluidos en la [lista oficial de navegadores soportados](https://learn.microsoft.com/en-us/power-bi/fundamentals/power-bi-browsers). No relajar el sandbox ni pedir habilitar popups.

Desde **CierreGastosTI**, seleccionar el agregado, hoja `Comité`, no un libro completo Base:

```bash
source activate_venv.sh
python tools/reportes_visuals/cierre_mensual/preparar_powerbi.py \
  --source input/datos/dashboard_cierre/2609_dashboard_data.xlsx \
  --deployment-dir deploy/dashboard_CierreTI
```

Python sigue siendo referencia/generador Linux. Sincroniza `src/shared/` y genera `data/*.json`, `data/preparation.json`, cuatro HTML y `previews/informe_generacion.md`. La preparacion y compilacion comparan bytes con copias privadas en `.tmp/preparation-reference/` y `.tmp/build-reference/`, sin hashes. Revisar excepciones, faltantes y discrepancias; no aprobar fallos fatales ni nuevas correcciones. Estos archivos son privados, no la fuente del modelo Windows.

Para instalacion inicial o cambios de UI/SDK, desde **este repositorio, solo Linux**, con Node >=22.13:

```bash
npm ci
npx playwright install chromium firefox
npm run release:local
npm run check:schemas
```

`release:local` prueba, compila e instala `artifacts/cierre-gastos-ti.pbiviz` sin datos. Su `package:projects` **ejecuta automaticamente `configure:xlsx`**: no se requiere un segundo comando. Migra solo particiones de origen y parametros/funciones M de los cuatro modelos existentes, preservando layout, identidades, enlaces y `pWorkbookPath` existente. Particiones personalizadas desconocidas deben revisarse, no sobrescribirse.

`npm run configure:xlsx` es opcional para refrescar solo el adaptador. `npm run test:powerquery` comprueba sintaxis con `@microsoft/powerquery-parser` y contratos locales, no el runtime M. La lectura usa solo `powerquery/fxCierreXlsx.pq` y `fxCierreSum.pq`. No se usan hashes en lectura, metadatos, visual ni entrega. La migracion retira funcion, columna y enlace obsoletos desde `0.1.0.1`; la entrega vigente `0.1.0.2` conserva esos 24 campos y actualiza la escala MSoles.

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

1. Recibir el XLSX explicito. `pWorkbookPath` inicia en `C:\Users\jnunezca\OneDrive - Ripley Corp\dashboards\input\CierreTI\2609_dashboard_data.xlsx`; usar una ruta absoluta Windows, no `/c/...` de Git Bash. Fuente: hoja `Comité` del agregado, no Base; no se busca automaticamente el archivo mas reciente.
2. Abrir `powerbi/banco_peru/banco_peru.pbip` **del clon raiz**, con sus carpetas `.Report` y `.SemanticModel`, no un PBIP de `releases/`.
3. En **Transformar datos > Administrar parametros**, confirmar o cambiar `pWorkbookPath`. Se configura una vez por PBIP mientras la ruta siga igual; si cambia el nombre mensual, cambia el parametro.
4. Aplicar y **Actualizar / Refresh**. Un clon fresco no contiene datos importados porque `.pbi/cache.abf` se excluye de Git. Si solo aparece `pDataFile`, revisar la migracion Linux, no introducir JSON en este flujo.
5. Comparar con el HTML del mismo XLSX: importes, precision, nulos, mes actual/anterior, Gastos TI/OPEX/CAPEX, categoria, orden, ambas monedas de Banco Peru, historia y CO. No dar por probada la paridad solo porque abra.
6. **Guardar / Save**, cerrar, reabrir y comprobar. Repetir carga y aceptacion en los otros tres modelos.
7. Publicar manualmente al workspace autorizado, **nunca Publicar en web**. Verificar cifras y permisos por negocio en Service y registrar los cuatro enlaces reales. Guardar o hacer push no publica datos.

La ruta es editable por proyecto: se guarda en la primera linea de `powerbi/<negocio>/<negocio>.SemanticModel/definition/expressions.tmdl`. El valor inicial para proyectos nuevos esta en `tools/configure-xlsx.cjs`; el generador conserva rutas existentes. `Cierre` usa `File.Contents(pWorkbookPath)`, sin otra carpeta fija. Si un error sigue mostrando la ruta anterior, revisar el valor actual en el PBIP abierto, aplicar/guardar y reabrir la revision sincronizada con Desktop cerrado. Cambiar un parametro no actualiza los otros tres proyectos. La ruta OneDrive es local y su disponibilidad se comprueba en Windows, no desde Linux.

| Negocio | Ruta desde este repositorio | Monedas | Service |
| --- | --- | --- | --- |
| Banco Chile | `powerbi/banco_chile/banco_chile.pbip` | MMCLP | Pendiente |
| Banco Peru | `powerbi/banco_peru/banco_peru.pbip` | MSoles y MMCLP | Pendiente |
| Retail Chile | `powerbi/retail_chile/retail_chile.pbip` | MMCLP | Pendiente |
| Retail Peru | `powerbi/retail_peru/retail_peru.pbip` | MMCLP | Pendiente |

Retail Peru no tiene bloque en soles en el agregado 2609: las filas 98-106 pertenecen a RETAIL y los rotulos Soles de la fila 57 corresponden a Banco Peru. No habilitar MSoles cambiando solo el boton ni aplicando el cambio bancario. Se requieren series Retail validadas o una politica de conversion aprobada, y ampliar coherentemente referencia Python, lector M, adaptador DataView y QA.

## Siguiente cierre

Recibir el nuevo `YYMM_dashboard_data.xlsx` por canal autorizado; actualizar `pWorkbookPath` en los cuatro PBIP, **Refresh, comprobar, Save y publicar manualmente**. Sin cambios de UI/SDK no hay compilacion mensual en Linux ni Windows. Una correccion del mismo archivo requiere verificar procedencia/autorizacion, refrescar y republicar; cambiar parametro si cambia la ruta.

Esquema soportado estricto: un cierre desconocido requiere validacion estructural/financiera. Historia en soles y `No Direccionable` exigen nombre exacto `2609_dashboard_data.xlsx`, cierre 2026-09, Banco Peru, MSoles, encabezados/rangos conocidos y cuadraturas. Esto no certifica identidad binaria del archivo ni autoriza otras correcciones. No inventar historia Retail, soles adicionales ni reclasificar CO. No hay SharePoint, gateway o refresh cloud configurados sobre la ruta local.

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
