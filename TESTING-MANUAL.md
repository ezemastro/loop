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
