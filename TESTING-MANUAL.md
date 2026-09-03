# Qué tenés que probar a mano — auditoría 2026-09

> Rama `fix/auditoria-2026-09`, sesión del 2026-09-02.
> Cada bloque SDD dejó acá lo que **no** cubre ninguna verificación automática.
> Marcá con `[x]` lo que vayas verificando.

## Lo que hay que hacer SÍ o SÍ antes de desplegar o publicar

Tres cosas bloquean todo lo demás. Están detalladas más abajo, pero van acá porque
si te salteás cualquiera de las tres, algo se rompe en producción o en la tienda:

1. **Correr `server/scripts/audit-duplicate-emails.sql` contra la base de producción**
   antes de aplicar las migraciones. Si devuelve filas, la migración `0009` **aborta el
   despliegue**. Resolver duplicados es una decisión humana (qué cuenta sobrevive, qué pasa
   con sus publicaciones, créditos y mensajes) — la migración no puede decidirla sola.
   → sección del bloque B, punto 7.
2. **Revisión legal del texto de privacidad y términos.** Lo que hay es una **plantilla
   estructural** con diez placeholders literales (`{{DATOS_RECOLECTADOS}}`, `{{MENORES}}`,
   `{{VIGENCIA}}`, …) y un cartel visible que dice `REVISIÓN LEGAL PENDIENTE`. Nadie debe
   mandar la app a App Store ni a Google Play mientras ese cartel siga ahí. `{{MENORES}}` es
   el más delicado: Loop lo usan familias de colegios.
   → sección del bloque G, punto 0.
3. **Las variables de entorno nuevas son obligatorias en producción.** La API ahora aborta
   el arranque si falta alguna, nombrándolas. Es a propósito: antes un deploy sin `JWT_SECRET`
   arrancaba en silencio con el default público `jwt_secret_dev` y cualquiera podía forjar un
   token de super admin. **No pude escribir `.env.template`** (el deny list de permisos bloquea
   toda ruta `.env*`): la lista exacta está en `openspec/changes/sec-hardening-api/tasks.md`.
   → sección del bloque A.

## Índice

| Bloque | Qué cubre | Sección |
|---|---|---|
| D | Cliente Expo: SecureStore, errores visibles, notificaciones, demo | `client-critical-fixes` |
| F | Deploy, migraciones en producción, imágenes Docker, CI | `delivery-and-ci` |
| B | Migraciones de integridad: email único, saldos, tokens, permisos | `db-integrity-migrations` |
| E | Panel de administración | `admin-panel-fixes` |
| A | Seguridad de la API: entorno, rate limiting, login uniforme | `sec-hardening-api` |
| G | Rutas legales, reseteo de contraseña, URLs de media firmadas | `legal-public-routes` |
| C | Economía de créditos: ciclo del loop, cancelación, borrado de cuenta | `credit-economy-integrity` |
| H | Contención de errores de render en el cliente (error boundaries) | `client-render-resilience` |

---

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

---

# Pruebas manuales — `sec-hardening-api` (bloque A, auditoría 2026-09)

> Cambios de seguridad y configuración en `server/api/`, con dos ediciones puntuales en
> `adminClient/` y `docker-compose.e2e.yml`. Validado en esta sesión contra un Postgres 16
> desechable (`localhost:5433`) con `tsx` corriendo `src/index.ts` directo — **no** contra el
> stack completo de docker compose ni contra un build real de ningún cliente. Todo lo que sigue
> necesita confirmarse a mano antes de mergear.

## 0. LO MÁS URGENTE — variables de entorno nuevas que el operador tiene que setear antes de deployar

**Si esto no se hace antes del deploy, el contenedor de producción se niega a arrancar** (a
propósito — es el punto central del cambio). Cuatro son secretos/URLs nuevos que antes no
existían en absoluto:

- `ADMIN_JWT_SECRET` — nuevo secreto, distinto de `JWT_SECRET`. Generá uno random, largo, y
  **no lo reutilices** de `JWT_SECRET`.
- `ADMIN_PASS_TOKEN` — ya se leía del entorno pero nunca era obligatorio; ahora sí.
- `FRONTEND_URL`, `ADMIN_FRONTEND_URL` — ya se usaban, pero ahora son obligatorios en producción,
  sin default.
- `WEB_GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_CLIENT_ID` — ya se usaban, ahora obligatorios en
  producción (el login de Google literalmente no valida el `aud` si faltan — es la vulnerabilidad
  real que este cambio cierra).
- `DB_APP_PASSWORD`, `DB_UNSCOPED_PASSWORD` — ya eran necesarias en la práctica, pero antes tenían
  un fallback silencioso a `POSTGRES_PASSWORD` o a un valor hardcodeado. Ese fallback **ya no
  existe en producción** — confirmá que el `.env` real del host las tiene seteadas explícitamente,
  no de arrastre.

**Cómo confirmarlo sin arriesgar el deploy real**: correr el contenedor de producción una vez en
un entorno de prueba con el `.env` real del host tal cual está hoy, y ver si arranca o aborta
nombrando variables faltantes. Si aborta, el mensaje lista **todas** las que faltan de una — no
hace falta reiniciar variable por variable.

## 1. `TOKEN_EXP` — esto desloguea a todo el mundo en el próximo deploy (aunque nadie cambie nada)

