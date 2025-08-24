import { validateCategory } from "../services/validations";
import { databaseQueryMock, MOCK_CATEGORIES_DB } from "../test/utils";
import type { DatabaseClient } from "../types/dbClient";
import { getCategoryById } from "./helpersDb";

const client = {
  query: jest.fn().mockImplementation(databaseQueryMock),
  begin: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
} as DatabaseClient;
describe("Database Helpers", () => {
  describe("Category Helpers", () => {
    it.each(MOCK_CATEGORIES_DB)(
      "should create the category tree correctly for category %name",
      async (categoryData) => {
        const category = await getCategoryById({
          client,
          categoryId: categoryData.id,
        });

        await expect(validateCategory(category)).resolves.not.toThrow();

        // Validar estructura de padres
        let expectedParentCount = 0;
        let currentParentId = categoryData.parent_id;

        while (currentParentId) {
          expectedParentCount++;
          const parentCategory = MOCK_CATEGORIES_DB.find(
            (c) => c.id === currentParentId,
          );
          currentParentId = parentCategory?.parent_id || null;
        }

        expect(category.parents).toHaveLength(expectedParentCount);

        // Validar estructura de hijos
        const expectedChildren = MOCK_CATEGORIES_DB.filter(
          (c) => c.parent_id === categoryData.id,
        );

        if (expectedChildren.length === 0) {
          expect(category.children).toBeNull();
        } else {
          expect(category.children).toHaveLength(expectedChildren.length);

          // Verificar que cada hijo tiene el ID esperado
          category.children?.forEach((child) => {
            const expectedChild = expectedChildren.find(
              (c) => c.id === child.id,
            );
            expect(expectedChild).toBeDefined();
            expect(child.name).toBe(expectedChild!.name);
          });
        }
      },
    );
  });
});
