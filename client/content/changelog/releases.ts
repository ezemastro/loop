/**
 * Public changelog data (route `/changelog`, see `components/screens/Changelog.tsx`).
 *
 * The recording process is in `docs/CHANGELOG.md`; `__tests__/changelog.test.ts` enforces the
 * rules that can be checked mechanically (unique IDs, images on disk, alt text, size, banned words).
 * Visitor-facing strings are Spanish; keep this file's code and comments in English.
 */

export type ChangeKind = "novedad" | "mejora" | "arreglo";
export type ChangeViewport = "escritorio" | "celular";

/** One screenshot. `width`/`height` are the CSS-pixel size it was captured at (the capture script prints them). */
export interface ChangelogImage {
  /** Site-absolute path, e.g. `/changelog/1.5.0/chat-celular-antes.webp`; file lives in `client/public/changelog/`. */
  path: string;
  alt: string;
  width: number;
  height: number;
}

export interface Comparison {
  caption?: string;
  viewport: ChangeViewport;
  before?: ChangelogImage;
  after: ChangelogImage;
}

export interface Change {
  /** `C-0001`. Unique forever, never reused, even if the change is later undone. */
  id: string;
  kind: ChangeKind;
  /** Part of the app, e.g. "Chat", "Inicio". */
  area: string;
  title: string;
  /** 1-3 plain sentences: what changed for the person using the app and why it is better. */
  why: string;
  comparisons: Comparison[];
  /** Short git SHAs that implement the change (used to undo it). May be empty until known. */
  commits: string[];
  /** Set only when there is nothing to show on screen (mejora/arreglo otherwise need before and after). */
  noVisual?: boolean;
}

export interface Release {
  /** Equals `client/package.json` version once published. */
  version: string;
  /** YYYY-MM-DD. */
  date: string;
  title: string;
  /** 1-2 plain sentences. */
  summary: string;
  changes: Change[];
}

const SIZES: Record<ChangeViewport, { width: number; height: number }> = {
  escritorio: { width: 1280, height: 800 },
  celular: { width: 390, height: 844 },
};

/** Before/after pair of one capture scene, following the file naming in `docs/CHANGELOG.md`. */
const compare = (
  version: string,
  scene: string,
  viewport: ChangeViewport,
  screen: string,
  options: { height?: number; caption?: string } = {},
): Comparison => {
  const size = { ...SIZES[viewport], ...(options.height ? { height: options.height } : {}) };
  const where = viewport === "celular" ? "en el celular" : "en la computadora";
  const image = (label: string, moment: string): ChangelogImage => ({
    path: `/changelog/${version}/${scene}-${viewport}-${label}.webp`,
    alt: `${screen} ${where}, ${moment}.`,
    ...size,
  });
  return {
    ...(options.caption ? { caption: options.caption } : {}),
    viewport,
    before: image("antes", "antes de este cambio"),
    after: image("despues", "después de este cambio"),
  };
};

const v150 = "1.5.0";

