import { uuidFromSeed } from "../ids";

interface CategorySeed {
  name: string;
  parent?: string;
  description?: string | null;
  min?: number | null;
  max?: number | null;
  icon?: string | null;
  stats?: { kgWaste: number; kgCo2: number; lH2o: number } | null;
}

const SEED: CategorySeed[] = [
  { name: "Útiles escolares", icon: "✏️" },
  { name: "Cartucheras y mochilas", icon: "🎒" },
  { name: "Papelería", icon: "📓" },
  { name: "Uniformes y ropa", icon: "👕" },
  { name: "Otros", icon: "📦" },
  { name: "Lápices y lapiceras", parent: "Útiles escolares", description: "Incluye lápices negros, de colores, lapiceras, bolígrafos, fibras.", min: 140, max: 700 },
  { name: "Marcadores y resaltadores", parent: "Útiles escolares", description: "Marcadores escolares, resaltadores de colores.", min: 280, max: 1120 },
  { name: "Gomas y correctores", parent: "Útiles escolares", description: "Gomas de borrar, correctores líquidos o en cinta.", min: 140, max: 560 },
  { name: "Reglas, escuadras y compases", parent: "Útiles escolares", description: "Set de geometría básico para matemáticas.", min: 280, max: 1400 },
  { name: "Cartucheras", parent: "Cartucheras y mochilas", description: "Cartucheras de tela, cuero o rígidas.", min: 700, max: 2800 },
  { name: "Mochilas", parent: "Cartucheras y mochilas", description: "Mochilas escolares de distintos tamaños.", min: 2800, max: 11200 },
  { name: "Cuadernos", parent: "Papelería", description: "Cuadernos de tapa blanda, dura o anillados.", min: 560, max: 2800 },
  { name: "Carpetas y repuestos de hojas", parent: "Papelería", description: "Carpetas A4, A5, con repuestos de hojas rayadas o cuadriculadas.", min: 1400, max: 5600 },
  { name: "Hojas lisas, cuadriculadas y de colores", parent: "Papelería", description: "Paquetes de hojas para carpetas o impresiones.", min: 280, max: 1400 },
  { name: "Camisas y remeras", parent: "Uniformes y ropa", description: "Camisas de uniforme escolar y remeras con logo.", min: 2800, max: 7000 },
  { name: "Pantalones y faldas", parent: "Uniformes y ropa", description: "Pantalones de uniforme y faldas escolares.", min: 4200, max: 11200 },
  { name: "Buzos y camperas", parent: "Uniformes y ropa", description: "Buzos, sweaters y camperas escolares.", min: 5600, max: 14000 },
  { name: "Zapatos escolares", parent: "Uniformes y ropa", description: "Zapatos de vestir o deportivos para uniforme.", min: 7000, max: 16800 },
  { name: "Botellas de agua y loncheras", parent: "Otros", description: "Botellas reutilizables, loncheras escolares.", min: 560, max: 2800 },
  { name: "Material artístico", parent: "Otros", description: "Acuarelas, témperas, pinceles, crayones.", min: 560, max: 4200 },
];

export const CATEGORY_STATS = {
  kgWaste: 2.4,
  kgCo2: 0.65,
  lH2o: 41,
};

export const DEMO_CATEGORIES: CategoryBase[] = SEED.map((seed) => {
  const parent = seed.parent
    ? SEED.findIndex((s) => s.name === seed.parent) + 1
    : null;
  return {
    id: uuidFromSeed(`category-${seed.name}`),
    name: seed.name,
    parentId: parent ? uuidFromSeed(`category-${SEED[parent - 1].name}`) : null,
    description: seed.description ?? null,
    price: { min: seed.min ?? null, max: seed.max ?? null },
    icon: seed.icon ?? null,
    stats: seed.stats ?? CATEGORY_STATS,
  };
});

export const categoryById = (id: UUID) => DEMO_CATEGORIES.find((c) => c.id === id) ?? null;
