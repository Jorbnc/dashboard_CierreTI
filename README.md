# Dashboard Cierre TI

Un repositorio independiente, un visual SDK compartido **sin cifras incrustadas** y cuatro PBIP: Banco Chile, Banco Peru, Retail Chile y Retail Peru. El flujo predeterminado es **XLSX directo con Power Query M** en `powerbi/`. Windows usa solo **Git Bash + Power BI Desktop**, sin Python, Node ni manejo regular de JSON.

Los cuatro modelos estan configurados, pero **runtime M, paridad numerica migrada, primera carga Desktop y publicacion Service siguen pendientes**. El parser oficial Power Query en Linux valida sintaxis, no ejecucion. La evidencia snapshot `2609-v0.2.0.1` es de otra via, no prueba de XLSX nativo.

## Preparar en Linux

Desde **CierreGastosTI**, seleccionar el agregado, hoja `Comité`, no un libro completo Base:

```bash
source activate_venv.sh
python tools/reportes_visuals/cierre_mensual/preparar_powerbi.py \
  --source input/datos/dashboard_cierre/2609_dashboard_data.xlsx \
  --deployment-dir deploy/dashboard_CierreTI
```

Python sigue siendo referencia/generador Linux. Sincroniza `src/shared/` con hashes y genera `data/*.json`, `data/preparation.json`, cuatro HTML y `previews/informe_generacion.md`. Revisar y resumir excepciones, faltantes y discrepancias; no aprobar fallos fatales ni nuevas correcciones. Estos archivos son privados, no la fuente del modelo Windows.

Para instalacion inicial o cambios de UI/SDK, desde **este repositorio, solo Linux**, con Node >=22.13:

```bash
npm ci
npx playwright install chromium firefox
npm run release:local
npm run check:schemas
```

`release:local` prueba, compila e instala `artifacts/cierre-gastos-ti.pbiviz` sin datos. Su `package:projects` **ejecuta automaticamente `configure:xlsx`**: no se requiere un segundo comando. Migra solo particiones de origen y parametros/funciones M de los cuatro modelos existentes, preservando layout, identidades, enlaces y `pWorkbookPath` existente. Particiones personalizadas desconocidas deben revisarse, no sobrescribirse.

`npm run configure:xlsx` es opcional para refrescar solo el adaptador. `npm run test:powerquery` comprueba sintaxis con `@microsoft/powerquery-parser` y contratos locales, no el runtime M. La lectura usa `powerquery/fxCierreXlsx.pq`, `fxCierreSum.pq` y `fxSHA256.pq`: hash del binario completo en M puro, sin extension Crypto, con rendimiento y ejecucion nativa pendientes.

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

1. Recibir el XLSX explicito. `pWorkbookPath` inicia en `C:\CierreTI\datos\2609_dashboard_data.xlsx`; usar una ruta absoluta Windows, no `/c/...` de Git Bash. Fuente: hoja `Comité` del agregado, no Base; no se busca automaticamente el archivo mas reciente.
2. Abrir `powerbi/banco_peru/banco_peru.pbip` **del clon raiz**, con sus carpetas `.Report` y `.SemanticModel`, no un PBIP de `releases/`.
3. En **Transformar datos > Administrar parametros**, confirmar o cambiar `pWorkbookPath`. Se configura una vez por PBIP mientras la ruta siga igual; si cambia el nombre mensual, cambia el parametro.
4. Aplicar y **Actualizar / Refresh**. Un clon fresco no contiene datos importados porque `.pbi/cache.abf` se excluye de Git. Si solo aparece `pDataFile`, revisar la migracion Linux, no introducir JSON en este flujo.
5. Comparar con el HTML del mismo XLSX: importes, precision, nulos, mes actual/anterior, Gastos TI/OPEX/CAPEX, categoria, orden, ambas monedas de Banco Peru, historia y CO. No dar por probada la paridad solo porque abra.
6. **Guardar / Save**, cerrar, reabrir y comprobar. Repetir carga y aceptacion en los otros tres modelos.
7. Publicar manualmente al workspace autorizado, **nunca Publicar en web**. Verificar cifras y permisos por negocio en Service y registrar los cuatro enlaces reales. Guardar o hacer push no publica datos.

| Negocio | Ruta desde este repositorio | Monedas | Service |
| --- | --- | --- | --- |
| Banco Chile | `powerbi/banco_chile/banco_chile.pbip` | MMCLP | Pendiente |
| Banco Peru | `powerbi/banco_peru/banco_peru.pbip` | MSoles y MMCLP | Pendiente |
| Retail Chile | `powerbi/retail_chile/retail_chile.pbip` | MMCLP | Pendiente |
| Retail Peru | `powerbi/retail_peru/retail_peru.pbip` | MMCLP | Pendiente |

## Siguiente cierre

Recibir el nuevo `YYMM_dashboard_data.xlsx` por canal autorizado; actualizar `pWorkbookPath` en los cuatro PBIP, **Refresh, comprobar, Save y publicar manualmente**. Sin cambios de UI/SDK no hay compilacion mensual en Linux ni Windows. Una correccion del mismo archivo requiere verificar procedencia/autorizacion, refrescar y republicar; cambiar parametro si cambia la ruta.

Esquema soportado estricto: un cierre desconocido requiere validacion estructural/financiera. Las excepciones de historia en soles y `No Direccionable` estan ligadas a la fuente confirmada, no a cualquier archivo con nombre parecido. No inventar historia Retail, soles adicionales ni reclasificar CO. No hay SharePoint, gateway o refresh cloud configurados sobre la ruta local.

