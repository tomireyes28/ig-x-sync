# Auditoría técnica y plan de remediación

Fecha: 2026-11-13. Base revisada: `9923b`. Alcance: código, configuración,
persistencia, dependencias, automatización, pruebas y presentación del repositorio.
No se publicará contenido real ni se mostrarán credenciales durante la auditoría.

## Diagnóstico inicial

El análisis de tipos pasa, pero no había pruebas automatizadas. El árbol estaba
limpio. `.env` no está versionado ni aparece en el historial de esa ruta.
`npm audit` detectó 6 paquetes afectados (4 high, 2 moderate); esto describe
avisos del registro, no demuestra explotación en esta aplicación.

| ID | Prioridad | Evidencia y riesgo | Corrección y criterio de aceptación |
| --- | --- | --- | --- |
| A01 | Alta | `state.ts` convierte JSON corrupto en `{}` y escribe directamente: posibles duplicados/pérdida de estado. | Validar esquema, fallar cerrado y reemplazar atómicamente; probar corrupción y migración. |
| A02 | Alta | `index.ts` elige un solo post; `instagram.ts` ignora paginación. Se pierden posts entre ejecuciones. | Recuperar pendientes hasta el último ID y publicar en orden; límites explícitos y error si falta el punto de continuidad. Primer arranque: solo el último elegible. |
| A03 | Alta | Publicar y guardar no es una transacción; ejecuciones locales pueden solaparse. | Bloqueo local y registro previo de publicación incierta; recuperación manual explícita, sin reintentos automáticos de creación. |
| A04 | Media | `String.length/slice` no aplica pesos de X y puede cortar Unicode. | Usar `twitter-text`, conservar grafemas/URLs; probar CJK, emojis y enlaces. |
| A05 | Alta | Descarga ilimitada, MIME supuesto; carrusel de videos puede usar URL de video como imagen. | Límites de descarga, HTTPS, validación de cabecera/firma y selección exclusiva de imágenes. |
| A06 | Media | Dry-run exige credenciales X; cuentas nombradas duplicadas y configuración sin validar. | Configuración pura validada, deduplicación y X opcional en dry-run. |
| A07 | Alta | Se imprimen errores completos de SDK/HTTP con posibles credenciales; el orquestador oculta el motivo. | Diagnósticos acotados por categoría/status/código sin objetos ni mensajes externos. |
| A08 | Alta | Avisos de seguridad en dependencias directas y transitivas; nodemon no se usa. | Actualizar dentro de compatibilidad, retirar dependencia sin uso y repetir audit e instalación reproducible. |
| A09 | Alta | Actions no guarda éxitos parciales si falla el proceso; no serializa ejecuciones. | Guardado incluso tras fallo, concurrency, rama explícita, artefacto de respaldo y dry-run seguro. |
| A10 | Media | Sin suite de pruebas ni CI para pull requests. | Pruebas aisladas sin credenciales, typecheck/build/audit en CI, runtime coherente. |
| A11 | Media | README dice production-ready/idempotente/gratis sin explicar límites, clon placeholder y licencia sin archivo. | Documentación verificable, demo offline, operación/recuperación y licencia ISC. |
| A12 | Media | La revisión del SDK durante la etapa 3 confirmó que X no tenía timeout configurado. Una petición trabada podía bloquear las demás cuentas. | Timeout nativo de 15 s por petición X, verificado en los hooks del SDK real sin contactar la red. |

## Etapas y estrategia Git

Un commit por hallazgo (incluyendo sus pruebas), con este documento como commit
inicial. Se trabajará en una rama `codex/` y se hará un push al cerrar cada etapa.

1. **Sincronización y estado:** A01, A02, A03. Validar persistencia, cola,
   reejecuciones, aislamiento por cuenta y resultados inciertos antes del push.
2. **Contenido y seguridad:** A04, A05, A06, A07, A08. Validar Unicode,
   imágenes, entorno, redacción de errores y dependencias antes del push.
3. **Entrega profesional:** A09, A12 (hallazgo adicional), A10, A11. Validar workflows, instalación,
   suite completa y demo; actualizar resultados de esta auditoría antes del push.

## Límites de la verificación