/** Newest first. */
export const RELEASES: Release[] = [
  {
    version: v150,
    date: "2026-11-07",
    title: "Una app más ordenada y más clara",
    summary:
      "Esta versión renueva el aspecto de Loop para que sea más consistente y más fácil de usar, y suma esta página para seguir los cambios de cada versión.",
    changes: [
      {
        id: "C-0001",
        kind: "novedad",
        area: "General",
        title: "Página de novedades",
        why: "Ahora hay una página donde se ve qué cambió en cada versión de Loop, con imágenes de cómo era antes y cómo es ahora.",
        comparisons: [],
        commits: ["13b935e", "7feaa72", "8ae9f4d", "4670b73"],
      },
      {
        id: "C-0002",
        kind: "mejora",
        area: "General",
        title: "Una barra superior más liviana",
        why: "La barra ocupaba dos filas y un bloque grande de color. Ahora es una sola fila blanca en la computadora y más baja en el celular, así queda más lugar para el contenido.",
        comparisons: [compare(v150, "home", "escritorio", "Pantalla de inicio")],
        commits: ["ffe217b"],
      },
      {
        id: "C-0003",
        kind: "mejora",
        area: "General",
        title: "Cada comunidad conserva su color, y siempre se lee bien",
        why: "Antes compartían pantalla muchos colores sin un significado claro. Ahora el color de la comunidad marca la franja superior, la sección activa y las acciones principales. Si un color no se lee bien con texto blanco, la app lo oscurece sola, y los textos grises son más legibles.",
        comparisons: [
          compare(v150, "search", "escritorio", "Pantalla de búsqueda"),
          {
            caption: "La misma pantalla con el color azul de una comunidad de ejemplo.",
            viewport: "escritorio",
            after: {
              path: `/changelog/${v150}/search-escritorio-despues-comunidad.webp`,
              alt: "Pantalla de búsqueda en la computadora con el color azul de una comunidad de ejemplo.",
              ...SIZES.escritorio,
            },
          },
        ],
        commits: ["445c0dd", "de2c098", "f99a4e8"],
      },
      {
        id: "C-0004",
        kind: "mejora",
        area: "General",
        title: "Botones con jerarquía",
        why: "Todos los botones se veían igual, y acciones como Cancelar o Denunciar llamaban tanto la atención como la principal. Ahora la acción principal se distingue de las secundarias, y los botones reaccionan al pasar el mouse o tocarlos.",
        comparisons: [compare(v150, "offer", "celular", "Pantalla de oferta")],
        commits: ["81cfd17"],
      },
      {
        id: "C-0005",
        kind: "mejora",
        area: "Formularios",
        title: "Todos los campos se ven y funcionan igual",
        why: "Cada formulario tenía su propio estilo de campos, con alturas y etiquetas distintas. Ahora comparten uno solo. Los textos de ayuda ya no parecen datos escritos, y queda claro en qué campo se está escribiendo.",
        comparisons: [
          compare(v150, "publish", "celular", "Formulario de publicación", { height: 1100 }),
        ],
        commits: ["ff97006", "702b6b6", "9a5ceee"],
      },
      {
        id: "C-0006",
        kind: "arreglo",
        area: "General",
        title: "Las ventanas ya no tapan toda la pantalla",
        why: "Al abrir una ventana, como los filtros, la pantalla de atrás desaparecía detrás de un fondo gris. Ahora se sigue viendo atenuada, y todas las ventanas tienen el título y el botón de cerrar en el mismo lugar.",
        comparisons: [compare(v150, "filters-modal", "escritorio", "Ventana de filtros")],
        commits: ["66534e8", "22aae64"],
      },
      {
        id: "C-0007",
        kind: "arreglo",
        area: "General",
        title: "Una página propia para los enlaces que no existen",
        why: "Un enlace equivocado llevaba a una pantalla negra en inglés con términos técnicos. Ahora se explica en castellano qué pasó y se ofrece un botón para volver al inicio.",
        comparisons: [compare(v150, "not-found", "escritorio", "Página no encontrada")],
        commits: ["204bb03"],
      },
      {
        id: "C-0008",
        kind: "mejora",
        area: "General",
        title: "Una sola tipografía y títulos claros",
        why: "La versión web usa ahora la misma tipografía que la página de presentación, y todos los títulos siguen una misma escala, alineados a la izquierda.",
        comparisons: [compare(v150, "settings", "escritorio", "Pantalla de ajustes")],
        commits: ["e74c6b6", "22aae64"],
      },
      {
        id: "C-0009",
        kind: "mejora",
        area: "General",
        title: "Los textos hablan de una sola manera",
        why: "Una misma pantalla mezclaba formas como Introduce, Usá e Ingrese. Ahora toda la app usa el mismo tono, las fechas se leen más fácil y cada cosa se llama igual en todos lados.",
        comparisons: [compare(v150, "register", "celular", "Pantalla de registro")],
        commits: ["b6f993f"],
      },
      {
        id: "C-0010",
        kind: "mejora",
        area: "Chat",
        title: "Un chat como los que ya conocés",
        why: "Los mensajes propios estaban en blanco y los ajenos en color, al revés de lo habitual. Ahora los propios llevan el color de la comunidad. En el celular la conversación ocupa más pantalla, y en la computadora todo queda alineado en una misma columna.",
        comparisons: [
          compare(v150, "chat", "celular", "Conversación"),
          compare(v150, "chat", "escritorio", "Conversación"),
        ],
        commits: ["b445681", "780a143"],
      },
      {
        id: "C-0011",
        kind: "mejora",
        area: "Inicio",
        title: "Inicio muestra primero lo importante",
        why: "Los artículos aparecían muy abajo, después de las estadísticas y las misiones. Ahora el impacto ambiental ocupa una franja compacta, luego vienen los intercambios pendientes y los artículos, y las misiones van al final.",
        comparisons: [compare(v150, "home", "celular", "Pantalla de inicio")],
        commits: ["7a9d37a", "780a143"],
      },
      {
        id: "C-0012",
        kind: "mejora",
        area: "Búsqueda",
        title: "Tarjetas de artículos más fáciles de leer",
        why: "Cada tarjeta presenta ahora la información en el mismo orden, con los títulos completos y el estado del artículo en un tono neutro. Filtros y Ordenar pasaron a ser dos botones chicos, del mismo tamaño.",
        comparisons: [compare(v150, "search", "celular", "Pantalla de búsqueda")],
        commits: ["58fdc05", "81cfd17"],
      },
      {
        id: "C-0013",
        kind: "mejora",
        area: "Publicaciones",
        title: "La acción principal, al lado del artículo",
        why: "En la computadora, el botón para hacer el intercambio quedaba lejos de la información del artículo. Ahora título, loopies, acciones y datos de quien publica están juntos, y Denunciar sigue disponible sin ser lo primero que se ve.",
        comparisons: [
          compare(v150, "listing", "escritorio", "Detalle de una publicación", { height: 1100 }),
          compare(v150, "listing", "celular", "Detalle de una publicación", { height: 1100 }),
        ],
        commits: ["f8dc84d"],
      },
      {
        id: "C-0014",
        kind: "arreglo",
        area: "Publicaciones",
        title: "Hacer una oferta sin que nada quede tapado",
        why: "La foto ocupaba casi toda la pantalla y los botones tapaban parte del contenido. Ahora el artículo se muestra resumido, se ve todo lo que se recibe, y Confirmar y Cancelar tienen el mismo tamaño.",
        comparisons: [compare(v150, "offer", "escritorio", "Pantalla de oferta")],
        commits: ["cdc09c4"],
      },
      {
        id: "C-0015",
        kind: "mejora",
        area: "Notificaciones",
        title: "Notificaciones que se entienden de un vistazo",
        why: "Cada aviso era una caja con otra caja adentro, y en el celular los nombres quedaban cortados. Ahora cada uno es una línea con una frase completa, y un punto marca los que faltan leer.",
        comparisons: [compare(v150, "notifications", "celular", "Notificaciones")],
        commits: ["f03c109"],
      },
      {
        id: "C-0016",
        kind: "mejora",
        area: "Chat",
        title: "Lista de conversaciones más prolija",
        why: "Las conversaciones ahora forman una sola lista, con el mismo estilo que el resto de la app, y las que tienen mensajes sin leer se distinguen mejor.",
        comparisons: [compare(v150, "messages", "escritorio", "Lista de mensajes")],
        commits: ["9cb6ab3"],
      },
      {
        id: "C-0017",
        kind: "mejora",
        area: "Perfil",
        title: "Un perfil ordenado",
        why: "El perfil mezclaba bloques centrados con otros alineados a la izquierda. Ahora los datos, los loopies y el impacto están agrupados, y se lee de arriba hacia abajo.",
        comparisons: [compare(v150, "profile", "escritorio", "Perfil")],
        commits: ["c82c62b"],
      },
      {
        id: "C-0018",
        kind: "mejora",
        area: "Deseados",
        title: "Agregar un deseo está a mano",
        why: "El botón quedaba abajo de todo, lejos de la lista. Ahora en la computadora está junto al título, y los deseos forman una sola lista con acciones discretas.",
        comparisons: [compare(v150, "wishlist", "escritorio", "Lista de deseados")],
        commits: ["e23e74c"],
      },
      {
        id: "C-0019",
        kind: "mejora",
        area: "Acceso",
        title: "Iniciar sesión, más simple",
        why: "En la computadora, el formulario queda ahora en una tarjeta, sin barra inferior ni elementos sueltos. Iniciar sesión y Registrarse se enlazan entre sí con una frase clara.",
        comparisons: [compare(v150, "login", "escritorio", "Inicio de sesión")],
        commits: ["2908f14", "780a143", "4670b73"],
      },
      {
        id: "C-0020",
        kind: "mejora",
        area: "General",
        title: "Pantallas vacías y de carga cuidadas",
        why: "Cuando no había resultados solo se veía una frase suelta. Ahora se explica qué pasó y qué se puede hacer, y mientras cargan los artículos aparece un adelanto con su forma.",
        comparisons: [compare(v150, "search-empty", "celular", "Búsqueda sin resultados")],
        commits: ["c99e39b"],
      },
    ],
  },
];
