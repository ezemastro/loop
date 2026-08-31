# Datos de demostración

Loop tiene un solo conjunto de datos de ejemplo, en `shared/demo-data/`, que alimenta dos cosas
distintas:

|                        | Dónde vive el dato                   | Cómo se activa                                                   |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| **Seed de desarrollo** | Postgres, escrito por `npm run seed` | `npm run dev:seed`, y después entrás con usuario y contraseña    |
| **Modo demo**          | Memoria del dispositivo, sin red     | Un enlace en la portada (`/`), en la misma producción de siempre |

Son el mismo dataset. El seed de desarrollo trae **tres comunidades** para poder ver el aislamiento
entre inquilinos; el modo demo trae **una sola**, que es todo lo que hace falta para un recorrido.

Si una pantalla se ve distinta en desarrollo y en la demo, la diferencia está en un adaptador
(`client/demo/db/` o `server/api/src/scripts/seed.ts`), nunca en los datos.

**¿Buscás credenciales?** Están en dos tablas separadas, porque son dos aplicaciones distintas:
[cuentas de usuario](#cuentas-de-usuario) para la app, y
[cuentas del panel](#panel-de-administración) para el admin. Todas usan la contraseña `Demo1234!`.

|                                                        |                                         |
| ------------------------------------------------------ | --------------------------------------- |
| [Cuentas de usuario](#cuentas-de-usuario)              | Las 11 cuentas de la app, por comunidad |
| [Panel de administración](#panel-de-administración)    | Super admin y admins de comunidad       |
| [Sembrar la base en dev](#desarrollo-sembrar-la-base)  | `npm run dev:seed` y qué toca           |
| [El modo demo en producción](#producción-el-modo-demo) | El enlace de la portada y sus garantías |
| [Tocar el dataset](#tocar-el-dataset)                  | Dónde se edita todo esto                |

---

## Cuentas de usuario

Las cuentas de la **app**. Las del **panel de administración** están en su propia sección, más
abajo: [Panel de administración](#panel-de-administración).

**Todas las cuentas —usuarios y admins— comparten la contraseña `Demo1234!`.**

### Comunidad Demo — `demo.edu`

La única que existe en el modo demo. Colegios: Escuela Primaria Demo, Escuela Secundaria Demo,
Instituto Técnico Demo.

| Email             | Nombre           | Créditos | Qué tiene                                                                                                                                                                                   |
| ----------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ana@demo.edu`    | Ana Gómez        | 1500     | **La cuenta con la que entra el modo demo.** Es la más poblada: 2 publicaciones propias, 2 compras, 4 misiones, 3 notificaciones, 2 deseos, 2 conversaciones, foto de perfil y dos colegios |
| `carlos@demo.edu` | Carlos Fernández | 900      | 2 publicaciones y una oferta hecha a Ana                                                                                                                                                    |
| `lucia@demo.edu`  | Lucía Martínez   | 1200     | 3 publicaciones, una ya entregada a Ana                                                                                                                                                     |
| `martin@demo.edu` | Martín Rodríguez | 700      | 2 publicaciones, una aceptada por Ana. Tiene foto de perfil                                                                                                                                 |
| `sofia@demo.edu`  | Sofía López      | 2000     | 1 publicación y la conversación con un mensaje sin leer                                                                                                                                     |
| `julian@demo.edu` | Julián Torres    | 450      | 1 publicación. Es quien le donó créditos a Ana                                                                                                                                              |

### Colegio Verde — `colegioverde.edu.ar` _(solo en el seed de desarrollo)_

Paleta verde, para ver que el tema cambia con la comunidad. Colegios: Colegio Verde Norte, Colegio
Verde Sur.

| Email                           | Nombre          | Créditos |
| ------------------------------- | --------------- | -------- |
| `valentina@colegioverde.edu.ar` | Valentina Pérez | 1800     |
| `tomas@colegioverde.edu.ar`     | Tomás Aguirre   | 600      |
| `camila@colegioverde.edu.ar`    | Camila Ríos     | 1100     |

### Instituto Austral — `austral.edu.uy` _(solo en el seed de desarrollo)_

Paleta azul y un solo colegio. Está sobre todo para que el aislamiento se note: desde acá no se ve
nada de las otras dos.

| Email                   | Nombre        | Créditos |
| ----------------------- | ------------- | -------- |
| `bruno@austral.edu.uy`  | Bruno Silva   | 2200     |
| `renata@austral.edu.uy` | Renata Correa | 350      |

---

## Panel de administración

**Misma contraseña: `Demo1234!`.** Se entra por `/login` del panel (`adminClient`, puerto 5173).

| Email                       | Alcance                                                                | Para probar                                                                               |
| --------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `super@loop.demo`           | **Super admin** — no pertenece a ninguna comunidad porque las ve todas | Comunidades, categorías, misiones, mover un usuario de comunidad. Todo lo global          |
| `admin@demo.edu`            | Admin de Comunidad Demo                                                | Usuarios, colegios, créditos, notificaciones, invitaciones y borrados **de su comunidad** |
| `admin@colegioverde.edu.ar` | Admin de Colegio Verde                                                 | Lo mismo, pero solo ve Colegio Verde                                                      |
| `admin@austral.edu.uy`      | Admin de Instituto Austral                                             | Lo mismo, pero solo ve Instituto Austral                                                  |

Con dos niveles y tres comunidades se puede ver lo que con un solo admin no se nota: el super admin
lista los usuarios de todas, y `admin@colegioverde.edu.ar` solo los 3 suyos. Las rutas globales
(`/admin/communities`, `/admin/missions`, `/admin/categories`) le devuelven **403** a un admin de
comunidad, porque tocarlas afectaría a todas.

### Probar el alta de admins

`nuevo@demo.edu` está **autorizado pero sin registrar**. Sirve para recorrer `POST /admin/register`
sin tener que autorizar un email antes desde el propio panel:

- Registrarse con ese email funciona y queda como `community_admin` de Comunidad Demo.
- Registrarse con cualquier otro devuelve `EMAIL_NOT_AUTHORIZED`.

La allowlist vive en `admin_valid_emails`, y el seed la deja con una fila por cada admin sembrado
más ese email pendiente. Volver a correr el seed devuelve `nuevo@demo.edu` al estado sin registrar.

### Solicitudes de borrado

Se siembra **una pendiente** (de `julian@demo.edu`, en Comunidad Demo) para que esa pantalla no
arranque vacía. Las crea el endpoint público de la landing y las resuelve un admin desde el panel.

Las **invitaciones**, en cambio, no se siembran: se crean desde el propio panel, así que esa
pantalla se prueba usándola.

---

## Desarrollo: sembrar la base

Con el stack de desarrollo levantado (`npm run dev` en la raíz):

```bash
npm run dev:migrate     # una vez, si la base es nueva
npm run dev:seed        # las tres comunidades
npm run dev:seed:demo   # solo la comunidad demo, igual que producción
```

Los dos últimos son atajos a `npm run seed` dentro del contenedor `api`. Desde `server/api`, con la
base accesible, es directamente:

```bash
npm run seed
npm run seed -- --demo
```

Al terminar imprime la tabla de cuentas, así que no hace falta volver acá.

**Es idempotente.** Antes de insertar borra todo lo que esa comunidad tenía, y cada ID se deriva del
dataset, así que correrlo diez veces deja la base igual que correrlo una. Sacar una publicación del
dataset la saca de la base en la corrida siguiente.

### Qué toca y qué no

- **Borra y reescribe**: todo lo que pertenece a las tres comunidades del dataset, incluidos sus
  admins, invitaciones y solicitudes de borrado. Nada más.
- **No toca** la comunidad `red-itinere` ni ninguna otra que ya exista, ni el admin autorizado por
  `AUTHORIZED_ADMIN_EMAIL`. El super admin del dataset se limpia por su ID y su allowlist por
  email, nunca por `community_id IS NULL`, que se llevaría puesto al super admin real del entorno.
- **Categorías**: las resuelve **por nombre**. Si `server/create_categories.sql` ya corrió, reutiliza
  esas filas en lugar de duplicarlas; solo inserta las que falten.
- **Se conecta con `POSTGRES_USER`**, el dueño de las tablas, igual que el runner de migraciones.
  No es comodidad: el dataset atraviesa varias comunidades y `loop_app` está sujeto a RLS, así que
  por diseño solo ve una comunidad por conexión.
- **Se niega a correr con `NODE_ENV=production`** salvo que le pases `--force`. Las contraseñas de
  este dataset son públicas: sembrarlo en una base con usuarios reales sería regalar cuentas.

### Entrar

Con la base sembrada, cualquiera de las cuentas de arriba entra por el login normal, escribiendo
correo y contraseña. Eso ejercita la API de verdad: JWT, RLS, comunidad resuelta por dominio.

El enlace "Explorar la demo sin crear cuenta" de la portada hace **otra cosa**: enciende el modo
demo y no toca la API. Si querés probar el backend, escribí las credenciales; si querés ver lo que
ve un visitante en producción, usá el enlace.

---

## Producción: el modo demo

El modo demo **no es una instancia aparte ni un build especial**. Vive en la producción de siempre y
se enciende por dispositivo desde la portada (`/`). No se crea ninguna cuenta, no se manda ningún
mail, no se escribe una fila.

La entrada es deliberadamente **un enlace y no un botón**: _"Explorar la demo sin crear cuenta"_, en
gris chico, debajo de la card en escritorio y debajo de los botones en celular. Quien viene a usar
Loop tiene que ver dos caminos —registrarse o entrar—, no tres; esto es una nota al pie para el que
solo quiere espiar. Si se cambia por algo más llamativo, se le está pidiendo a cada colegio nuevo
que decida entre tres cosas en vez de dos.

### Qué pasa al tocarlo

1. Se enciende el modo demo en ese dispositivo y se vacían la caché de queries y el tema.
2. Se hace un login normal con la cuenta de portada — que **lo resuelve el mock**, no la API. El
   orden importa: el modo se enciende _antes_ del login, así ni siquiera la request de entrar sale.
   Todo esto vive en `loginAsDemo`, dentro de `client/hooks/useLoginForm.ts`.
3. La sesión queda persistida junto al flag, así que recargar la página no te saca de la demo.
4. Cerrar sesión sale del modo demo. Es la única salida y siempre está disponible: mientras estés en
   demo hay una franja fija debajo del header con el aviso y un botón _Salir_.

### La garantía de aislamiento

Con el modo activo, **el adaptador nunca delega en la red**. Todo el tráfico del cliente pasa por la
misma instancia de axios (`client/api/loop.ts`) — listados, uploads, login con Google, registro del
token de push — y esa instancia tiene el adaptador del modo demo instalado siempre, activo o no.

Lo importante es el caso que no se piensa: una ruta **sin handler** en el mock devuelve 404, no sale
a buscarla a la API. O sea que el día que alguien agregue un endpoint y se olvide de mockearlo, la
demo falla a la vista en lugar de escribir en la base real. Es deliberado que falle ruidosamente.

### Lo que sí sale a la red

Auditado explícitamente, y separado a propósito de lo de arriba:

- **Las imágenes del dataset**, que salen a `picsum.photos`. Son URLs absolutas y `getUrl` las deja
  pasar sin prefijo, así que no tocan la API.
- **`u.expo.dev`** (expo-updates) y **Google OAuth**, que son de la app y no del modo demo.

Las notificaciones push, en cambio, **no** se registran en modo demo. El `POST` al backend ya lo
intercepta el mock, pero pedir el token igual saldría a los servidores de Expo y, en el celular, le
pediría permiso de notificaciones a un visitante para una sesión que no es suya.

### El detalle que hay que respetar: la hidratación

`AsyncStorage` es asíncrono. En el primer render `demoMode` vale `false` aunque el dispositivo tenga
una sesión demo guardada, porque el store todavía no volvió de disco. **Toda decisión de "esto no se
hace en modo demo" tomada en un efecto de montaje se toma con el dato equivocado**, y se equivoca
hacia el lado peligroso.

Para eso está `useSessionHydrated()` en `client/stores/session.ts`: quien decida eso en un montaje,
espera primero. Lo usa `Debug.tsx`, que es el caso agudo — `/debug` es una ruta pública, se llega por
deeplink o URL directa, y ahí el arranque en frío es la norma y no la excepción.

Para el resto de la app la ventana existe pero está cubierta por dos cosas: `onRehydrateStorage`
enciende el modo demo en el mismo turno en que aparece el token (por eso `demoMode` vive en el store
de sesión y no en uno propio), y sin token no hay request autenticada que disparar. Con la sesión
cerrada, ni la pantalla de login ni la de inicio disparan queries.

Por la misma razón `logout()` apaga el modo demo **al final**, después de limpiar todo: apagarlo
reabre la red, y hacerlo antes dejaría una ventana con la sesión simulada viva y el adaptador ya
delegando en la API real.

### Solo lectura

Aunque nada llegue a la API, la demo tampoco simula crear contenido. Todo lo que no sea `GET`
devuelve 403 con el código `DEMO_MODE_READ_ONLY`, y `client/api/loop.ts` lo convierte en un aviso —
_"Estás en modo demo: podés recorrer toda la app, pero no guardar cambios"_ — desde un solo lugar,
para que ninguna pantalla se olvide de mostrarlo.

Se bloquean 18 rutas: publicar, editar y borrar artículos, ofertar, aceptar, rechazar, recibir,
mandar mensajes, deseos, donar, subir imágenes, editar y borrar el perfil, registrarse.

Se permiten cuatro escrituras, todas en `client/demo/readOnly.ts` con el motivo al lado:

| Ruta                              | Por qué                                              |
| --------------------------------- | ---------------------------------------------------- |
| `POST /auth/login`                | Es la puerta de entrada a la demo                    |
| `POST /me/notifications/read-all` | La app la dispara sola al abrir notificaciones       |
| `POST /messages/:userId/read`     | La app la dispara sola al abrir un chat              |
| `POST /me/notification-token`     | La dispara el contexto de notificaciones al montarse |

Ninguna crea contenido ni mueve créditos. Si se bloquearan, navegar tiraría un error, que es
justo lo contrario de lo que la demo tiene que transmitir.

### El flag de build

`EXPO_PUBLIC_DEMO_MODE=true` sigue existiendo y arranca la app con el modo ya activo, sin pasar por
el enlace. Sirve para un deploy dedicado de demostración; **no hace falta para nada de lo de arriba**.

También se puede prender y apagar desde la pantalla de debug (`/debug`).

### Lo que hay que saber

- **No persiste el contenido.** Cada entrada a la demo reinicia el dataset. Nadie puede ensuciarla
  para el siguiente.
- **Una sola comunidad.** Las otras dos del dataset ni se construyen.
- **Los handlers de escritura del mock siguen existiendo** (`client/demo/handlers/`) pero hoy son
  inalcanzables: el bloqueo actúa antes del ruteo. Si algún día se quiere una demo con escritura,
  se cambia la allowlist y vuelven a andar.

---

## Tocar el dataset

Todo vive en `shared/demo-data/`:

| Archivo             | Qué tiene                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `blueprints.ts`     | **Empezá acá.** Las tres comunidades descritas en lenguaje llano: quién vende qué, quién le escribe a quién, quién las administra |
| `catalog.ts`        | Categorías y plantillas de misión, compartidas entre comunidades                                                                  |
| `buildCommunity.ts` | Expande un blueprint a entidades con IDs y referencias resueltas                                                                  |
| `types.ts`          | Las formas del dato. Son neutras a propósito: no son filas de Postgres ni respuestas de la API                                    |
| `ids.ts`            | UUIDs deterministas derivados de una semilla textual                                                                              |
| `index.ts`          | Arma `DEMO_DATASET` y `DEV_DATASET`                                                                                               |

Dentro de un blueprint todo se referencia por **clave**, nunca por índice. Si escribís mal el nombre
de una categoría o el de un miembro, el dataset revienta al construirse con un mensaje claro, en
lugar de generar un dato huérfano que aparecería como una pantalla rota tres pasos más adelante.

Las fechas se declaran como `agoHours` (hace cuántas horas), no como fechas fijas: así la demo
siempre se ve recién usada en vez de envejecer con cada mes que pasa.

Después de tocar algo:

```bash
cd server/api && npm run check-types && npm run seed
```

El modo demo no necesita nada: toma el dataset del bundle en el próximo build.
