import { randomUUID } from "node:crypto";
import { queries } from "../services/queries";
import { validateCategory } from "../services/validations";
import {
  databaseQueryMock,
  MOCK_CATEGORIES_DB,
  MOCK_COMMUNITY_DB,
  MOCK_USER_DB,
} from "../tests/utils";
import type { DatabaseClient } from "../types/dbClient";
import { getCategoryById, getNotificationsByUserId } from "./helpersDb";

/**
 * Los mocks imitan una conexión **ya scopeada** a `MOCK_COMMUNITY`: los helpers leen
 * `client.communityId` para armar el último parámetro de cada query, así que sin esto pasarían
 * `undefined` y el mock no matchearía.
 */
const client = {
  query: jest.fn().mockImplementation(databaseQueryMock),
  begin: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  scope: { mode: "community", communityId: MOCK_COMMUNITY_DB.id },
  communityId: MOCK_COMMUNITY_DB.id,
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
          const parentCategory = MOCK_CATEGORIES_DB.find((c) => c.id === currentParentId);
          currentParentId = parentCategory?.parent_id || null;
        }

        expect(category.parents).toHaveLength(expectedParentCount);

        // Validar estructura de hijos
        const expectedChildren = MOCK_CATEGORIES_DB.filter((c) => c.parent_id === categoryData.id);

        if (expectedChildren.length === 0) {
          expect(category.children).toBeNull();
        } else {
          expect(category.children).toHaveLength(expectedChildren.length);

          // Verificar que cada hijo tiene el ID esperado
          category.children?.forEach((child) => {
            const expectedChild = expectedChildren.find((c) => c.id === child.id);
            expect(expectedChild).toBeDefined();
            expect(child.name).toBe(expectedChild!.name);
          });
        }
      },
    );
  });

  describe("Notifications Helpers", () => {
    // notification-integrity: "Reads Do Not Silently Drop Rows", "Pagination Counts Match
    // Returned Rows". Antes esto se llamaba "should skip..." y esperaba que la notificación con
    // el listing roto desapareciera de la respuesta; ahora se devuelve igual, con `listing:
    // undefined`, y el total de paginación sigue coincidiendo con lo que realmente se entrega.
    it("should still return notifications whose referenced entity is missing", async () => {
      const missingListingId = randomUUID() as UUID;
      const notificationUserId = randomUUID() as UUID;
      const donorUserId = MOCK_USER_DB.id;

      const clientWithMissingListing = {
        query: jest.fn().mockImplementation((query, params: unknown[]) => {
          if (query === queries.notificationsByUserId) {
            return [
              {
                id: randomUUID() as UUID,
                user_id: notificationUserId,
                created_at: new Date().toISOString(),
                is_read: false,
                type: "loop",
                payload: {
                  buyerId: null,
                  listingId: missingListingId,
                  toListingStatus: "offered",
                  toOfferedCredits: 100,
                  type: "new_offer",
                } as LoopNotificationPayloadBase,
                read_at: null,
                total_records: "2" as DbNumber,
              },
              {
                id: randomUUID() as UUID,
                user_id: notificationUserId,
                created_at: new Date().toISOString(),
                is_read: false,
                type: "donation",
                payload: {
                  amount: 25,
                  donorUserId,
                  message: "Gracias",
                } as DonationNotificationPayloadBase,
                read_at: null,
                total_records: "2" as DbNumber,
              },
            ];
          }

          if (query === queries.listingById) {
            if (params[0] === missingListingId) return [];
          }

          if (query === queries.userById) {
            return [MOCK_USER_DB];
          }

          if (query === queries.userSchoolsByUserId) {
            return [];
          }

          return [];
        }),
        begin: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
        scope: { mode: "community", communityId: MOCK_COMMUNITY_DB.id },
        communityId: MOCK_COMMUNITY_DB.id,
      } as DatabaseClient;

      const { notifications, pagination } = await getNotificationsByUserId({
        client: clientWithMissingListing,
        userId: notificationUserId,
        page: 1,
      });

      expect(notifications).toHaveLength(2);
      const loopNotification = notifications.find((n) => n.type === "loop");
      expect(loopNotification).toBeDefined();
      // `null`, not `undefined`: `undefined` vanishes when the payload is serialized to JSON, so
      // the client received a payload with no `listing` key at all and dereferenced it blindly.
      // An explicit `null` is what the client's `LoopNotificationPayload` now declares and checks.
      expect((loopNotification!.payload as { listing?: unknown }).listing).toBeNull();
      const donationNotification = notifications.find((n) => n.type === "donation");
      expect(donationNotification).toBeDefined();
      // El total de paginación viene de `COUNT(*) OVER()` (mockeado en `total_records`) y ahora
      // coincide con lo que realmente se devuelve, porque nada se descarta.
      expect(pagination.totalRecords).toBe(2);
      expect(notifications).toHaveLength(pagination.totalRecords);
    });
  });
});
