# Pruebas manuales — `client-critical-fixes` (bloque D, auditoría 2026-09)

Este cambio toca únicamente `client/`. `cd client && npx tsc --noEmit`, `npx jest --ci --watchAll=false`
(777/777) y `npm test` (termina, exit 0) ya se verificaron automáticamente. Lo que sigue no se puede
verificar sin un dispositivo, un navegador o un build real de Expo — hay que confirmarlo a mano antes
de mergear. Ninguno de estos puntos se marcó como hecho en `tasks.md`; son la Fase 8 pendiente.

## 1. Migración de sesión a SecureStore (el más crítico)

**Por qué importa**: si esto falla, todos los usuarios logueados pierden la sesión al actualizar.

1. Instalar la versión anterior (la de `main`, antes de este cambio) en un dispositivo o emulador,
   iniciar sesión con una cuenta real y dejarla abierta.
2. Instalar esta versión nueva **encima**, sin desinstalar ni borrar datos de la app.
3. Abrir la app. **Confirmar que el usuario sigue logueado** — no debería pedir login de nuevo.
4. Repetir en iOS y en Android (son dos implementaciones nativas distintas de SecureStore).
5. Opcional pero recomendable: con herramientas de desarrollo, confirmar que la clave vieja
   `session-storage` ya no está en `AsyncStorage` (ejemplo con `adb`: revisar el storage de la app),
   y que sí aparece en el llavero (iOS Keychain) o en el Android Keystore.
6. Cerrar la app del todo y reabrirla una segunda vez: la sesión debe seguir ahí (la migración es de
   una sola vez, no debe repetirse ni fallar en el segundo arranque).

**Qué reportar si falla**: si el usuario aparece deslogueado en el paso 3, es el escenario que más
nos preocupa — anotar el modelo de dispositivo, la versión de OS, y si el usuario pertenece a varias
escuelas o tiene una comunidad con tema propio (el payload persistido es más grande en ese caso).

## 2. Modo demo de punta a punta

1. Entrar a la pantalla de Landing (sin sesión) y tocar el link de "explorar la demo".
2. Confirmar que entra como el usuario demo (`Demo1234!` ya no se manda desde la app, pero el login
   demo debe funcionar igual porque el handler ignora la contraseña).
3. Navegar la app y confirmar que se ve data de ejemplo (listings, misiones, etc.), no la API real.
4. Intentar una acción de escritura (publicar, hacer una oferta, etc.) y confirmar que aparece el
   aviso de "modo demo, no se puede guardar" — no debe fallar en silencio ni crashear.
5. Matar la app (no solo minimizar) y volver a abrirla. La sesión demo debe seguir activa
   inmediatamente, sin ventana en la que quede a medio camino.
6. Cerrar sesión desde la demo y confirmar: el modo demo se apaga, el tema visual vuelve al de
   Loop por defecto (no se queda con los colores de la comunidad demo), y no queda ninguna data
   vieja visible al loguearse con otra cuenta después.

## 3. Contraseña incorrecta no cierra la sesión de otro usuario

1. Loguearse con una cuenta real.
2. Sin cerrar sesión, ir a la pantalla de login e intentar loguearse con otro mail y una contraseña
   incorrecta.
3. Confirmar que aparece un error de login, **y que la sesión original sigue activa** (no te saca).
4. Como contraste: dejar que una sesión expire de verdad (o simular un token vencido) y confirmar que
   ahí sí cierra sesión automáticamente en el primer request fallido.

## 4. Pantallas que antes crasheaban o quedaban en blanco

Para cada una, si es posible, forzar un error de red (modo avión a mitad de carga, o apagar el
servidor un instante) y confirmar que la pantalla muestra su estado de error visible, no una pantalla
en blanco ni un crash:

- Buscar (`Search`)
- Mensajes (`Messages`) — tanto la lista de chats como la de usuarios
- Un chat individual (`Chat`)
- Hacer una oferta (`Offer`)
- Mis publicaciones / publicaciones pendientes
- Notificaciones