`TOKEN_EXP` (30 días) y `ADMIN_TOKEN_EXP` (30 minutos) tenían un bug: si el valor venía como
string desde el entorno, `jsonwebtoken` lo interpretaba como **milisegundos**, así que un token
"de 30 días" en realidad duraba ~43 minutos. Ese bug está arreglado ahora — `TOKEN_EXP` se
interpreta como segundos, correctamente, siempre.

**Consecuencia para el operador**: si el `.env` del host **ya tenía** `TOKEN_EXP` seteado como
string (lo más probable, viniendo de un archivo `.env`), los tokens ya emitidos con el bug viejo
seguían durando ~43 minutos — así que en la práctica casi nadie tenía sesiones de usuario de más
de una hora, aunque creyeran que duraban 30 días. Con el fix, los tokens **nuevos** (emitidos
después del deploy) van a durar los 30 días reales. Esto no desloguea a nadie de golpe — es al
revés, las sesiones van a durar más de lo que la gente está acostumbrada. Igual, avisale al
equipo de soporte: si alguien pregunta "¿por qué ya no me pide login tan seguido?", es este
cambio, no un bug nuevo.

Lo que **sí** desloguea de una: `ADMIN_JWT_SECRET` es una clave nueva. **Todas las sesiones de
admin activas al momento del deploy van a cerrarse** (el token de admin ya no verifica contra la
clave vieja). El impacto es chico porque el token de admin dura 30 minutos — a los 30 minutos de
cualquier forma tenían que volver a loguearse.

## 2. Confirmar que las imágenes subidas se siguen viendo (`helmet`)

Esto es lo más probable que rompa la UI silenciosamente. `helmet` ahora está activo con
`crossOriginResourcePolicy: cross-origin` explícito — pero no se probó contra un build real de
ningún cliente en esta sesión.

1. Con el cliente Expo **web** corriendo contra esta API, abrir un perfil o una publicación con
   imagen y confirmar que la imagen carga. Si no carga, mirar la consola del navegador: un error
   de `Cross-Origin-Resource-Policy` ahí confirma que algo quedó mal configurado.
2. Repetir en el panel de admin (`adminClient`), en cualquier pantalla con logos de comunidad o
   colegio.

## 3. Rate limiting — confirmar que no rompe el uso normal

Validado en esta sesión que el límite **funciona** (429 al pasar el máximo, ver evidencia en el
reporte de la sesión) y que se puede apagar con `RATE_LIMIT_ENABLED=false`. Lo que falta:

1. Uso normal de la app (varios logins de prueba en un rato de trabajo normal) sin que nadie vea
   un 429 inesperado.
2. Confirmar que `docker-compose.e2e.yml` (ya tiene `RATE_LIMIT_ENABLED: "false"` agregado en esta
   sesión) efectivamente corre la suite completa de e2e sin que ningún test falle por un 429 — la
   suite completa **no se corrió** esta sesión.

## 4. Login de Google real

El código fuerza que `/auth/google-login` solo acepte tokens de los clientes web/Android/iOS, y
que el login de Google del panel de admin solo acepte el cliente de admin — deliberadamente
**no** se puede colar un token de la app de usuarios en el panel de admin. Esto no se pudo probar
con una cuenta de Google real en esta sesión (sandbox sin credenciales de OAuth).

1. Login de Google en la app de usuarios (web y, si es posible, nativo): confirmar que funciona
   normal.
2. Login de Google en el panel de admin, con una cuenta autorizada: confirmar que funciona.
3. Si es posible armar el escenario: confirmar que un token de Google emitido para el cliente web
   de usuarios **no** sirve para entrar al panel de admin (debería fallar con
   `GOOGLE_CREDENTIAL_INVALID` o similar).

## 5. `SCHOOL_IDS_REQUIRED` ahora es 409, no 200 — flujo de registro por Google sin colegio elegido

1. En la app, iniciar un registro por Google con una cuenta nueva, **sin** elegir colegios antes.
2. Confirmar que la pantalla de selección de colegios se abre igual que antes (el cambio de 200 a
   409 está pensado para no romper este flujo — al contrario, repara un bug latente donde la
   comunidad pre-resuelta se perdía). Si la pantalla no abre o aparece un error genérico en vez
   del flujo esperado, es una regresión real de este cambio.

## 6. Panel de admin — formularios nuevos con validación real

Antes, `Modificar créditos`, `Reiniciar contraseña`, `Enviar notificación`, `Crear/Editar colegio`
no validaban el body en el servidor. Ahora sí. No se probó contra el panel corriendo en esta
sesión:

1. **Modificar créditos**: probar un monto negativo, cero, con decimales, y como texto — los
   cuatro tienen que rechazarse con un error legible, no un 500 ni un descuento accidental.
2. **Reiniciar contraseña de usuario**: una contraseña de menos de 8 caracteres tiene que
   rechazarse (el mínimo subió de facto a 8, igual que en el resto del cambio).
3. **Enviar notificación**: un tipo fuera de {mission, loop, donation, admin} tiene que
   rechazarse; el payload tiene que coincidir con la forma esperada para ese tipo.