Las pruebas usarán dobles de HTTP/X y archivos temporales. No verifican permisos,
créditos, vigencia de tokens ni publicación real en las plataformas. GitHub Actions
se inspeccionará localmente; su ejecución remota se comprobará si está disponible.
Un archivo local y un commit posterior a X no dan garantía exactly-once distribuida.
La protección de rama puede impedir el push de estado del bot y debe documentarse.

## Resultados finales

- Etapa 1 (A01–A03): implementada; 11 pruebas pasan. Se cubren corrupción,
  migración del estado previo, historial, paginación, límite de recorrido,
  orden de publicación, dry-run, aislamiento de cuentas, exclusión local y
  publicación incierta con recuperación.
- Etapa 2 (A04–A08): implementada; 26 pruebas pasan. Axios se actualizó a
  1.21.1, follow-redirects a 1.16.3 y form-data a 4.0.6. Se retiró nodemon
  (y con él minimatch/brace-expansion). `npm audit` informa cero vulnerabilidades.
  La biblioteca oficial twitter-text arrastra core-js 2 deprecado: se conserva
  por compatibilidad y se registra como deuda de mantenimiento, sin avisos de
  seguridad reportados por npm en esta revisión.
- Se buscaron los cinco valores secretos configurados localmente en las 15
  revisiones alcanzables al cierre de A07: cero archivos coincidentes. Esto no
  reemplaza una revisión de credenciales antiguas/revocadas ni un secret scanner.
- Etapa 3 (A09–A12): implementada. Se agregó checkpoint remoto antes de crear
  cada post en X, confirmación posterior, respaldo de estado tras fallos parciales,
  serialización y cron opt-in. Se verificó el timeout nativo del SDK de X.
  Se incorporaron CI, dependabot, actionlint, guía de recuperación, licencia ISC,
  metadatos del paquete y una demo completamente offline.

### Verificación final local

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | Instalación reproducible correcta. |
| `npm run typecheck` / build | Correctos con Node 22.17.0 y tipos Node 22. |
| `npm run test:coverage` | 37 pruebas, cero fallos y cero omitidas. |
| Cobertura instrumentada de `dist/**` | 97,86% líneas; 89,57% ramas; 89,06% funciones. |
| `npm run demo` | Correcta, seis intentos ficticios; estado real intacto. |
| `npm audit --audit-level=low` | Cero vulnerabilidades conocidas en la consulta final. |
| actionlint 1.7.12 | Ambos workflows válidos; binario oficial verificado por SHA256. |
| `git diff --check` | Correcto. |

Las pruebas incluyen un remoto Git temporal real: se verifican commit/push del estado,
conservación de cambios ajenos preparados y rechazo de un conflicto remoto. CI ejecuta
la suite en Linux/Windows y Node 22/24; sus resultados remotos se consultan en
[GitHub Actions](https://github.com/tomireyes28/ig-x-sync/actions/workflows/ci.yml).
Los porcentajes miden código compilado instrumentado, no publicaciones reales ni
garantías de disponibilidad. No se ejecutó el workflow de sincronización real.

### Entrega y trabajo que requiere un entorno real

Los doce hallazgos tienen correcciones y commits identificados con `[A01]` a `[A12]`.
La entrega inicial se realizó en `codex/portfolio-audit`, con un push por cada una
de las tres etapas. Luego se integró en `main` por pedido del propietario,
conservando los commits por hallazgo. No se modificaron cuentas ni secrets.

Antes de habilitar publicaciones se debe ejecutar un dry-run con Meta y verificar
permisos, acceso a los endpoints de X, créditos y reglas de push. El cron de la versión
revisada exige `SYNC_ENABLED=true`. Antes de integrar se verificó mediante la API
de GitHub que esa variable no estaba configurada: el cron queda sin habilitar.
No se despachó el sincronizador ni se activaron publicaciones reales. El push de
integración ejecuta únicamente el workflow de CI para validar la revisión final.

## Referencias técnicas consultadas

- [X: conteo ponderado y twitter-text](https://docs.x.com/fundamentals/counting-characters).
- [X: carga de media y límite de imágenes](https://docs.x.com/x-api/media/upload-media).
- [Colección oficial de Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).
  La documentación web de developers.facebook.com devolvió HTTP 429 durante
  esta revisión. La integración concreta sigue requiriendo validación con una
  cuenta autorizada.
