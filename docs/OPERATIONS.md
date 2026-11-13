# Operación y recuperación

## Antes de ejecutar en modo real

Usá una sola copia del estado. No ejecutes el CLI local al mismo tiempo que Actions
ni copies un estado viejo sobre uno más nuevo. Si vas a operar localmente, desactivá
el cron (`SYNC_ENABLED=false`), evitá despachos manuales, esperá que termine el runner
activo y traé el último estado con `git pull --ff-only`.

Las peticiones Meta, descarga y X tienen timeouts de 15 s (por petición/inactividad,
no un plazo total del lote). Los comandos Git tienen timeout de 60 s y el job de sync
un máximo de 20 minutos. No se reintenta automáticamente la creación de posts en X.
Ante HTTP 401/403 revisá acceso y permisos; ante 429 revisá cuota y esperá la ventana
indicada por el proveedor. No pegues tokens ni respuestas completas en issues o logs.

## Una cuenta quedó bloqueada por publicación incierta

`pendingPost` significa que pudo haberse enviado una creación a X sin confirmar el
resultado de forma duradera. También puede quedar si el push previo falló antes de
crear el post. No borres el estado para volver a intentar.

1. Pausá las ejecuciones como se indica arriba y descargá el último estado remoto.
2. Consultá `pendingPost.postId` y `startedAt` en `data/sync-state.json`.
3. Revisá la cuenta destino de X y compará texto, imagen y horario con el post de Instagram.
4. Si el post existe, tomá su ID de X y confirmalo. Ejemplo con IDs ficticios:

   ```bash
   npm run recover -- --account 17841400000000001 --tweet 1900000000000000000
   ```

5. Solo si verificaste que **no** se publicó, liberá el pendiente para permitir un nuevo intento:

   ```bash
   npm run recover -- --account 17841400000000001 --not-published
   ```

6. Revisá el diff, creá un commit de `data/sync-state.json` y hacé push a la rama por defecto antes de reactivar el cron. La recuperación modifica únicamente estado local: no borra ni crea posts en X y no hace push por sí sola.

Si no podés determinar el resultado, dejá el pendiente. Para más de una cuenta,
las que no tienen incertidumbre pueden seguir operando.

## Falló el guardado o el push desde Actions

Revisá el estado más reciente en GitHub y el artefacto `sync-state-<run>-<attempt>`.
El archivo local del runner puede estar más adelantado que el remoto. Comparalos antes
de aplicar cambios; no reemplaces un estado actual con un respaldo viejo ni uses force-push.

El programa intenta publicar `pendingPost` en GitHub antes de llamar a la creación de X.
Si falla ese push, no crea ese post. Si falla el push de confirmación después de crear,
el remoto conserva el pendiente y la próxima ejecución exige revisión. La etapa final
de Actions intenta recuperar el push incluso si una cuenta falló. Si un humano avanzó
la rama mientras corría el job, el push se rechaza y requiere reconciliación manual.

Si el runner muere antes de que un upload termine, puede quedar media huérfana en X;
no implica que exista un post. No confundas el upload de media con la creación.

## Estado corrupto, ausente o checkpoint desaparecido

Un archivo ausente inicia una cuenta nueva. Un JSON corrupto o un esquema inválido
interrumpe el proceso. Restaurá una versión consistente desde Git o el respaldo,
contrastándola con X si hubo publicaciones posteriores. Usar `{}` como reparación
puede volver a publicar contenido.

Si el último post confirmado desapareció de Meta o quedó fuera del límite de 20 páginas,
el programa se detiene sin publicar el backlog parcial. Revisá permisos, borrados y feed.
Si no podés restaurar la continuidad, reconstruí el checkpoint con IDs cuya publicación
en X hayas confirmado y documentá el cambio. No hay una migración automática para ese caso.
El estado anterior sin `syncedPostIds` sigue siendo legible y se amplía al siguiente guardado.

## Quedó un lock local

El archivo `data/sync-state.json.lock` evita dos procesos simultáneos en el mismo directorio.
Un cierre forzado puede dejarlo. Revisá el PID/fecha guardados y verificá que no haya
ningún proceso de sync o recuperación activo. Solo entonces eliminá ese archivo concreto
(por ejemplo, `Remove-Item -LiteralPath .\data\sync-state.json.lock` en PowerShell).
No se elimina automáticamente por edad: hacerlo podría habilitar dos procesos activos.

## Alcance de los diagnósticos

Los logs informan etapa, status HTTP y códigos acotados. No imprimen objetos de SDK,
cabeceras ni mensajes arbitrarios del proveedor. El dry-run imprime captions y los IDs
se guardan en el repositorio; tratá estos datos según la visibilidad del proyecto.
La suite usa dobles y un remoto Git temporal, y no certifica la configuración de tus
cuentas reales. Empezá con dry-run y revisá el acceso vigente de ambas plataformas.
