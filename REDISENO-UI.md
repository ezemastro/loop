# Rediseño de UI — guía de prueba

Documento vivo. Se actualiza con cada rebanada. Pensado para que puedas probar todo de una vez
cuando esté terminado.

## Cómo levantarlo

```bash
cd /home/opencode/projects/loop
git checkout <rama de la rebanada que quieras probar>
DEV_HOST=192.168.1.37 WEB_PORT=8082 docker compose -f docker-compose.dev.yml up --watch
```

Las ramas están apiladas: cada una incluye todo lo anterior. Para probar todo junto, usá la última.

**Para deshacer todo:** `git checkout main`.

> **Sobre el header verde en modo demo.** Adentro de la app el header sigue verde a propósito: la
> comunidad de demo define su propio tema y lo conserva. Es el comportamiento multi-tenant
> especificado. La paleta Itínere nueva se ve en la **landing, antes de elegir comunidad**.

---

## Estado de las rebanadas

| # | Rama | PR | Estado |
|---|---|---|---|
| — | `feat/itinere-brand-refresh` | [#1](https://github.com/ezemastro/loop/pull/1) | Listo |
| 1 | `feat/ui-1-foundation` | [#2](https://github.com/ezemastro/loop/pull/2) | Listo |
| 2 | `feat/ui-2-listing-grid` | [#3](https://github.com/ezemastro/loop/pull/3) | Listo |
| 3 | `feat/ui-3-width-system` | [#4](https://github.com/ezemastro/loop/pull/4) | Listo |
| 4 | `feat/ui-4-fixes` | [#5](https://github.com/ezemastro/loop/pull/5) | Listo |
| 5 | `feat/ui-5-compact-card` | [#6](https://github.com/ezemastro/loop/pull/6) | Listo |
| 6 | `feat/ui-6-wide-density` | [#7](https://github.com/ezemastro/loop/pull/7) | Listo |
| 7 | `feat/ui-7-notifications` | [#8](https://github.com/ezemastro/loop/pull/8) | Listo |
| 8 | `feat/ui-8-chat` | [#9](https://github.com/ezemastro/loop/pull/9) | Listo |
| 9 | `feat/ui-9-detail` | — | Pendiente |
| 10 | `feat/ui-10-desktop-nav` | — | Pendiente |
| 11 | `feat/ui-11-settings` | — | Pendiente |

---

## Marca Itínere — `feat/itinere-brand-refresh`

### Qué cambió

La paleta por defecto pasa a ser la institucional de Red Itínere, y se renueva el set de assets.

| Clave | Antes | Ahora | Dónde se ve |
|---|---|---|---|
| `PRIMARY` | `#FF5900` | `#E4510B` | tab activa, acentos |
| `SECONDARY` | `#4C9F38` | `#243B7A` | header, banner demo, burbujas de chat |
| `TERTIARY` | `#009E7C` | `#209B8A` | botón de acción, enviar, agregar |
| `CREDITS` | `#8436D1` | `#7D2048` | loopies |
| `ALERT` | `#FF3B30` | `#C52525` | errores |
| `MAIN_TEXT` | `#424242` | `#3D3D3D` | texto principal |

Las comunidades con tema propio **no se ven afectadas**: el fallback por clave sigue igual.

### Qué probar

- **Landing (sin login):** logo nuevo, "segunda vida" en azul, "útiles" en naranja, botón de iniciar
  sesión en teal, botón de registrarse con borde naranja.
- **Blobs decorativos de la landing:** ya no son pasteles hardcodeados, derivan de la paleta.
- **Prompt de instalar PWA** (en web, si aparece): tiene que usar los colores del tema, no una copia
  vieja. Antes tenía la paleta entera hardcodeada.
- **Chrome del navegador / splash:** color `#243B7A`.

### Detalles que importan

- El verde saliente `#4C9F38` **no pasaba WCAG AA** como texto sobre blanco (3,3:1). El azul nuevo
  da 10,6:1. `ALERT` también mejora: de ~3,8:1 a 5,7:1.
- Se subió `CACHE_NAME` del service worker a `v2`. Sin eso, quien ya había visitado la app se
  quedaba con el manifest y los iconos viejos.
- **Deuda conocida:** el degradé del logo sigue siendo arcoíris, no la paleta Itínere. Los assets se
  referencian solo por nombre de archivo, así que reemplazarlo por el definitivo es cambiar el PNG,
  sin tocar código.

---

## Rebanada 1 — Fundación

### Qué cambió

Deliberadamente **no cambia nada visualmente**. Agrega tokens que las rebanadas siguientes consumen
y arregla dos bugs.

- `BREAKPOINTS` (md 768, lg 1024, xl 1280), en paridad testeada con Tailwind.
- `ELEVATION` como tabla de runtime, más `GALLERY_HEIGHT` y `SKELETON_COUNT`.
- Hook `useBreakpoint` con una función pura `resolveBreakpoint(width)`.

### Bugs arreglados

- **`MainView`** tiraba abajo su tope de ancho dentro de la rama `refreshEnabled` pero lo mantenía
  fuera, así que el ancho máximo de la página dependía de si la pantalla tenía pull-to-refresh.
- **`ButtonText`** concatenaba `props.className` como string en vez de usar `twMerge`, así que
  cualquier override perdía silenciosamente contra las clases base.

### Dos guardianes de código fuente

Ambos verificados plantando archivos trampa y confirmando que fallan, antes de confiar en el verde.

- **Trampa de `display` en nativo.** `react-native-css-interop` solo acepta `display: none`;
  cualquier otro valor devuelve `undefined`. O sea que el idiomático de Tailwind web
  `hidden lg:flex` deja el elemento **oculto para siempre** en nativo, sin error visible en review.
  El idioma correcto es unidireccional: `lg:hidden` y `max-lg:hidden`.
- **Escala de sombras.** `parseBoxShadow` mapea solo `shadowColor` y `shadowRadius`, alimentado
  desde `spread`, que Tailwind siempre deja en `0`. Las clases `shadow-*` **no renderizan nada** en
  nativo. De ahí la tabla `ELEVATION`.

### Qué probar

Nada visual. Si algo se ve distinto, es un bug.

---

## Rebanada 2 — Card con imagen y grilla

### Qué cambió

La card de publicación pasa de fila horizontal con miniatura de 96×112 a **imagen protagonista**,
dentro de una grilla que adapta las columnas al ancho.

| Ancho | Columnas |
|---|---|
| < 768px | 1 |
| 768–1023px | 2 |
| 1024–1279px | 3 |
| ≥ 1280px | 4 |

Un solo componente para todos los anchos. Los cuatro badges (`CategoryBadge`, `ProductStatusBadge`,
`UserBadge`, `CreditsBadge`) se reutilizan sin tocar.

### Qué probar

- **`/search` y `/home`:** achicá y agrandá la ventana; las columnas tienen que reacomodarse sin
  saltos y sin perder la posición del scroll.
- **Alturas:** las cards de una misma fila tienen que terminar alineadas abajo, aunque los títulos
  ocupen distinta cantidad de líneas.
- **En celular:** una columna, imagen a ancho completo.
- **Fotos verticales:** el `resizeMode` pasó de `contain` a `cover`, así que **recorta**. Si te
  parece muy agresivo, el aspect ratio es una constante con nombre (`CARD_IMAGE_ASPECT_RATIO`) y se
  cambia en una línea.

### Tres bugs que ningún test podía encontrar

Se encontraron levantando la app en modo demo y renderizándola con Playwright a 390 / 800 / 1100 /
1440 / 1920 px. Los tres tenían las clases **correctamente escritas**.

1. **El wrapper del `FlatList` rompía la cadena de porcentajes.** react-native-web envuelve cada
   ítem en su propio `View`, así que la clase de celda quedaba adentro de un nodo que ya era una
   columna: `w-1/4` se aplicaba dos veces y la card terminaba con **83px** en vez de 345px, con los
   títulos cortados en "Botel la…". Se resolvió pasando la clase por `CellRendererComponent`.
2. **Las celdas se comprimían** por el `flex-shrink` por defecto de React Native.
3. **Las cards de una fila no se alineaban abajo**: la celda se estira, pero la card no la llenaba.

---

## Rebanada 3 — Sistema de anchos

### Qué cambió

Separa **quién scrollea** de **quién limita el ancho**.

Antes el `max-width` estaba en el mismo `View` que contenía al `FlatList` de cada pantalla, así que
el scroller heredaba la caja capeada y su barra quedaba en el borde de la columna interna. Ahora
`MainView` no capea: el cap lo aplica cada pantalla en el `contentContainer` de su propio scroller.

| variante | cap | pantallas |
|---|---|---|
| `wide` | 1152px / 1400px en `xl` | inicio, buscar, mis loops, deseados, publicar |
| `narrow` | 768px | perfil, mensajes, chat, notificaciones, detalle, oferta, login, registro, términos |
| `full` | sin cap | escape hatch |

También se centraron los botones: `CustomButton` traía `max-w-6xl` incrustado y ningún `mx-auto`, así
que en pantalla ancha quedaba pegado a la izquierda con 248px de aire a la derecha.

### Qué probar

- **Barra de scroll:** en cualquier página que scrollee, tiene que estar pegada al borde derecho de
  la ventana, no al borde de la columna de contenido.
- **`/messages`:** mucho más angosta, las tarjetas de chat ya no se estiran a lo ancho.
- **`/profile`:** más angosta.
- **`/search` e `/home`:** siguen aprovechando el ancho.
- **Botones de abajo** (cerrar sesión en `/profile`, agregar deseo en `/wishlist`): centrados.
- **Botón "Donar"** en `/profile`: dejó de ser un bloque enorme.

### Un bug de React que los tests no vieron

La primera versión usaba un `PageWidthContext`. **No funcionaba**: cada pantalla llamaba al hook en
el mismo componente que renderizaba el `Provider`, y el contexto solo llega a los descendientes, así
que leía siempre el default. La variante `narrow` no tenía efecto en **ninguna** pantalla, con los
tests igual en verde. Se detectó midiendo el DOM. Ahora es una función pura.

### Otro detalle que parece menor y no lo es

El centrado usa `self-center` y **no** `mx-auto`. `tailwind-merge` trata todas las clases `mx-*` como
un mismo grupo de conflicto, así que `mx-auto` pisaría silenciosamente el `-mx-1.5` de las gutters de
la grilla.

### Hallazgo

`refreshEnabled` **no lo pasaba ningún caller**: la rama del `ScrollView` de `MainView` era código
muerto y las 16 pantallas usaban la otra. Se eliminó.

---

## Rebanada 4 — Cuatro arreglos

### 1. Modales que se rompían con scroll

**Qué pasaba.** No había **ni un solo** `maxHeight`, `max-h-` ni `overflow` en ningún modal del
repo. Los tres que scrollean se apoyaban en `h-3/4`, que es un porcentaje de un padre con
`justify-center` — o sea, de una altura indefinida. Y en `CategorySelectorModal` el `FlatList` ni
siquiera tenía `flex-1`.

**Qué cambió.** El shell (`CustomModal`) pasa a ser dueño del límite de altura: calcula el 85% del
alto de la ventana y se lo ofrece a cada modal. Cada modal recorta su contenido con
`overflow-hidden`, así que solo scrollea la lista.

**Qué probar.**
- Abrí el selector de categorías o el de escuelas con **muchos ítems**: la caja deja de crecer, el
  título y el buscador quedan fijos y solo scrollea la lista.
- Abrilo con **pocos ítems**: la caja se achica al contenido, sin la franja en blanco que dejaba el
  75% forzado.
- **Achicá la ventana** con un modal abierto: tiene que seguir entrando entero en pantalla.
- Alcanza con `/publish` → "Seleccionar categoría".

Modales arreglados: categorías, escuelas, usuarios, filtros de búsqueda, modificar deseo y eliminar
cuenta.

### 2. Outline feo en los inputs

**Qué pasaba.** De los 16 `TextInput` de la app, **solo `ChatInput`** manejaba el foco. Los otros 15
mostraban el anillo azul crudo del navegador.

**Qué cambió.** Una sola regla en `global.css` reemplaza ese anillo por uno de 2px en el naranja de
marca. **No se saca el anillo**: es la señal de accesibilidad para quien navega con teclado.

**Qué probar.** Hacé clic en cualquier input en web (login, registro, publicar, donar, buscar): el
borde tiene que ser naranja, no azul.

### 3. Debounce de Ordenar

Sacado. Ordenar en `/search` responde al instante. La demora de 500ms era solo en avisarle al padre;
el estado local ya se actualizaba enseguida, y por eso se sentía trabado.

De paso el prop se llamaba `onDebounce`, que ya sería mentira: ahora es `onSortChange`.

El debounce del **texto** de búsqueda no se toca.

**Qué probar.** `/search` → "Ordenar" → cambiá campo y sentido. Tiene que refrescar sin lag.

### 4. `UserBadge`: el tamaño no se podía cambiar

El componente fijaba el avatar en 24×24 con un `style` inline, así que el `imageClassName="size-12"`
que le pasaba el detalle de publicación **no hacía nada**. Ahora sí, y el nombre trunca con puntos
suspensivos en vez de desbordar.

**Qué probar.** En `/listing/[id]`, el avatar del vendedor tiene que verse a 48px. En las cards de la
grilla sigue en 24px.

### Dos cosas que solo aparecieron renderizando

- **El mismo bug de contexto de React de la rebanada 3**, otra vez: el primer intento de pasar la
  altura del modal usaba un contexto, y el componente que lo consumía era ancestro del Provider. Se
  reemplazó por un render prop.
- **Faltaba el recorte.** Con el cap de altura y el scroll interno ya funcionando, los ítems se
  seguían dibujando *por fuera* del borde inferior del modal. Las mediciones daban todas bien; solo
  se vio en la captura. Faltaba `overflow-hidden` en las cajas.

---

## Rebanada 5 — Card compacta

### Qué cambió

La card de publicación gana una **variante**, no un componente paralelo:

| variante | forma | dónde |
|---|---|---|
| `grid` (default) | imagen arriba, protagonista | buscar, inicio, mis publicaciones |
| `compact` | imagen 96×112 a la izquierda, info a la derecha, una fila | notificaciones, pendientes, chat |

El criterio: **la imagen manda donde estás eligiendo qué te gusta; no manda donde la publicación
solo está referenciada.**

Dónde se usa compacta:
- `/notifications` — cuando aparece una publicación.
- El desplegable "Loops pendientes" del chat, que además vive en una caja de 240px de alto.
- Las secciones de pendientes del perfil y del inicio.

`/myListings` se queda en grilla: ahí sí estás navegando tus propias publicaciones.

También va la guarda de `listing.media[0].url`, que hoy **revienta** con una publicación sin
imágenes. Ahora cae en un recuadro neutro.

### Qué probar

- **`/notifications`:** la publicación aparece como fila compacta, no como imagen gigante.
- **`/messages/[id]`** → desplegable "Loops pendientes": las publicaciones entran en el espacio.
- **`/myListings`:** conviven las dos variantes en la misma pantalla — pendientes en filas
  compactas arriba, "Mis publicaciones" en grilla abajo.
- **Publicación sin imágenes:** no rompe.

### Un bug que solo apareció renderizando

Las cards compactas estaban entrando por `ListingGrid`, así que quedaban encajadas en una celda de
`w-1/4`: apretadas y con los títulos cortados en "Cartuchera …". Una fila compacta es full width por
definición y no puede pasar por un contenedor de columnas. Ahora se apila en un `View` plano.

### Pendiente de decisión tuya

`/listing/[id]/offer` también apila cards completas a lo ancho. Podría querer compacta, pero ahí
**sí** estás eligiendo qué entregar, así que la imagen importa. Sin tocar hasta que lo decidas.

---

## Rebanada 6 — Densidad en pantalla ancha

### 1. `/offer`: tocar una publicación te sacaba del flujo

**El bug.** La card tenía el `onPress` hardcodeado a "ir al detalle". En `/offer`, tocar el cuerpo
de una publicación disponible te llevaba al detalle de **esa** publicación, que es del comprador y
está `published` — así que ahí aparecía el botón **"Loopear"**. Podías arrancar una oferta
completamente distinta en el medio de estar eligiendo qué recibir. Solo el "+" agregaba de verdad.

**El arreglo.** La card acepta un `onPress` opcional. En `/offer`, tocar la card agrega o quita de
la selección, igual que el botón. `/offer` **se queda ancho y con la card grande**, como pediste:
el problema nunca fue el ancho.

De paso, `ListingButtons` tenía un `switch` sin `break`: `case "offered"`, si no coincidías ni con
el vendedor ni con el comprador, **caía dentro de `case "accepted"`**. Ahora cada caso termina y
hay un `default`.

### 2 a 4. Densidad

- **Misiones en `/home`:** dos por fila desde `md`. Si son impares, la última ocupa la fila entera
  en vez de dejar un hueco.
- **Formulario de `/publish`:** columna más angosta, Categoría + Título de a pares, Descripción a lo
  largo, Estado + Precio de a pares. **En celular queda idéntico a antes.**
- **`/wishlist`:** dos por fila en ancho.

### 5. Alineación en `/profile`

Los títulos de sección quedaron consistentes con su contenido.

### Qué probar

- **`/offer`:** tocá el cuerpo de una publicación disponible. Tiene que agregarla a "Recibirás", no
  navegar a ningún lado. Tocá una ya seleccionada: la saca.
- **`/publish` a 390px:** idéntico a antes. A 1440px: campos de a pares en columna angosta.
- **`/home`, `/wishlist`:** dos por fila en ancho.
- **Botones sueltos** (agregar deseo, cerrar sesión, publicar): ~450px centrados, no bandas.
- **Botones en fila** (`/offer` Confirmar + Cancelar, detalle de publicación): llenan su fila.

### Tres bugs que introduje y arreglé

Vale documentarlos porque muestran cómo un arreglo destapa otro:

1. **Botones de 1400px.** En la rebanada 3 le saqué el `max-w-6xl` a `CustomButton` para
   centrarlos. Quedaron centrados y ocupando la columna entera: "Agregar deseo" era una banda de
   punta a punta. Ahora los sueltos van a 448px.
2. **El botón "Cancelar" aplastado a un sliver.** Al poner `w-full` en los defaults del botón, en
   una **fila** los dos hermanos pedían el 100% del ancho y el segundo colapsaba. Las filas ahora
   optan por salirse con `w-auto max-w-none`.
3. **Texto rojo sobre fondo rojo.** `<ButtonText className="text-alert">` sobre `bg-alert`. El call
   site siempre estuvo mal, pero no se veía porque `ButtonText` concatenaba las clases como string
   y ganaba el `text-white` base. En la rebanada 1 lo pasé a `twMerge`, que es lo correcto — y el
   override empezó a funcionar de verdad, dejando el texto invisible.

Los tres pasaban los 649 tests.

---

## Rebanada 7 — `/notifications`

### El botón de "marcar todo como leído" ya no existe

**Qué pasaba.** El botón estaba montado condicionalmente sobre `notifications.length > 0`, así que
cuando la lista estaba vacía o la primera página todavía cargaba, se desmontaba y **todo el
contenido saltaba hacia arriba**. Esa era la línea blanca.

**Qué cambió.** Las notificaciones se marcan solas **al salir de la pantalla**, no al entrar.

Marcarlas al entrar hubiera sido más simple, pero borraba el estado de no leída antes del primer
pintado: el resaltado existiría en el código y nunca en la pantalla. Marcándolas al salir las ves
resaltadas toda la visita, y la próxima vez ya están leídas. Es lo que hacen GitHub, Slack y Gmail.

Con eso el botón sobra, así que se fue. En su lugar quedó un título "Notificaciones".

### Las no leídas ahora se ven no leídas

Antes la única diferencia era un borde de 1px que cambiaba de color. Ahora llevan barra de acento a
la izquierda, fondo con tinte suave y título en negrita. Las leídas quedan planas y se corren para
atrás. Todo con los tokens que ya existían, sin colores nuevos.

### El usuario en las notificaciones

`cards/User.tsx` no tenía ninguna restricción de ancho, así que en "Nueva donación recibida" la foto
quedaba pegada a la izquierda, el nombre centrado en el medio y el resto en blanco. Ahora tiene un
ancho máximo y la foto y el nombre van juntos.

### Qué probar

- **Entrá a `/notifications`:** las no leídas se ven claramente distintas.
- **Salí y volvé a entrar:** ahora están todas planas y el contador del header en cero. Sin tocar
  ningún botón.
- **"Nueva donación recibida":** el usuario es una tarjeta compacta, no una banda.
- **Entrá con la lista vacía:** el contenido no salta.

### Un límite del backend, no un descuido

**No existe endpoint para marcar una notificación individual.** Se verificaron `client/hooks/`,
`client/api/loop.ts`, el mock de demo y las rutas del server: solo hay
`GET /me/notifications`, `GET /me/notifications/unread` y `POST /me/notifications/read-all`.

Por eso se marcan todas juntas al salir, y no una por una al tocarlas. Marcar individualmente
requiere backend nuevo.

---

## Rebanada 8 — `/messages/[id]`

### El header ocupaba 130px antes del primer mensaje

Eran dos filas apiladas: el botón de volver solo en una, y abajo un avatar de 80×80 al lado de un
nombre en `text-2xl`. Ahora es **una sola fila** de la mitad de alto: volver, avatar de 40×40,
nombre proporcionado con truncado, y los colegios en una línea secundaria.

**El header ahora es tocable** y te lleva al perfil de la otra persona. Antes, desde una
conversación, no había forma de llegar ahí.

### El fondo blanco: el problema no era el blanco

Tus burbujas enviadas son **transparentes con borde**. Sobre un fondo blanco se leían como
contornos fantasma, no como burbujas.

La superficie de la conversación pasa a gris (`bg-background`), y con eso la burbuja enviada puede
tomar blanco y por fin verse como burbuja. Las recibidas quedan igual — es la parte que te gustaba.
La barra de escribir se queda blanca, así que ahora se distingue de la conversación en vez de
fundirse con ella.

### Ancho de lectura

La columna de mensajes se capea a 576px. A lo ancho de una pantalla de 1440 las burbujas se
estiraban demasiado para leerse cómodas.

### Qué probar

- **Entrá a una conversación:** el header ocupa la mitad, y tocarlo te lleva al perfil.
- **Las burbujas:** las tuyas blancas, las de la otra persona en color, todo sobre gris.
- **El desplegable "Loops pendientes":** las publicaciones ahora entran en su caja (viene de la
  rebanada 5).
- **En celular:** misma estructura, header más compacto.

---

## Cómo se verifica esto

Los tests unitarios no alcanzan para un cambio visual. Cada rebanada se verifica además
**renderizando la app de verdad**: se levanta el cliente en modo demo (sin backend), se navega con
Playwright y se miden los nodos del DOM a 390 / 768 / 1024 / 1440 / 1920 px.

Los cuatro bugs de layout encontrados hasta ahora (tres en la grilla, uno en el sistema de anchos)
**pasaban todos los tests**. Ninguno se habría detectado en code review.

## Limitaciones conocidas del entorno

- `npm run lint` está roto de antes: `expo lint` revienta con `ERR_UNSUPPORTED_DIR_IMPORT`
  resolviendo `eslint-config-expo/flat` bajo Node v24.
- `npx tsc --noEmit` también, por `@types/jest` faltante más errores preexistentes ajenos a este
  trabajo.
- `npm run test` es `jest --watchAll` y nunca termina. Usar siempre
  `npx jest --ci --watchAll=false`.

Ninguna de las tres se arregla acá: son preexistentes y quedan fuera de un pase de UI.