## 5. Notificaciones

1. Generar una notificación de tipo "loop" (alguien te ofrece o te acepta un intercambio) y tocar la
   tarjeta desde la lista de notificaciones: debe abrir el detalle de esa publicación.
2. Generar una notificación de donación y tocarla: debe abrir el perfil público de quien donó.
3. Generar una notificación de misión completada: la tarjeta **no** debe reaccionar al toque (no hay
   pantalla de detalle de misión).
4. Con la app en segundo plano, recibir un push y tocarlo: debe navegar a algún lado (a la lista de
   mensajes si es de tipo mensaje, o a notificaciones en cualquier otro caso) — ya no debe quedarse
   sin hacer nada ni solo loguear en consola. (El deep-link directo a la publicación o al chat desde
   el push todavía no es posible: el servidor no manda esos datos en el payload. Eso queda anotado
   como pendiente para otro cambio.)

## 6. Ruta `/debug`

1. En un build de **producción** (o `npx expo export` con `NODE_ENV=production`), confirmar que la
   ruta `/debug` no se puede abrir ni por URL directa ni por deep link.
2. En un build de **desarrollo**, confirmar que `/debug` sigue funcionando igual que antes (URL de
   API, toggle de modo demo, diagnósticos).

## 7. Alertas en la web

Probar los tres puntos siguientes **en el navegador** (no en la app nativa):

1. Denunciar una publicación sin que haya un mail de denuncia configurado: debe aparecer un mensaje
   visible ("No hay un correo de denuncia configurado por ahora."), no quedar en silencio.
2. Forzar que falle abrir el cliente de mail al denunciar (por ejemplo sin cliente de mail
   configurado en el navegador): debe aparecer un mensaje y quedar disponible el texto para copiar
   manualmente (se abre la hoja de "copiar manualmente").
3. Desde el aviso de "no tengo mail institucional", tocar el botón de contacto sin cliente de mail
   configurado: debe aparecer un mensaje y quedar el mail disponible para copiar.
4. Confirmar que en **nativo** (iOS/Android) estos tres casos siguen mostrando el diálogo nativo de
   siempre, con el mismo texto — nada debería cambiar ahí.

## 8. Builds de Android

1. Generar un build con el perfil `development` y confirmar que llega a
   `http://192.168.1.37:3000` (la API de LAN) sin error de tráfico bloqueado.
2. Generar (o inspeccionar el manifest de) un build `production` y confirmar que **no** declara
   `RECORD_AUDIO` ni permite tráfico cleartext.

## 9. Service worker (web)

Con la app corriendo en el navegador, abrir las herramientas de desarrollo y confirmar que ninguna
respuesta de la API queda guardada en la caché del service worker (Application → Cache Storage).

## 10. Suite de Playwright

Correr `cd e2e && npx playwright test` y confirmar que sigue en verde — las suites manejan la API
directamente (`loginUser(api, …)`), no la UI del cliente, así que no deberían verse afectadas, pero
hay que confirmarlo.

---

## Nota sobre el rollback

Si este cambio se revierte **después** de que algún usuario ya haya abierto el build nuevo al menos
una vez, ese usuario queda con la sesión en el almacenamiento encriptado (SecureStore) y el build
viejo no sabe leerla de ahí — quedaría deslogueado. Es el único paso no simétrico del plan de
rollback. No es motivo para no revertir si hace falta, pero hay que saberlo de antemano.

---

# Pruebas manuales — `delivery-and-ci` (bloque F, auditoría 2026-09)

Este bloque toca infraestructura de deploy, CI y build. Todo lo verificable con `npx tsc --noEmit`,
`npx jest`, `docker build` (single-arch, este host es ARM64 nativo) y `docker compose up` en un
stack aislado ya se corrió y quedó documentado con evidencia real en
`openspec/changes/delivery-and-ci/tasks.md`. Lo que sigue **no se pudo verificar desde esta sesión**
porque necesita credenciales de registry, un push real a GitHub, o acceso al host de producción real
(este host es el host de producción, pero verificar ahí significa afectar el stack real — no se
tocó).