4. **Crear/Editar colegio**: nombre vacío o `mediaId` inválido tienen que rechazarse.
5. **Password del propio panel de admin**: alta de un admin nuevo o "olvidé mi contraseña" (si
   existe) ahora exige 8 caracteres mínimo — confirmar que el formulario lo valida localmente
   (mensaje en el momento, no solo al mandar) y que el servidor lo rechaza si se lo evita.
   **El login de admin existente sigue aceptando contraseñas de 6-7 caracteres** — no debería
   bloquear a nadie que ya tenía cuenta.

## 7. `.env.template` — el archivo no se pudo tocar desde esta sesión

Por una restricción de permisos del entorno de esta sesión (no del diseño del cambio), no se pudo
leer ni escribir `.env.template` ni `server/.env.template`. Alguien con acceso normal al
filesystem tiene que:

1. Agregar al `.env.template` de la raíz las claves nuevas: `ADMIN_JWT_SECRET`, `ADMIN_PASS_TOKEN`,
   `TOKEN_EXP`, `ADMIN_TOKEN_EXP`, `RATE_LIMIT_ENABLED`, `EMAIL_DEBUG_LINKS`, `FRONTEND_URL`,
   `ADMIN_FRONTEND_URL`, `PORT`, `POSTGRES_PORT`, `DB_APP_USER`, `DB_APP_PASSWORD`,
   `DB_UNSCOPED_USER`, `DB_UNSCOPED_PASSWORD`, `UPLOAD_DIR`, `WEB_GOOGLE_CLIENT_ID`,
   `ANDROID_GOOGLE_CLIENT_ID`, `IOS_GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_CLIENT_ID` — la fuente de
   verdad de cuáles y con qué default es `server/api/src/env.ts`, que sí es legible.
2. Borrar `server/.env.template` (queda reemplazado por el de la raíz).
3. Ver `openspec/changes/sec-hardening-api/tasks.md`, tarea 7.5/7.6, para el detalle completo.

## 8. Hand-offs a `delivery-and-ci` — archivos que este cambio no pudo tocar directamente

- `docker-compose.dev.yml` y `compose.yml` necesitan las variables nuevas listadas en el punto 0,
  en el `environment:` del servicio `api`. `RATE_LIMIT_ENABLED` en `compose.yml` (producción)
  tiene que ser `"true"` o no estar seteada — **nunca** `"false"`, o el contenedor no arranca.
- `Dockerfile.api` necesita `ENV NODE_ENV=production` en el stage de producción — hoy la imagen no
  fija esa variable por sí sola, así que un contenedor corrido fuera de `compose.yml` se saltea
  todos los chequeos de producción de este cambio.
- Detalle completo en `openspec/changes/sec-hardening-api/tasks.md`, tareas 7.4, 7.8, 7.10.

## 9. Suite de e2e completa

`npm run test:e2e` no se corrió en esta sesión (necesita levantar el stack completo de docker
compose, que no se orquestó). Correrla antes de mergear y confirmar que sigue en 40+/40 verde,
en particular los flujos de login, registro y Google sign-in, que son los que este cambio toca
más directo.

---

# Pruebas manuales — `legal-public-routes` (bloque G, auditoría 2026-09)

> Rutas legales públicas, aceptación de términos versionada, reseteo de contraseña y URLs de
> media firmadas. Migraciones `0015`/`0016` ya se aplicaron y verificaron contra la base
> descartable de `localhost:5433` (idempotentes en una segunda corrida). `tsc --noEmit` y los
> tests automáticos de este bloque (`legal-routes.test.ts`, `legal-content.test.ts`,
> `mediaSigning.test.ts`, `uploads.test.ts`, `legalPublicRoutes.test.ts` con `RUN_DB_TESTS=1`) ya
> corrieron en verde. La suite completa del cliente sigue en 843/843. Lo que sigue son los puntos
> que **no** se pueden verificar sin un build de verdad, un dispositivo, un mail real o —
> especialmente el punto 0 — sin una persona con criterio legal.

## 0. GATE LEGAL — NO SE PUEDE SALTEAR, NO LO PUEDE HACER UN AGENTE (el más importante de todos)

**El texto de la política de privacidad y de los términos que este cambio agrega es una
PLANTILLA ESTRUCTURAL, no un texto legal revisado.** Cada página (`/privacidad`, `/terminos`,
y también la pantalla de términos dentro de la app) muestra hoy, a propósito y de forma visible,
el cartel **"REVISIÓN LEGAL PENDIENTE"**. Los diez placeholders (`{{DATOS_RECOLECTADOS}}`,
`{{FINALIDAD}}`, `{{BASE_LEGAL}}`, `{{CONSERVACION}}`, `{{TERCEROS}}`, `{{MENORES}}`,
`{{DERECHOS}}`, `{{CONTACTO}}`, `{{JURISDICCION}}`, `{{VIGENCIA}}`) siguen literalmente como
`{{...}}` en `client/content/legal/privacyPolicy.ts` — ninguno fue completado, y **no debía
serlo**: completarlos es exactamente lo que este gate exige que haga un humano.

- **`{{MENORES}}` es el que más importa**: Loop lo usan familias de colegios, así que la cláusula
  de menores es obligatoria y su redacción **no** fue intentada acá a propósito.
