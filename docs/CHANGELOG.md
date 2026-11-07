# Cómo registrar cambios en la página de novedades

La página `/changelog` muestra a personas no técnicas cómo avanza Loop, versión por versión, con
imágenes de antes y después. También sirve para revisar lotes grandes de cambios y para pedir
"deshacé C-0007". **Todo cambio que alguien note al usar la app se registra acá.** Si sos una IA,
esta guía es obligatoria.

## 1. Pasos, en este orden

| #   | Paso                           | Cuándo                    | Comando o archivo                      |
| --- | ------------------------------ | ------------------------- | -------------------------------------- |
| 1   | Tomar las capturas **antes**   | Antes de tocar el código  | Sección 2                              |
| 2   | Hacer el cambio                | Después del paso 1        | Código normal                          |
| 3   | Tomar las capturas **después** | Con el cambio terminado   | Sección 2                              |
| 4   | Escribir la entrada            | Con ambas capturas listas | `client/content/changelog/releases.ts` |
| 5   | Subir la versión si hace falta | Una vez por versión nueva | `client/package.json`                  |
| 6   | Correr la lista de control     | Antes de entregar         | Sección 7                              |
| 7   | Anotar los commits             | Cuando existan            | Campo `commits` de la entrada          |

**Regla de orden: las capturas "antes" se toman de una compilación del commit base, antes de
cambiar el código.** Después ya no hay forma honesta de conseguirlas. Si te las salteaste, no las
reconstruyas: registrá el cambio como `novedad` sin imágenes o con `noVisual: true`, y decilo en
tu reporte.

## 2. Capturas

Necesitás Chromium y Playwright. Las variables `PLAYWRIGHT_FROM` (carpeta cuyo `node_modules` tiene
Playwright, por defecto `e2e/`) y `CHROMIUM_PATH` (por defecto `/usr/bin/chromium`) las ajustan.
Todos los comandos salen de la raíz del repositorio.

**Antes** (con el código todavía sin tocar, o desde un worktree del commit base):

```bash
cd client
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo export --platform web --output-dir /tmp/dist-antes
cd ..
node scripts/changelog/serve.mjs /tmp/dist-antes 8801 &      # anotá el PID para detenerlo
node scripts/changelog/capture.mjs --base http://localhost:8801 --version 1.5.0 \
  --label antes --scenes chat,home --viewports escritorio,celular
kill <PID>
```

**Después** (con el cambio hecho): el mismo bloque, con otra carpeta (`/tmp/dist-despues`), otro
puerto (`8802`) y `--label despues`.

- `--version` es la versión de la entrada. Los archivos quedan en
  `client/public/changelog/<version>/<escena>-<vista>-<antes|despues>.webp`.
- Escenas disponibles: `home`, `search`, `search-empty`, `filters-modal`, `listing`, `offer`,
  `publish`, `wishlist`, `profile`, `notifications`, `messages`, `chat`, `settings`, `login`,
  `register`, `not-found`. Para una pantalla nueva, agregá una escena en
  `scripts/changelog/scenes.mjs`.
- El comando imprime el tamaño de cada archivo y el tamaño de captura (por ejemplo `390x844`).
  Copiá ese tamaño a `width` y `height` de la imagen en `releases.ts`.
- Si una captura supera 300 KB, el comando avisa: recortá la escena o bajá el contenido, no la
  calidad a ciegas.

## 3. Versiones e IDs

| Tema                            | Regla                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Versión de la entrada           | Igual a `client/package.json`. La versión más nueva de la página puede ir una por delante mientras se prepara.                                |
| Subir minor (`1.5.0` a `1.6.0`) | Hay una `novedad` o un grupo de mejoras visibles.                                                                                             |
| Subir patch (`1.5.0` a `1.5.1`) | Solo `arreglo`s o ajustes chicos.                                                                                                             |
| Misma versión                   | Si la versión todavía no se publicó, sumá la entrada a esa versión.                                                                           |
| ID                              | `C-` y cuatro dígitos. Usá el siguiente número libre mirando **todos** los releases. Nunca se reutiliza, ni siquiera si el cambio se deshace. |
| `commits`                       | SHAs cortos de los commits que implementan el cambio (para poder deshacerlo). Puede estar vacío hasta que existan.                            |
| Orden                           | `RELEASES` va de más nuevo a más viejo. Dentro de un release, el orden de los cambios es libre.                                               |

## 4. Cuándo registrar

| Registrar (obligatorio)                                                                                                 | No registrar                                |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Cualquier cambio que se vea o se note al usar la app: pantallas, textos, colores, botones, flujos, velocidad apreciable | Refactors sin efecto visible                |
| Un arreglo de algo que fallaba a la vista de la persona                                                                 | Tests, herramientas, scripts, documentación |
| Una función nueva                                                                                                       | Dependencias o configuración que nadie nota |