## 1. Abrir un PR real y confirmar que el pipeline corre verde (crítico)

`.github/workflows/ci.yml` nunca corrió en GitHub Actions — solo se validó que el YAML parsea y que
cada comando que referencia existe y sale con código 0 localmente. Antes de confiar en el pipeline:

1. Abrir un PR real contra `main` con esta rama (o un subconjunto).
2. Confirmar que corren y pasan: `lint-typecheck` (matriz de 3), `unit` (matriz de 2),
   `api-integration` (con el servicio `postgres:16`), `e2e`, y que `audit` reporta sin bloquear.
3. Confirmar que el job `docker` **no** corre en el PR (solo debe correr en un push de tag `v*`).
4. Si algo falla que no falló localmente, es casi seguro un problema del entorno del runner
   (versión de Docker en `ubuntu-latest`, disponibilidad de `psql`, etc.) — no un error de lógica.

## 2. Primer build y push real de las tres imágenes (crítico, antes del primer tag)

`scripts/build-images.sh` nunca se corrió de punta a punta — ni localmente (necesita credenciales de
Docker Hub y `--push`, que no se puede simular sin publicar de verdad) ni en CI (nunca se pusheó un
tag `v*`).

1. Confirmar que existen los secrets `DOCKERHUB_USERNAME` y `DOCKERHUB_TOKEN` en el repo de GitHub, y
   las variables `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID`, `VITE_API_URL`,
   `VITE_GOOGLE_CLIENT_ID` (como repository/environment variables, no secrets — son públicas).
2. Pushear un tag `v0.0.0-test` (o similar, no un release real) y confirmar que el job `docker`
   construye y publica las tres imágenes.
3. **Inspeccionar el manifest publicado de cada una** (`docker buildx imagetools inspect
   ezemastro/loop-api:<tag>`) y confirmar que lista **ambas** plataformas: `linux/amd64` y
   `linux/arm64`. Esto nunca se verificó porque `buildx` no puede cargar un resultado multi-plataforma
   al daemon local sin `--push`.
4. Confirmar en el host ARM64 real que `docker pull` de la imagen recién publicada y arranca **sin**
   ningún warning de "platform mismatch" (esto sí confirma que la imagen es nativa, no emulada).

## 3. Primer deploy en el host de producción real (crítico — leer `docs/runbook-deploy.md` primero)

Todo lo de migraciones/compose se verificó en un stack **aislado** (red y volumen propios, nunca la
`proxy-network` ni el volumen `postgres-data` real) — nunca contra la base de datos de producción
real. `MIGRACION-COMUNIDADES.md` confirma que las migraciones de comunidades nunca se aplicaron ahí.

1. **Tomar un snapshot/backup de la base de producción antes de cualquier otra cosa.**
2. Confirmar que `DB_APP_PASSWORD` y `DB_UNSCOPED_PASSWORD` están seteadas en el `.env` real del
   host (no vacías) — si están vacías, la migración `0007_db_roles_and_rls.sql` va a abortar
   (`RAISE`), lo cual es la conducta esperada, no un bug.
3. Crear la red externa si todavía no existe: `docker network create proxy-network`.
4. Seguir la secuencia de `docs/runbook-deploy.md` §2 (`docker compose pull && docker compose up -d`)
   y observar `docker compose logs -f migrate` hasta que salga con código 0.
5. Confirmar que `api` llega a estado healthy y **no reinicia** — si reinicia, es la señal exacta del
   crash-loop que este cambio existe para evitar (`assertDbHardening()` fallando).
6. Repetir el deploy una segunda vez contra el mismo volumen ya migrado y confirmar que `migrate`
   reporta "Migraciones al día." — la idempotencia solo se probó contra un volumen de prueba, no
   contra el volumen real.

## 4. `npm run docker:deploy` sin `--pull always`