- **Nadie debe enviar la app a revisión de App Store ni Google Play mientras estos carteles sigan
  visibles.** Ni siquiera para una versión "de prueba" — las tiendas evalúan el contenido real.
- Antes de publicar: (1) un abogado, o quien en la organización asuma por escrito el riesgo,
  completa cada placeholder con texto real; (2) se borran los carteles `REVISIÓN LEGAL PENDIENTE`
  del código (`client/content/legal/privacyPolicy.ts`, `termsDocument.ts`,
  `PrivacyPolicy.tsx`, `TermsDocument.tsx`, `Terms.tsx`) y los banners `LEGAL-REVIEW-REQUIRED`;
  (3) recién ahí se pegan las URLs de `openspec/changes/legal-public-routes/STORE-LISTING.md` en
  App Store Connect / Play Console.

## 1. Las tres páginas públicas, en un navegador limpio (sin sesión, sin cookies)

1. `curl -sS https://<tu-dominio>/privacidad` (o abrir en una ventana privada) y confirmar que el
   HTML crudo (antes de que corra ningún JS) ya trae el título "Política de privacidad - Loop" y
   el texto de las secciones — no la pantalla de login ni el landing.
2. Repetir con `/terminos` y `/borrar-cuenta`.
3. Confirmar que `/listing/<cualquier-uuid>` sigue funcionando igual que antes (200, la app se
   abre normal) — es la ruta dinámica que este cambio tenía que dejar intacta.
4. **Nota de lo que se encontró en esta sesión**: la config `serve.json` original del plan (tres
   reglas específicas + un catch-all `**` al final) resultó estar rota en `serve@14` — el
   catch-all termina ganándole a TODAS las reglas, específicas o no, así que se cambió el enfoque
   (ver `tasks.md` fase 1, tarea 1.5, para el detalle técnico). Confirmado con `expo export` +
   `serve` reales, no solo leyendo el código fuente de `serve-handler`.
5. **`docker build` de `Dockerfile.web` no se corrió en esta sesión** — esta máquina es también el
   host de producción de Coolify (ver `AUDITORIA-PROGRESO.md`, hallazgo D-01), y un build
   multi-stage completo es un salto de memoria más largo y más grande que el que ya se verificó
   (`expo export` + `serve` corriendo directo). Antes de mergear: correr
   `docker build -f Dockerfile.web .` una vez en una máquina que no sea el host de producción, o
   en el propio host solo si hay margen de memoria de sobra, y repetir los curls del punto 1-3
   contra el contenedor real.

## 2. Aceptación de términos — que sobreviva un logout/login

1. Loguearse con una cuenta que **nunca** vio la pantalla de términos nueva (o que tenga
   `terms_version` en NULL en la base).
2. Confirmar que aparece la pantalla de términos, con el nombre de **tu propia comunidad** (no
   "La Red Itinere" hardcodeado).
3. Aceptar. Confirmar que entra a la app normal.
4. Cerrar sesión y volver a loguearse (o loguearse en otro dispositivo con la misma cuenta):
   **no debe volver a preguntar los términos.** Este es el bug que el cambio arregla (antes se
   perdía el flag al cerrar sesión).
5. Con la API caída o sin red, tocar "Aceptar": confirmar que igual entra a la app (no debe
   trabar al usuario por un POST que falla) y que, al recuperar la conexión y volver a abrir la
   app, no queda en un estado raro.
6. Tocar "Rechazar" **en la versión web** (navegador): confirmar que ya no se queda colgado en la
   pantalla sin feedback (el bug viejo era un `BackHandler.exitApp()` que no hace nada en web) —
   ahora debe mostrar un aviso y cerrar sesión.

## 3. `/terminos?c=<slug>` — nombre de comunidad dinámico desde afuera de la app

1. Sin sesión, abrir `/terminos?c=<slug-de-una-comunidad-real>` y confirmar que el documento dice
   el nombre de **esa** comunidad.
