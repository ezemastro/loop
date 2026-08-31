/**
 * Catálogos compartidos entre comunidades: categorías y plantillas de misión.
 *
 * En la base ninguna de las dos tablas lleva `community_id` (ver `0002_add_community_id_nullable`),
 * así que acá tampoco cuelgan de una comunidad.
 *
 * Los nombres de categoría son **exactamente** los de `server/create_categories.sql`. El seed
 * resuelve cada categoría por nombre antes de insertarla, así que una base que ya corrió ese
 * script reutiliza sus filas en lugar de duplicarlas; el ID determinista de acá solo se usa cuando
 * la categoría todavía no existe.
 */
import { demoId } from "./ids";
import type { DemoCategory, DemoMissionTemplate, DemoStats } from "./types";

/** Impacto ambiental por artículo intercambiado. Valores ilustrativos, no medidos. */
export const CATEGORY_STATS: DemoStats = { kgWaste: 2.4, kgCo2: 0.65, lH2o: 41 };

interface CategoryBlueprint {
  name: string;
  parent?: string;
  description?: string;
  min?: number;
  max?: number;
  icon?: string;
}

const CATEGORY_BLUEPRINTS: CategoryBlueprint[] = [
  { name: "Útiles escolares", icon: "✏️" },
  { name: "Cartucheras y mochilas", icon: "🎒" },
  { name: "Papelería", icon: "📓" },
  { name: "Uniformes y ropa", icon: "👕" },
  { name: "Otros", icon: "📦" },
  {
    name: "Lápices y lapiceras",
    parent: "Útiles escolares",
    description: "Incluye lápices negros, de colores, lapiceras, bolígrafos, fibras.",
    min: 140,
    max: 700,
  },
  {
    name: "Marcadores y resaltadores",
    parent: "Útiles escolares",
    description: "Marcadores escolares, resaltadores de colores.",
    min: 280,
    max: 1120,
  },
  {
    name: "Gomas y correctores",
    parent: "Útiles escolares",
    description: "Gomas de borrar, correctores líquidos o en cinta.",
    min: 140,
    max: 560,
  },
  {
    name: "Reglas, escuadras y compases",
    parent: "Útiles escolares",
    description: "Set de geometría básico para matemáticas.",
    min: 280,
    max: 1400,
  },
  {
    name: "Cartucheras",
    parent: "Cartucheras y mochilas",
    description: "Cartucheras de tela, cuero o rígidas.",
    min: 700,
    max: 2800,
  },
  {
    name: "Mochilas",
    parent: "Cartucheras y mochilas",
    description: "Mochilas escolares de distintos tamaños.",
    min: 2800,
    max: 11200,
  },
  {
    name: "Cuadernos",
    parent: "Papelería",
    description: "Cuadernos de tapa blanda, dura o anillados.",
    min: 560,
    max: 2800,
  },
  {
    name: "Carpetas y repuestos de hojas",
    parent: "Papelería",
    description: "Carpetas A4, A5, con repuestos de hojas rayadas o cuadriculadas.",
    min: 1400,
    max: 5600,
  },
  {
    name: "Hojas lisas, cuadriculadas y de colores",
    parent: "Papelería",
    description: "Paquetes de hojas para carpetas o impresiones.",
    min: 280,
    max: 1400,
  },
  {
    name: "Camisas y remeras",
    parent: "Uniformes y ropa",
    description: "Camisas de uniforme escolar y remeras con logo.",
    min: 2800,
    max: 7000,
  },
  {
    name: "Pantalones y faldas",
    parent: "Uniformes y ropa",
    description: "Pantalones de uniforme y faldas escolares.",
    min: 4200,
    max: 11200,
  },
  {
    name: "Buzos y camperas",
    parent: "Uniformes y ropa",
    description: "Buzos, sweaters y camperas escolares.",
    min: 5600,
    max: 14000,
  },
  {
    name: "Zapatos escolares",
    parent: "Uniformes y ropa",
    description: "Zapatos de vestir o deportivos para uniforme.",
    min: 7000,
    max: 16800,
  },
  {
    name: "Botellas de agua y loncheras",
    parent: "Otros",
    description: "Botellas reutilizables, loncheras escolares.",
    min: 560,
    max: 2800,
  },
  {
    name: "Material artístico",
    parent: "Otros",
    description: "Acuarelas, témperas, pinceles, crayones.",
    min: 560,
    max: 4200,
  },
];

const categoryId = (name: string): UUID => demoId("catalog", "category", name);

export const DEMO_CATEGORIES: DemoCategory[] = CATEGORY_BLUEPRINTS.map((blueprint) => ({
  id: categoryId(blueprint.name),
  name: blueprint.name,
  parentName: blueprint.parent ?? null,
  parentId: blueprint.parent ? categoryId(blueprint.parent) : null,
  description: blueprint.description ?? null,
  minPriceCredits: blueprint.min ?? null,
  maxPriceCredits: blueprint.max ?? null,
  icon: blueprint.icon ?? null,
  stats: { ...CATEGORY_STATS },
}));

/** Busca por nombre y falla ruidosamente: un typo en un listing tiene que romper el build, no crear datos huérfanos. */
export const demoCategoryByName = (name: string): DemoCategory => {
  const found = DEMO_CATEGORIES.find((category) => category.name === name);
  if (!found) throw new Error(`Categoría inexistente en el dataset demo: ${name}`);
  return found;
};

export const DEMO_MISSION_TEMPLATES: DemoMissionTemplate[] = [
  {
    id: demoId("catalog", "mission", "first_listing"),
    key: "first_listing",
    title: "Publicá tu primer artículo",
    description: "Sumá un artículo al catálogo y ayudá a otra familia.",
    rewardCredits: 200,
    active: true,
  },
  {
    id: demoId("catalog", "mission", "complete_profile"),
    key: "complete_profile",
    title: "Completá tu perfil",
    description: "Agregá tu foto de perfil y tus colegios.",
    rewardCredits: 100,
    active: true,
  },
  {
    id: demoId("catalog", "mission", "three_loops"),
    key: "three_loops",
    title: "Hacé 3 Loops",
    description: "Completá tres intercambios de artículos.",
    rewardCredits: 500,
    active: true,
  },
  {
    id: demoId("catalog", "mission", "donate"),
    key: "donate",
    title: "Ayudá a tu comunidad",
    description: "Doná Loopies a otro usuario.",
    rewardCredits: 300,
    active: true,
  },
];

export const demoMissionByKey = (key: string): DemoMissionTemplate => {
  const found = DEMO_MISSION_TEMPLATES.find((mission) => mission.key === key);
  if (!found) throw new Error(`Misión inexistente en el dataset demo: ${key}`);
  return found;
};