Antes se hacía `docker compose up -d --pull always`, que siempre traía `:latest`. Ahora
`compose.yml` referencia tags fijas (`${API_IMAGE_TAG}` etc., con default a la versión actual de cada
`package.json`). **Confirmar en el `.env` real del host** que esas variables están seteadas
explícitamente a la versión que se quiere correr — si no están, el default hardcodeado en
`compose.yml` es el que se usa, lo cual puede no ser lo que se esperaba.

## 5. Límites de memoria del compose de producción

Los límites (`db` 1g, `api` 512m, `web` 256m, `admin` 128m, `backup` 256m) son estimaciones por rol,
**no medidos bajo carga real**. Antes de confiar en ellos en producción: observar el uso real de
memoria de cada contenedor durante uso normal (`docker stats`) y ajustar si algún servicio se acerca
al límite (Docker mata el proceso sin aviso elegante si lo excede).

## 6. `server/README.md` deploy y build de Docker

Correr localmente los dos `docker build` documentados en `server/README.md` (`--target development`
y `--target production`) para confirmar que el texto describe exactamente lo que hoy funciona — se
verificaron equivalentes durante esta sesión pero no exactamente esos dos comandos copiados y
pegados tal cual quedaron en el archivo.

## 7. Pendiente conocido, no de esta sesión: fase de observabilidad (INF-10)

`pino`, el request id y `GET /health` quedaron **completamente sin tocar** — el bloque
`sec-hardening-api`, dueño de `index.ts` y de `/health`, todavía no se aplicó. Cuando se aplique,
retomar la fase 7 de `openspec/changes/delivery-and-ci/tasks.md` (11 tareas, ninguna marcada).
`compose.yml`'s `api` no tiene healthcheck todavía por la misma razón — no apunta a `/health` porque
ese endpoint no existe aún en el árbol de trabajo.

## 8. Pendiente conocido: `client/package.json`'s `deploy` script

Ya estaba así antes de esta sesión (commit `d6b50b3` de `client-critical-fixes` borró
`client/publish.js` pero dejó el script `"deploy": "node publish.js"` en `client/package.json`
apuntando a un archivo que ya no existe). No se tocó por pertenecer a ese bloque — alguien debería
borrar esa línea o restaurar el archivo.

---

# Pruebas manuales — `db-integrity-migrations` (bloque B, auditoría 2026-09)

> Migraciones `0009`–`0013`. Todo lo de acá se validó contra un Postgres 16 real a nivel SQL,
> pero **el flujo HTTP completo no se corrió**.

## 1. Correr el e2e completo de verdad (crítico)
Esta sesión lo tuvo prohibido por carga de máquina.
```
npm run test:e2e     # con REQUIRE_EMAIL_VERIFICATION=true
```
Tiene que levantar una base desde cero (`database_creation.sql` + migraciones `0000`–`0013`) y pasar
los 41 tests, incluido el nuevo de token vencido.

## 2. Verificación de email real
Crear una cuenta desde la app, confirmar que llega el mail (o que queda en el log si no hay Resend
configurado), hacer clic en el link y confirmar que se destraba el login. Después pedir "reenviar
verificación" y confirmar que **el link viejo ya no sirve** (se rotó el hash).

## 3. Dos registros simultáneos con el mismo email
Dos pestañas o dos requests a la vez. Tiene que crearse **una sola** cuenta y la segunda debe
devolver un 409 claro ("el usuario ya existe"), no un 500 ni una pantalla en blanco.

## 4. Borrar una publicación que tiene mensajes asociados
Un chat donde se adjuntó esa publicación. El borrado tiene que funcionar y la conversación seguir
existiendo: solo desaparece la tarjeta adjunta del mensaje.

## 5. Registro por invitación
Generar una invitación desde el admin, registrarse con ese link, confirmar que la cuenta se crea y
la invitación queda marcada como usada (el link no se puede reusar).

## 6. Auto-borrado de cuenta en una cuenta creada por invitación
`DELETE /me` desde el perfil. Tiene que funcionar sin error. **Esto es exactamente lo que se habría
roto** si se aplicaba la recomendación literal de la auditoría (revocarle a `loop_app` todo permiso
sobre `invitations`).

