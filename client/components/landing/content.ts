/**
 * Copy and static data for the public marketing landing (`MarketingLanding.tsx`). Kept separate
 * from the section components so the sections stay focused on layout. Content is derived from
 * sostenibilidadenred.com/loop, rewritten in Loop's own voice: no invented numbers, no filler
 * verbs, zero em/en dashes.
 */

/** "Buzón de consultas" in the footer. Confirmed by fetching the source page's raw HTML. */
export const CONSULTAS_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfLxG-rNPnUqMtzzgqGjFbS27Ea2T9d10qlE6ADVcbTd-Yezw/viewform?usp=dialog";

export const NAV_LINKS = [
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "loopies", label: "Loopies" },
  { id: "preguntas", label: "Preguntas" },
] as const;

export type HowItWorksStep = {
  id: string;
  title: string;
  description: string;
};

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: "publicar",
    title: "Publicá",
    description:
      "Subí una foto, elegí la categoría, describilo y marcá el estado y el colegio al que pertenece.",
  },
  {
    id: "recibir",
    title: "Recibí loopies",
    description: "Cada publicación se valora según el tipo de útil y su estado de conservación.",
  },
  {
    id: "buscar",
    title: "Buscá y loopeá",
    description:
      'Filtrá por producto, categoría, colegio o estado. Tocar "Loopear" arranca el intercambio y destraba el contacto de la otra familia.',
  },
  {
    id: "coordinar",
    title: "Coordiná la entrega",
    description:
      "Las familias coordinan directamente, marcan la entrega como completa y se califican mutuamente.",
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
      "Familias, estudiantes, docentes y personal autorizado de los colegios de Red Itínere. El registro se hace con el correo institucional.",
  },
  {
    id: "loopies-cuestan-plata",
    question: "¿Los loopies cuestan plata?",
    answer:
      "No. Los loopies son una unidad virtual interna, sin valor monetario real, y no se pueden cobrar ni cambiar por dinero.",
  },
  {
    id: "no-aparece-la-otra-familia",
    question: "¿Qué pasa si la otra familia no se presenta a la entrega?",
    answer:
      "Podés reportar el problema desde la app. Red Itínere ofrece la plataforma pero no interviene en la entrega en sí: cada familia responde por sus acuerdos.",
  },
  {
    id: "puedo-cancelar",
    question: "¿Puedo cancelar un loopeo?",
    answer: "Sí, mientras el intercambio no se haya marcado como completado.",
  },
  {
    id: "como-se-calcula-el-valor",
    question: "¿Cómo se calcula el valor en loopies?",
    answer:
      "Según el tipo de útil que publicás y su estado de conservación: como nuevo, bueno o regular.",
  },
  {
    id: "que-puedo-publicar",
    question: "¿Qué puedo publicar?",
    answer:
      "Útiles escolares que ya no usás y que estén en condiciones de tener una segunda vida: libros, mochilas, cartucheras, uniformes y más.",
  },
];
