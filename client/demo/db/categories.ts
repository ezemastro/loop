/** Catálogo de categorías del modo demo, hidratado desde el dataset compartido. */
import { SHARED_CATEGORIES } from "./dataset";

export { CATEGORY_STATS } from "../../../shared/demo-data";

export const DEMO_CATEGORIES: CategoryBase[] = SHARED_CATEGORIES.map((category) => ({
  id: category.id,
  name: category.name,
  parentId: category.parentId,
  description: category.description,
  price: { min: category.minPriceCredits, max: category.maxPriceCredits },
  icon: category.icon,
  stats: { ...category.stats },
}));

export const categoryById = (id: UUID) =>
  DEMO_CATEGORIES.find((category) => category.id === id) ?? null;

/** Busca por nombre. Falla ruidosamente: un typo tiene que romper acá y no dejar una pantalla vacía. */
export const demoCategoryIdByName = (name: string): UUID => {
  const found = DEMO_CATEGORIES.find((category) => category.name === name);
  if (!found) throw new Error(`Categoría demo inexistente: ${name}`);
  return found.id;
};
