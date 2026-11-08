/**
 * Copy and static data for the public marketing landing (`MarketingLanding.tsx`). Kept separate
 * from the section components so the sections stay focused on layout. Content is derived from
 * sostenibilidadenred.com/loop, rewritten in Loop's own voice: no invented numbers, no filler
 * verbs, zero em/en dashes.
 */

/** Canonical origin of the public landing. Sharing metadata needs absolute URLs. */
export const SITE_URL = "https://loop.reditinere.com/";
export const PAGE_TITLE = "Loop · Intercambio circular de útiles escolares | Red Itínere";
export const PAGE_DESCRIPTION =
  "Loop es la plataforma de intercambio circular de útiles escolares de la comunidad de Red Itínere. Publicá lo que ya no usás, ganá loopies y conseguí lo que tu familia necesita.";
/** Self-hosted Figtree (latin subset covers Spanish). Preloaded by the landing only. */
export const FONT_URL = "/fonts/figtree-latin-wght-normal.woff2";
export const SHARE_IMAGE_URL = `${SITE_URL}share-image.png`;
export const SHARE_IMAGE_ALT =
  "Loop, intercambio de útiles escolares entre las familias de tu colegio";

/** "Buzón de consultas" in the footer. Confirmed by fetching the source page's raw HTML. */
export const CONSULTAS_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfLxG-rNPnUqMtzzgqGjFbS27Ea2T9d10qlE6ADVcbTd-Yezw/viewform?usp=dialog";

export const NAV_LINKS = [
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "loopies", label: "Loopies" },
  { id: "comunidad", label: "Comunidad" },
  { id: "preguntas", label: "Preguntas" },
] as const;

export type HowItWorksStep = {
  id: string;
  title: string;
  description: string;
};

/**
 * The real order of an exchange, checked against the code: the seller is credited when the buyer
 * confirms receipt (`receiveListing`), not when the listing is published.
 */
export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: "publicar",
    title: "Publicá",
    description:
      "Subí una foto, elegí la categoría, escribí el título y la descripción, marcá el estado y ponele su valor en loopies.",
  },
  {
    id: "buscar",
    title: "Buscá y loopeá",
    description:
      'Buscá por nombre y filtrá por categoría, colegio o estado. Tocá "Loopear" para proponer el intercambio: la otra familia elige qué quiere recibir a cambio.',
  },
  {
    id: "coordinar",
    title: "Coordiná la entrega",
    description:
      "Cuando la otra familia acepta, coordinan la entrega entre ustedes con mensajes dentro de la app.",
  },
  {
    id: "recibir",
    title: "Recibí tus loopies",
    description:
      "Cuando la otra familia confirma que recibió el artículo, los loopies del intercambio llegan a tu cuenta.",
  },
];

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "quien-puede-sumarse",
    question: "¿Quién puede sumarse a Loop?",
    answer:
      "Familias, estudiantes, docentes y personal autorizado de los colegios de Red Itínere. Te registrás con tu correo institucional. Si no tenés uno, el equipo de tu comunidad puede darte una invitación de un solo uso.",
  },
  {
    id: "como-se-usa",
    question: "¿Cómo se usa Loop?",
    answer:
      "Desde el navegador del celular o de la computadora, sin instalar nada. Si querés, también podés agregarla a la pantalla de inicio desde el navegador y abrirla como una app.",
  },
  {
    id: "loopies-cuestan-plata",
    question: "¿Los loopies son dinero?",
    answer:
      "No. Son una unidad virtual interna, sin valor monetario real. Se consiguen con misiones e intercambios, y no se pueden cobrar ni cambiar por dinero.",
  },
  {
    id: "como-se-calcula-el-valor",
    question: "¿Cómo se calcula el valor en loopies?",
    answer:
      "Cada categoría tiene un rango de loopies permitido. Al publicar elegís el valor dentro de ese rango, y la app te sugiere uno según el estado del útil: como nuevo, bueno o regular.",
  },
  {
    id: "puedo-cancelar",
    question: "¿Puedo cancelar un loopeo?",
    answer:
      "Sí. Si todavía no te respondieron, podés retirar tu propuesta. Si ya fue aceptada, cualquiera de las dos familias puede cancelar mientras el artículo no esté marcado como recibido, y cada una recupera los loopies que tenía reservados.",
  },
  {
    id: "no-aparece-la-otra-familia",
    question: "¿Qué pasa si la otra familia no se presenta a la entrega?",
    answer:
      'Mientras no hayas marcado el artículo como recibido, podés cancelar el intercambio y recuperar tus loopies. También podés avisarle al equipo de Loop con el botón "Denunciar" de la publicación o del perfil. Red Itínere ofrece la plataforma pero no interviene en la entrega en sí: cada familia responde por sus acuerdos.',
  },
  {
    id: "que-puedo-publicar",
    question: "¿Qué puedo publicar?",
    answer:
      "Útiles escolares que ya no usás y que estén en condiciones de tener una segunda vida: cuadernos, mochilas, cartucheras, uniformes, zapatos escolares y más.",
  },
];

/** Who can join, with the icon each group gets in the schools band. */
export const JOIN_GROUPS = ["Familias", "Estudiantes", "Docentes", "Personal autorizado"] as const;

export type SchoolLogo = { id: string; name: string };

/** The five brands the app already shows for Red Itínere's nine campuses. Logos only, no labels. */
export const SCHOOL_LOGOS: SchoolLogo[] = [
  { id: "northfield", name: "Northfield School" },
  { id: "del-faro", name: "Colegio del Faro" },
  { id: "south-creek", name: "South Creek School" },
  { id: "north-schools", name: "North School" },
  { id: "the-global-school", name: "The Global School" },
];

export type CommunityPoint = { id: string; title: string; text: string };

/** Each point is backed by code: `community_email_domains`, RLS, `adminClient/src/pages/*`, `global_stats`. */
export const COMMUNITY_POINTS: CommunityPoint[] = [
  {
    id: "acceso",
    title: "Entrada controlada",
    text: "Solo se entra con un correo institucional de un dominio autorizado, o con una invitación de un solo uso que genera el equipo de la comunidad.",
  },
  {
    id: "aislamiento",
    title: "Cada comunidad ve lo suyo",
    text: "Los colegios, las publicaciones, los mensajes y los miembros de una comunidad no se ven desde otra. Está resuelto en la base de datos, no solo en la pantalla.",
  },
  {
    id: "panel",
    title: "Un panel para su equipo",
    text: "Administra colegios, miembros, invitaciones, notificaciones y pedidos de baja de cuenta.",
  },
  {
    id: "impacto",
    title: "Impacto ambiental propio",
    text: "Cada comunidad acumula su propio impacto, en residuos evitados, CO2 y agua ahorrada, a medida que se confirman los intercambios.",
  },
];