**Cómo agrupar:** un cambio que la persona percibe como una sola cosa es una sola entrada, aunque
toque diez archivos ("Chat más claro"). Dos cosas que se pueden deshacer por separado son dos
entradas. Si un mismo ajuste recorre muchas pantallas (por ejemplo, el nuevo tamaño de los
botones), una entrada con una comparación por pantalla representativa alcanza.

## 5. Qué incluir y qué no

**Tipos:** `novedad` (algo que antes no existía), `mejora` (algo existente que ahora es mejor),
`arreglo` (algo que fallaba y ahora anda).

| Campo         | Qué poner                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `title`       | Qué cambió, en pocas palabras.                                                                                                 |
| `why`         | De 1 a 3 oraciones: qué cambia para quien usa la app y por qué mejora. Resultado real, sin exagerar.                           |
| `area`        | La parte de la app: "Chat", "Inicio", "Publicar".                                                                              |
| `comparisons` | Una por pantalla y vista mostrada. `mejora` y `arreglo` necesitan al menos una con `before` y `after`, salvo `noVisual: true`. |

**Incluir:** lenguaje simple, lo que cambia para la persona, el resultado verificado.

**Excluir (la prueba automática ya rechaza algunas):**

- Jerga técnica y nombres de archivos, componentes o librerías.
- Datos personales: las imágenes usan solo datos de demostración. Nunca una cuenta real.
- Claves, secretos y direcciones internas.
- Ventas, precios, planes o números de uso. Las palabras `venta`, `precio`, `plan`, `vender` y
  `comprar` están prohibidas en el texto.
- Afirmaciones sin verificar o promesas ("más rápido" sin haberlo medido, "sin errores").
- Rayas largas (—) en el texto visible.

**Imágenes:**

- Antes y después muestran **la misma pantalla, los mismos datos, la misma vista y el mismo
  estado.** Si no coinciden, la comparación engaña.
- No se retocan. Nada de recortes, flechas ni filtros.
- Cada una pesa menos de 300 KB, tiene `alt` descriptivo y `width`/`height` reales.
- Una escena que necesita más alto declara `height` en `scenes.mjs`; no recortes a mano.

## 6. Deshacer un cambio

El dueño dice "deshacé C-0007".

1. Buscá C-0007 en `releases.ts` y tomá sus `commits`.
2. Revertilos (`git revert <sha>` por cada uno, del más nuevo al más viejo).
3. Registrá el deshacer como una **entrada nueva** de tipo `arreglo`, con su propio ID, que explique
   en lenguaje simple qué volvió a como estaba.
4. **No borres entradas viejas.** La única excepción: un cambio que nunca se publicó puede
   eliminarse de la página (y sus imágenes) junto con su código.

## 7. Lista de control antes de entregar

- [ ] Las capturas "antes" salieron de un build del commit base, antes del cambio.
- [ ] Antes y después comparan la misma pantalla, datos, vista y estado.
- [ ] El ID es el siguiente libre y no repite uno anterior.
- [ ] La versión coincide con `client/package.json` (o va una por delante, a propósito).
- [ ] El texto está en español neutro y simple, sin jerga, sin ventas, precios, planes ni números de uso.
- [ ] Cada imagen tiene `alt`, `width`, `height` y pesa menos de 300 KB.
- [ ] No hay datos personales, claves ni direcciones internas en las imágenes.
- [ ] `commits` tiene los SHAs, o queda vacío a propósito.
- [ ] `/changelog` sigue sin enlaces desde la app, sin entrada en `sitemap.xml` y con `noindex`.
- [ ] `npx jest --ci --watchAll=false` y `npx tsc --noEmit` pasan en `client/`.

## 8. La página es oculta a propósito

`/changelog` no está enlazada desde la app, lleva `<meta name="robots" content="noindex">` y no
figura en `client/public/sitemap.xml`. Tampoco se agrega a `robots.txt`: un buscador tiene que poder
leer el `noindex`. Tiene que seguir así. `client/__tests__/changelog.test.ts` lo vigila.

## 9. Ejemplos

**Bien**

```ts
{
  id: "C-0007",
  kind: "mejora",
  area: "Chat",
  title: "Conversaciones más fáciles de leer",
  why: "Los mensajes ahora tienen más espacio entre sí y el texto es más grande. Se lee mejor en el celular.",
  comparisons: [
    {
      viewport: "celular",
      before: { path: "/changelog/1.5.0/chat-celular-antes.webp", alt: "Chat con mensajes muy juntos", width: 390, height: 844 },
      after: { path: "/changelog/1.5.0/chat-celular-despues.webp", alt: "Chat con mensajes más separados", width: 390, height: 844 },
    },
  ],
  commits: ["a1b2c3d"],
}
```

**Mal**

```ts
{
  id: "C-0007",                       // repetido: ya existe
  kind: "mejora",
  area: "chat",
  title: "Refactor de Chat.tsx",      // jerga y nombre de archivo
  why: "Ahora es 3 veces más rápido y no tiene errores. Sube las ventas del plan premium.", // sin medir, promete, habla de ventas
  comparisons: [],                    // una mejora sin antes y después
  commits: [],
}
```