2. Abrir `/terminos` sin ningún `?c=` y confirmar que muestra una etiqueta neutra ("tu
   comunidad"), sin inventar ningún nombre.
3. Abrir `/terminos?c=no-existe-esta-comunidad` y confirmar que **no** rompe la página (misma
   etiqueta neutra, sin pantalla de error).

## 4. Reseteo de contraseña de punta a punta (necesita Resend configurado o revisar los logs)

1. Desde el login, tocar "¿Olvidaste tu contraseña?", pedir el reseteo con un email real.
2. Confirmar que llega el mail (o, si `RESEND_API_KEY` no está seteada, que el link aparece en
   los logs del API — **solo fuera de producción**, en producción el link ya no se loguea en
   texto plano a propósito).
3. Abrir el link (`.../reset-password?token=...`), poner una contraseña nueva, confirmar que
   funciona y que ahora se puede loguear con la contraseña nueva.
4. Volver a usar el mismo link: confirmar que da error (el token ya se usó, no debe funcionar dos
   veces).
5. Pedir dos reseteos seguidos para la misma cuenta y confirmar que **solo el segundo link
   funciona** (pedir uno nuevo invalida el anterior).
6. Confirmar que una cuenta con el mail sin verificar, después de resetear la contraseña
   exitosamente, **ya puede loguearse** (el reseteo también marca el mail como verificado, a
   propósito).

## 5. Rate limiting de los dos endpoints nuevos — YA RESUELTO, solo confirmar

`sec-hardening-api` agregó los limiters (`forgotPasswordLimiter`/`resetPasswordLimiter`) durante
esta misma sesión, así que **no** debería quedar pendiente. Igual, antes de confiar en producción:

1. Pedir un reseteo de contraseña muchas veces seguidas para el mismo email y confirmar que en
   algún momento responde `429` con un mensaje legible, no un 500 ni que siga aceptando sin
   límite.
2. Confirmar que un uso normal (una o dos veces por sesión de trabajo) nunca pega el límite por
   accidente.

## 6. URLs de media firmadas — EL PUNTO DE MAYOR RIESGO, apagado por defecto a propósito

`MEDIA_URL_SIGNING_ENABLED` es `false` por defecto: hoy, sin tocar nada, el comportamiento es
exactamente el de antes (URL sin firmar, `express.static` sirve directo). El código y los tests
automáticos (`mediaSigning.test.ts`, `uploads.test.ts`) prueban el mecanismo de firma en
aislamiento, pero **nadie corrió la app real con imágenes reales y el flag prendido** en esta
sesión — no había un dev stack con datos de ejemplo disponible. Antes de prender el flag en
cualquier ambiente real:

1. En un ambiente de prueba (nunca producción primero), setear `MEDIA_SIGNING_SECRET` y
   `MEDIA_URL_SIGNING_ENABLED=true`.
2. Abrir la app cliente y confirmar que **todas** estas pantallas siguen mostrando sus imágenes
   sin ningún cambio de código: tarjetas de publicación (listado y detalle), galería de imágenes
   de una publicación, foto de perfil, chat (avatares), tarjetas de colegio y de usuario, el
   aviso de dominios permitidos.
3. Repetir en el panel de admin: tabla de colegios, modales de editar/crear colegio, modal de
   comunidad, listado de comunidades.
4. Copiar la URL de una imagen desde las herramientas de desarrollo del navegador y confirmar que
   trae `?exp=...&sig=...` al final.
5. Esperar a que venza el `exp` de una URL copiada (o simular reloj adelantado) y confirmar que
   la imagen deja de cargar — así se sabe que la expiración realmente corta el acceso, no solo en
   el test aislado.
6. Confirmar que el modo demo (`DEMO_MODE=true`) sigue funcionando exactamente igual con el flag
   prendido o apagado — las imágenes demo son URLs absolutas y nunca deberían pasar por la firma.
7. Si algo no carga: **apagar `MEDIA_URL_SIGNING_ENABLED` inmediatamente** — es reversible sin
   ninguna migración de datos ni rebuild de cliente/admin, por diseño.

## 7. `.env.template` — no se pudo tocar desde esta sesión (igual que en `sec-hardening-api`)

Los permisos de esta sesión niegan leer o escribir cualquier archivo `.env*`, plantilla o no.
Alguien con acceso normal al filesystem tiene que agregar a `.env.template`:

- `MEDIA_URL_SIGNING_ENABLED` (default `false`)
- `MEDIA_SIGNING_SECRET` (obligatoria si el flag anterior es `true`)
- `MEDIA_SIGNING_SECRET_PREVIOUS` (opcional, solo durante una rotación de secreto)
- `MEDIA_URL_TTL_SECONDS` (default `86400`)
- `MEDIA_URL_BUCKET_SECONDS` (default `3600`)
- `EXPO_PUBLIC_LEGAL_BASE_URL` (opcional, default `https://loop.reditinere.com`)

## 8. Lectura en dispositivo real de las tres páginas legales y el formulario de borrado (2.8)

En un teléfono real o simulando 375px y 1280px de ancho:

1. `/privacidad` y `/terminos`: texto legible, se puede hacer scroll completo, el cartel
   "REVISIÓN LEGAL PENDIENTE" se ve sin tener que buscarlo.
2. `/borrar-cuenta`: el formulario entra sin cortarse, el botón de enviar es alcanzable sin
   scroll horizontal, y probar el envío con un email real de prueba — confirmar que el mensaje de
   éxito nunca dice "encontramos tu cuenta" (siempre dice que la solicitud quedó registrada, haya
   o no cuenta con ese mail, a propósito).

## 9. Vínculos dentro de la app (nuevo en Ajustes y en Registro)

1. Desde `Ajustes`, confirmar que aparece un grupo nuevo "Legal" con "Política de privacidad" y
   "Términos y condiciones", y que tocarlos navega a `/privacidad`/`/terminos` sin cerrar sesión
   ni perder el estado.
2. Desde la pantalla de Registro, confirmar que el texto antes de enviar el formulario tiene los
   dos links (términos y privacidad) y que se pueden tocar sin perder lo ya tipeado en el
   formulario.

---

# Pruebas manuales — `credit-economy-integrity` (bloque C, auditoría 2026-09)

> Cambios en `server/api/` (modelos, queries, migración `0014`) y en dos archivos de
> `e2e/tests/`. Validado en esta sesión contra un Postgres 16 desechable
> (`localhost:5433`, `loop-audit-db`) llamando a los modelos reales (`ListingsModel`,
> `UsersModel`, `SelfModel`) desde scripts descartables, más una prueba de concurrencia real en
> Jest (`src/tests/creditConcurrency.test.ts`, gateada detrás de `RUN_DB_TESTS=1`) que se
> confirmó FALLA contra el código viejo (con `git stash`) y PASA contra el nuevo. **No se corrió
> el flujo HTTP completo** (no se levantó el server ni se probó desde un cliente real) — todo lo
> que sigue hay que confirmarlo a mano, con la app o con Postman/curl contra un server corriendo.

## 0. Lo más urgente — qué tiene que correr el operador al desplegar

**La migración `0014_credit_ledger_integrity.sql` tiene que aplicarse en el mismo deploy que este
código**, y solo después de que `db-integrity-migrations` (bloque B, `0009`-`0013`) ya esté
aplicado — el runner lo garantiza solo (ordena por nombre de archivo), pero si alguien alguna vez
corre migraciones a mano fuera del runner, el orden importa: `0010` (que deja los saldos en
`>= 0`) tiene que ir antes que `0014` (que asume eso para las filas de apertura del ledger).

1. Correr `npm run migrate` (o el equivalente en el compose de producción) y confirmar en el log
   que `0014_credit_ledger_integrity` aparece con un ✓, y que el mensaje final es
   "Migraciones al día." al volver a correrlo.
2. **Inmediatamente después**, correr `npm run reconcile-credits` contra la base real y confirmar
   que reporta `0 discrepancias`. Si reporta alguna, **no seguir con el deploy de este código**
   hasta entenderla — es la prueba de que las filas de apertura del ledger (`genesis_opening_balance`,
   una por usuario existente) quedaron bien calculadas. El script es de solo lectura: no repara
   nada, así que correrlo no tiene riesgo.
3. Guardar la salida de `reconcile-credits` de este primer deploy como línea de base — es el único
   momento en que se puede comparar "antes había cero discrepancias" con cualquier duda futura.

## 1. El ciclo completo de un loop, de punta a punta (crítico)

Con dos cuentas reales (comprador y vendedor) y créditos suficientes:

1. Publicar un artículo (vendedor). Confirmar que el saldo del vendedor sube por las misiones de
   publicación (`publish-listing-1/2/3`), como siempre.
2. Ofertar (comprador). Confirmar: el saldo del comprador baja exactamente lo ofertado, y
   "bloqueado" sube lo mismo — **la app tiene que mostrar ambos números**, no solo el saldo
   (`credit-ledger`: mostrar `balance_after` solo sería engañoso, el crédito no se perdió, está
   escrow). El vendedor recibe la notificación de nueva oferta.
3. Aceptar la oferta (vendedor), con y sin un ítem de intercambio (trade-in). Con trade-in que
   *supera* el precio, el vendedor también debería ver que se le bloquea la diferencia. Confirmar
   que el comprador recibe la notificación de "oferta aceptada".
4. Recibir (comprador). Confirmar que el saldo bloqueado del comprador baja a 0 y el saldo del
   vendedor sube lo pactado. El vendedor recibe "loop completado".
5. **Repetir el mismo flujo intentando ofertar dos veces a la vez sobre la misma publicación**
   desde dos cuentas distintas (dos teléfonos, o dos pestañas) — antes esto corrompía
   silenciosamente los créditos; ahora una de las dos tiene que recibir un error claro y su saldo
   no debe quedar bloqueado. (Ya probado automáticamente contra la base real, pero vale
   confirmarlo una vez desde la UI real.)

## 2. Los caminos de cancelación — nuevos, nunca expuestos antes (crítico)

Antes de este cambio, un loop `accepted` **no tenía ninguna salida**: ni el botón de Cancelar
andaba (estaba muerto en el cliente) ni el endpoint existía en el servidor. Ahora sí:

1. Con un loop en estado `accepted` (oferta aceptada, todavía no recibido), **como vendedor**,
   cancelar. Confirmar: la publicación vuelve a estar publicada y visible en el feed, sin
   comprador; el comprador recupera exactamente lo que tenía bloqueado para ESE loop (ni más ni
   menos — si el comprador tiene otro loop abierto en paralelo, ese no se debe tocar); si había
   un ítem de intercambio de por medio, ese ítem también vuelve a estar publicado y sin dueño.
2. Repetir, pero cancelando **como comprador** — antes ni siquiera el vendedor podía cancelar
   desde la UI, así que probar el lado del comprador es integralmente nuevo. Mismo resultado:
   ambas partes recuperan lo suyo.
3. Confirmar que un tercero (ni comprador ni vendedor de ese loop) **no puede** cancelarlo.
4. Confirmar que cancelar una publicación que está `published` u `offered` (todavía no aceptada)
   da un error claro, y que cancelar una ya `received` (loop terminado) también — un loop
   entregado es definitivo, no se puede deshacer.
5. **La UI del cliente todavía no está conectada a este endpoint nuevo** (`POST
   /listings/:listingId/cancel` existe y funciona en el servidor, probado directamente; el botón
   "Cancelar" del cliente sigue sin `onPress` — quedó fuera de esta sesión por los límites de
   archivos que podía tocar). Hasta que alguien conecte el cliente, la única forma de probar esto
   es con Postman/curl/Insomnia autenticado como el comprador o el vendedor, contra
   `POST /listings/<id>/cancel`. Es el pendiente más importante de esta lista.

## 3. Qué le pasa al crédito de un tercero cuando se borra una cuenta

Este es el escenario que antes dejaba crédito bloqueado varado para siempre contra una
publicación que dejaba de existir:

1. Usuario A publica un artículo. Usuario B oferta créditos sobre esa publicación (queda
   `offered`, con el crédito de B bloqueado). **Usuario A borra su cuenta** (`DELETE /me`, o un
   admin resuelve una solicitud de borrado marcándola "completada").
   - Confirmar que el saldo bloqueado de B se libera de vuelta a su saldo disponible.
   - Confirmar que B ya no ve esa publicación en su lista de ofertas activas.
2. Escenario inverso: A publica, B oferta, **A acepta la oferta con un ítem de intercambio de B**
   (queda `accepted`). Ahora **usuario B borra su cuenta** (el comprador se va, no el vendedor).
   - Confirmar que el crédito que A tenía bloqueado de más (por el trade-in) se le libera.
   - Confirmar que el ítem de intercambio de B (que pasó a estar "vendido" a nombre de A) también
     queda consistente — no debería quedar una publicación fantasma.
3. Escenario de "no reabrir lo ya cerrado": A vende y B recibe (loop `received`, ya liquidado).
   **B borra su cuenta después.** Confirmar que esa publicación **sigue** en `received` — no
   debe volver a `published` como pasaba antes (el bug que reabría loops ya entregados).
4. Como admin, ver el historial de "movimientos" de un usuario cuya contraparte se borró (si el
   panel llega a mostrar esto en el futuro — hoy no hay pantalla de movimientos, PROD-10 queda
   fuera de esta sesión): las filas del usuario borrado deberían aparecer como "usuario borrado"
   en vez de desaparecer del todo, porque el historial se conserva, solo se anonimiza.

## 4. Donaciones: límites nuevos

1. Donar un monto por debajo del mínimo configurado (`DONATION_MIN_CREDITS`, default 1): debe
   rechazarse con un error claro.
2. Donar un monto por encima del máximo por donación (`DONATION_MAX_CREDITS`, default 100.000):
   debe rechazarse.
3. Donar varias veces en el mismo día hasta superar el tope diario (`DONATION_DAILY_MAX_CREDITS`,
   default 200.000, sumado sobre las donaciones YA hechas hoy): la que cruza el tope debe
   rechazarse, aunque cada donación individual esté dentro del máximo por request.
4. Intentar donarse a uno mismo: debe rechazarse con un mensaje claro (antes daba el genérico
   "datos inválidos"; ahora el mensaje debería ser más específico — confirmar que el texto en la
   UI sigue siendo comprensible con el nuevo código de error).
5. Si el panel de admin llega a mostrar límites de donación como configurables por comunidad en
   el futuro: hoy son constantes globales (`config.ts`), no por comunidad — confirmar que nadie
   asume lo contrario.

## 5. Reconciliación como herramienta de operación

`npm run reconcile-credits` es de solo lectura y no repara nada — es una alarma, no un arreglo.

1. Correrlo contra la base de producción una vez por semana (o después de cualquier incidente
   raro con créditos) y confirmar que reporta 0 discrepancias.
2. Si alguna vez reporta una discrepancia, **no correr nada que la "arregle" automáticamente** —
   no existe tal comando a propósito. Investigar a mano qué movimiento no pasó por el choque
   único (`applyCreditMovements`) antes de tocar cualquier saldo.

## 6. Lo que quedó explícitamente fuera de esta sesión (decisión de producto, no bug)

**ECO-07 — ofertar por debajo del precio sin intercambio sigue siendo imposible de aceptar.**
Esto es intencional: si un comprador oferta menos del precio pedido y no agrega ningún ítem de
intercambio, el vendedor **nunca** va a poder aceptar esa oferta — se queda con el crédito del
comprador bloqueado hasta que alguien la rechace o el comprador la retire. Es una regla que ya
existía, documentada pero no arreglada en este cambio porque requiere una decisión de producto
(¿el precio es fijo, o el vendedor puede aceptar con descuento?). Confirmar que este
comportamiento sigue exactamente igual — **no** debería poder aceptarse una oferta así.

## 7. Lo que un humano tiene que revisar en el código, no solo probar

- El botón "Cancelar" del cliente (`client/components/ListingButtons.tsx:114-116`) sigue sin
  `onPress`. El endpoint que necesita ya existe y está probado (`POST
  /listings/:listingId/cancel`); falta conectar `client/hooks/useListingCancel.ts` (no existe
  todavía) siguiendo el patrón de `client/hooks/useListingRejectOffer.ts`, y mostrar el control
  también al comprador, no solo al vendedor.
- `server/api/src/tests/utils.ts` (mock de queries para los tests unitarios) tiene dos lugares
  (`MOCK_SCHOOL.media.id` en las líneas ~470 y ~490) que ahora no compilan limpio porque
  `School.media` pasó a ser `Media | null` (notification-integrity: un colegio con el logo roto
  ya no se descarta de la lista, se devuelve con `media: null`). No se tocó ese archivo porque
  está fuera del alcance de edición de este bloque en la sesión — necesita un ajuste de una
  línea (null-check o `!`) que le corresponde a quien esté limpiando `src/tests/` en paralelo.

---

# Pruebas manuales — `client-render-resilience` (bloque H, 2026-09-03)

Este bloque salió de un incidente real, no de la auditoría: el 2026-09-03 `/notifications` quedó
completamente en blanco en producción. La causa puntual (una notificación de loop apuntando a una
publicación borrada) ya está arreglada y desplegada. Lo que se agregó después es la **contención**:
hasta ese día el cliente no tenía ni un solo error boundary, así que un throw en una tarjeta
desmontaba la aplicación entera.

`cd client && npx tsc --noEmit`, `npx eslint` y `npx jest --ci --watchAll=false` (880/880, 18 suites)
ya se verificaron automáticamente. Lo que sigue **no se puede** verificar sin un navegador o un
dispositivo real.

> **Lo que un error boundary NO hace.** Atrapa throws de la **fase de render**. No atrapa errores de
> handlers de eventos (un `onPress` que revienta), ni de efectos, ni promesas rechazadas. La app no
> quedó a prueba de caídas: quedó a prueba de *este* tipo de caída, que es el que nos pasó.

## 1. Que `/notifications` haya vuelto (crítico, es el incidente)

1. Entrar a `/notifications` en producción con la cuenta que lo veía en blanco.
2. Debe listar las notificaciones. Una notificación de loop cuya publicación ya no exista debe
   mostrar la tarjeta con el texto **"Este contenido ya no está disponible"** en lugar del bloque de
   la publicación — no una pantalla en blanco.
3. Recargar la página estando en `/notifications`: **no** debe cerrar la sesión ni mandarte a `/`.
   Ese era el segundo bug del mismo día (una carrera entre `/me` y la rehidratación del token).

- [ ] Verificado en web
- [ ] Verificado en Android

## 2. Que el boundary de pestaña aísle de verdad

No hay forma limpia de forzar esto desde la UI, así que se fuerza a mano en un build de desarrollo:

1. Meter un `throw new Error("prueba")` al principio del componente de una pestaña, por ejemplo en
   `client/components/screens/Notifications.tsx`.
2. Abrir esa pestaña: debe verse el fallback ("Algo salió mal", con el mensaje del error porque es
   `__DEV__`), **no** una pantalla en blanco.
3. **Las otras pestañas tienen que seguir navegables.** Este es el punto entero del cambio: si al
   romper Notificaciones se cae también Inicio, la contención no está funcionando.
4. Tocar "Ir al inicio": debe llevar a la pestaña de inicio.
5. Sacar el `throw` antes de commitear nada.

- [ ] Verificado en web
- [ ] Verificado en Android

## 3. El reintento

Con el fallback en pantalla (mismo truco que el punto 2, pero haciendo que el throw dependa de datos
en caché en vez de ser incondicional):

1. Tocar "Reintentar": debe limpiar la caché de queries y volver a montar la pantalla.
2. Si el dato que causaba el error ya está bien, la pantalla carga normal.
3. Si sigue mal, vuelve el fallback — y **la salida tiene que seguir funcionando**. Que el reintento
   falle en loop no puede dejarte encerrado.

- [ ] Verificado

## 4. Recargar desde el boundary raíz — SOLO se puede probar a mano

`Updates.reloadAsync()` no se puede ejercitar en Jest y además **tira error en `__DEV__`**. O sea:
este camino no lo cubre ningún test, en ninguna plataforma. Hay que verlo con los ojos.

1. **Web:** forzar un throw en `client/app/_layout.tsx`. El fallback raíz debe ofrecer "Recargar la
   app" (no "Ir al inicio": en el raíz la navegación puede ser justamente lo que está roto). Tocarlo
   debe recargar la página.
2. **Android, build de producción o preview** (no en Expo Go ni en dev): mismo throw, tocar "Recargar
   la app" debe reiniciar el bundle. En un build de desarrollo va a fallar en silencio y quedarse en
   el fallback — eso es esperado, no es un bug.

- [ ] Verificado en web
- [ ] Verificado en Android (build de producción o preview)

## 5. Que el fallback no filtre el error a los usuarios

En un build de **producción**, con el fallback en pantalla: debe verse "Algo salió mal" y los dos
botones, y **no** el `error.message`. El detalle del error solo sale bajo `__DEV__`.

- [ ] Verificado

## Lo que quedó afuera a propósito

No son olvidos; están anotados como trabajo siguiente en
`openspec/changes/client-render-resilience/`:

- **Boundaries por ítem de lista.** Hoy un throw en una tarjeta se lleva puesta la pestaña entera.
  Contenerlo por fila necesita una clase a mano y una convención para que ningún call site nuevo se
  la olvide — es diseño, no un agregado.
- **19 rutas fuera de las pestañas siguen sin contención** (`listing/**`, `user/[userId]`,
  `settings`, `(auth)/**`). Caen al boundary raíz, que las agarra, pero se llevan toda la app en vez
  de una pestaña.
- **No hay dónde reportar los errores contenidos.** No hay Sentry ni equivalente, así que a partir
  de ahora un error atrapado es *invisible* para nosotros: el usuario ve un fallback prolijo y
  nosotros no nos enteramos. Antes al menos se caía de forma ruidosa. Es un intercambio consciente,
  pero conviene tenerlo presente.