La hoja 2609 tiene dimension `B1:CB362`, comprobada con openpyxl. Solo se admite el origen conocido B1/B2 (`Pesos Chilenos`, `Real + Proyección`): si el host lo devuelve en `Column1`, se antepone A vacia; si lo devuelve en `Column2` con A vacia, se conserva. Cualquier otro origen falla, sin adivinar offsets. La representacion efectiva aun requiere Desktop.

## Comprobaciones

QA exhaustivo **opcional**, desde Linux y con referencias Python coherentes ya preparadas:

```bash
npm run qa:powerquery
```

Genera `data/qa/<business>.pq` privados. En una copia de aceptacion Desktop, crear consulta en blanco, pegar el contenido en Editor avanzado, deshabilitar carga y evaluar. Compara los **25 campos**, nulos y numeros sin redondear (tolerancias `1e-10` absoluta y `1e-12` relativa): **3792 posiciones monetarias** entre cuatro negocios para 2609. Incluye SHA256 conocido de cadena vacia y `abc`. Registrar resultados solo despues de ejecutarlos; **runtime pendiente**. No son dependencias de produccion y nunca van a Git ni al modelo publicado.

Auditoria opcional previa a publicar: `= Value.Metadata(Cierre)[CierreDiagnostics]` en una consulta en blanco sin carga. Inspeccionar **inmediatamente el resultado del lector en el editor, antes de otras transformaciones**: `history_notes`, `source_findings` y ajustes por moneda en `currencies`. Si `Cierre` ya fue transformada, consultar el resultado original de `fxCierreXlsx`. Los metadatos pueden perderse y no se guardan automaticamente en el modelo; validar su forma en Desktop y conservar diagnosticos fuera del visual.

El codigo fuerza la auditoria Retail con `List.Buffer(Findings)`, aunque no se consulten metadatos. El resultado nativo sigue pendiente. Evidencia Linux informada por la implementacion: 75 pruebas Python, 19 Node, visual sin cifras en Chromium/Firefox, 32 definiciones frente a 8 esquemas, MkDocs estricto y 21 pruebas UI documentales aprobadas (una omitida). No prueba M ni Desktop/Service.

## Seguridad y autoridad

- Sincronizar assets originales solo mediante `preparar_powerbi.py`; no editar `src/shared/` a mano.
- `data/` (incluido QA), `previews/`, `releases/`, `dist/`, `.tmp/`, `src/generated/`, `.pbi/`, XLSX/PBIX, informes y credenciales son privados e ignorados. Nunca Git, incluso privado; las consultas QA tambien contienen cifras.
- `powerbi/` y `artifacts/cierre-gastos-ti.pbiviz` contienen definiciones y codigo sin cifras. No copiar recursos snapshot con datos a esas rutas. Revisar diffs y usar rutas Git explicitas; nunca forzar ignorados ni hacer `git add .`.
- Las ediciones Windows no vuelven automaticamente a Linux. Revisar incorporacion de codigo/definiciones, sin parametros personales, caches ni consultas QA financieras.
- Cada modelo carga solo su negocio; filtros y pestanas no son permisos. No se presupone RLS implementado y RLS no protege cifras incrustadas en snapshot.

## Snapshot opcional congelado

Alternativa privada construida en Linux, **no ZIP obligatorio para Windows**. `npm run release:snapshot -- --version 0.2.0.2` requiere una version nueva disponible de cuatro partes por cierre/correccion. Crea `releases/<cierre>-v<version>/` con cuatro PBIP/paquetes con cifras y GUID distintos estables, previews/informe, manifiesto e instrucciones, mas ZIP/SHA256. No sobrescribe releases ni modelos raiz. Incluye controles exactos, host simulado y esquemas antes de completar la entrega.

Revalidacion opcional de la evidencia historica:

```bash
npm run check:snapshot -- releases/2609-v0.2.0.1
npm run test:snapshot -- releases/2609-v0.2.0.1
npm run check:schemas -- releases/2609-v0.2.0.1
```

Solo al elegir snapshot, transferir ZIP/checksum por canal autorizado al publicador de los cuatro negocios; verificar con `sha256sum -c 2609-v0.2.0.1.zip.sha256` en Git Bash junto a ambos archivos. El ZIP incluye la carpeta de version: extraer a su padre, sin destino existente. Abrir sus PBIP, comparar HTML y publicar manualmente; conservar originales y copias privadas de trabajo. No configurar `pDataFile`/`pWorkbookPath` ni refrescar fuente externa: modelo tecnico vacio, sin DataView; cifras incrustadas. Cada cambio requiere version/rebuild y republicacion. La evidencia `0.2.0.1` de 3792 posiciones exactas y host simulado no valida M, Desktop ni Service.

## Alternativa con modelo importado

El modelo **JSON** anterior, con `pDataFile`, evita duplicar la lectura Python en M. No es el modelo XLSX nativo ni un paso Windows obligatorio. Elegirlo solo en una copia separada con esas particiones; `package:projects` vigente configura XLSX automaticamente. Para JSON, transferir referencias privadas, configurar su ruta, Refresh, comprobar y publicar; no revertir los cuatro modelos raiz por defecto.

Guia completa y evidencia en MkDocs de CierreGastosTI: **Reportes y dashboards > Dashboards > Dashboard de cierre TI > Entrega en Power BI**. Apertura documental en Linux: `npm run docs` desde el principal.