## 7. Auditoría de emails duplicados EN PRODUCCIÓN — antes de desplegar
```
psql <prod> -f server/scripts/audit-duplicate-emails.sql
```
Si devuelve alguna fila, la migración `0009` **aborta el despliegue**. Los duplicados hay que
resolverlos a mano: es una decisión humana (qué cuenta sobrevive, qué pasa con sus publicaciones,
créditos y mensajes), no algo que la migración pueda decidir sola.

## 8. Arranque de la API sin warnings
Después de aplicar las migraciones, revisar los logs de arranque en staging/producción y confirmar
que **no** aparece `⚠️ Aislamiento por comunidad mal configurado`. Si aparece, algún grant de `0013`
no coincide con la matriz esperada.

## 9. Pase manual por el panel de admin
Crear un admin, dar de alta un colegio, acreditar y descontar créditos. Usan la conexión unscoped,
que no se tocó, pero comparten tablas con lo que sí cambió.

---

# Pruebas manuales — `admin-panel-fixes` (bloque E, auditoría 2026-09)

> Necesitás dos cuentas de `DEMO.md` (una `super_admin`, una `community_admin`) y el panel corriendo
> (`npm run dev --prefix adminClient`).

## 1. Autorizar admin (ADM-02)
Entrá como super admin → "Autorizar admin" → tiene que aparecer el selector de rol (default
"Administrador de comunidad") → con ese rol y sin comunidad elegida el botón queda deshabilitado →
elegí comunidad y autorizá: **ya no debe salir "Hay que elegir una comunidad"** → cambiá a "Super
administrador" y confirmá que desaparece el selector de comunidad y autoriza igual → entrá como
community admin y confirmá que no ve ningún selector → provocá un error y confirmá que se ve en
español, no el texto crudo del backend.

## 2. Paginación de usuarios (ADM-03)
Como super admin, en "Usuarios" con más de 10 usuarios: confirmá 2+ páginas y que **la última carga
bien** (antes la mitad de los usuarios era inalcanzable). Con la consola abierta, navegá la lista y
confirmá que no se loguea nada.

## 3. Logos de comunidad (ADM-05)
En "Comunidades" los logos cargados tienen que verse. En "Editar comunidad", subí un logo y confirmá
que la vista previa carga.

## 4. Sesión y logout (ADM-06)
Cerrá sesión y confirmá en DevTools que `admin_token` desaparece y responde 401 después → borrá la
cookie a mano y confirmá redirect a `/login` en el siguiente pedido → **probá una contraseña
incorrecta en login y confirmá que muestra el error sin redirigir** (este es el riesgo más alto del
bloque) → revisá `localStorage.session-storage` y confirmá que no tiene `email`/`fullName`/
`communityName` → recargá como super admin y confirmá que el menú de super admin sigue visible antes
de que responda la API.

## 5. Modales migrados (ADM-04)
Modificar créditos, Reiniciar contraseña, Crear/Editar colegio, Categoría, Misión: fondo
**semitransparente** (antes era negro opaco), el envío funciona igual, Enter sigue enviando el
formulario, clic en la etiqueta enfoca el campo, y en "Categoría" con contenido desbordado hay una
sola barra de scroll.

## 6. Motivo obligatorio en créditos (ADM-08)
En "Modificar créditos": motivo vacío o solo espacios se rechaza **sin mandar pedido**; con motivo
real se aplica.

## 7. Confirmaciones destructivas (ADM-08)
Revocar invitación, quitar dominio (con un solo dominio tiene que avisar que nadie va a poder
autoregistrarse) y rechazar solicitud de borrado piden confirmación antes de ejecutar. Doble clic en
el botón de peligro no dispara doble pedido. El modal de "Borrar cuenta" sigue igual que antes.

## 8. Documento (ADM-10)
La pestaña muestra el ícono de Loop (no el de Vite) y el HTML es `<html lang="es">`.
