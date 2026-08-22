import { test, expect, type LoopFixtures } from "../fixtures";
import {
  ApiError,
  authHeaders,
  createListing,
  creditUser,
  donate,
  expectOk,
  getSchools,
  registerAdmin,
  registerUser,
  sendMessage,
  uploadImage,
  type Listing,
} from "../helpers/api";
import {
  getCategoryByName,
  getCommunityBySlug,
  getListingById,
  getMessagesBetween,
  getUserByEmail,
  seedAdminEmail,
  seedCommunity,
  seedSchool,
  query,
} from "../helpers/db";

/**
 * Aislamiento entre comunidades: todo intento de cruzar la frontera tiene que
 * fallar y la base no puede quedar con filas de otra comunidad.
 *
 * Invariante verificado en los modelos: las búsquedas van scopeadas a la comunidad
 * de la sesion (`client.communityId`), asi que un usuario de A nunca resuelve datos de B.
 */

let communityAId: string;
let communityBId: string;
let schoolAId: string;
let schoolBId: string;
let schoolBName: string;
let userAId: string;
let userAToken: string;
let userBId: string;
let userBToken: string;
let userBEmail: string;
let adminToken: string;
let bListingId: string;
let bListingTitle: string;
let stamp: string;

const expectApiError = async (
  promise: Promise<unknown>,
  status: number,
  code: string,
  messagePart: string,
): Promise<ApiError> => {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    const apiError = err as ApiError;
    expect(apiError.status).toBe(status);
    expect(apiError.code).toBe(code);
    expect(apiError.message).toContain(messagePart);
    return apiError;
  }
  throw new Error(`Expected request to fail with ${status} "${code}" ("${messagePart}")`);
};

test.describe.serial("Aislamiento entre comunidades", () => {
  test.beforeAll(async ({ api, db, uniqueEmail }: LoopFixtures) => {
    stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const [communityA] = await getCommunityBySlug("red-itinere");
    communityAId = communityA.id;
    schoolAId = await seedSchool(communityAId, "E2E Escuela A");

    const communityB = await seedCommunity({
      slug: `e2e-b-${stamp}`,
      name: "E2E Comunidad Vecina 03",
      domains: [`e2e-b-${stamp}.test`],
    });
    communityBId = communityB.communityId;
    schoolBId = communityB.schoolId;
    const [schoolBDb] = await query<{ name: string }>(
      `SELECT name FROM schools WHERE id = $1`,
      [schoolBId],
    );
    schoolBName = schoolBDb.name;

    const userA = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-a"), [schoolAId]);
    userAId = userA.user.id;
    userAToken = userA.token;

    const userB = await registerUser(
      api,
      uniqueEmail(`e2e-b-${stamp}.test`, "e2e-b"),
      [schoolBId],
    );
    userBId = userB.user.id;
    userBToken = userB.token;
    userBEmail = userB.user.email;

    const adminEmail = uniqueEmail("northfield.edu.ar", "e2e-admin");
    await seedAdminEmail(adminEmail);
    const admin = await registerAdmin(api, adminEmail);
    adminToken = admin.token;

    expect(userA.user.communityId).toBe(communityAId);
    expect(userB.user.communityId).toBe(communityBId);
  });

  test("feed aislado: A no ve las publicaciones de B", async ({ api }: LoopFixtures) => {
    const [category] = await getCategoryByName("Lápices y lapiceras");
    bListingTitle = `E2E Publicacion B ${stamp}`;
    const media = await uploadImage(api, userBToken);
    const { listing } = await createListing(api, userBToken, {
      title: bListingTitle,
      description: "Publicacion de la comunidad B",
      price: 300,
      categoryId: category.id,
      productStatus: "like_new",
      mediaIds: [media.id],
    });
    bListingId = listing.id;

    const [dbListing] = await getListingById(bListingId);
    expect(dbListing.community_id).toBe(communityBId);

    const searchRes = await expectOk<{ listings: Listing[] }>(
      await api.get("/listings", {
        headers: authHeaders(userAToken),
        params: new URLSearchParams({ searchTerm: bListingTitle }).toString(),
      }),
    );
    expect(searchRes.listings.some((l) => l.id === bListingId)).toBe(false);
    expect(searchRes.listings.some((l) => l.title === bListingTitle)).toBe(false);

    const feedRes = await expectOk<{ listings: Listing[] }>(
      await api.get("/listings", {
        headers: authHeaders(userAToken),
        params: new URLSearchParams({ searchTerm: "" }).toString(),
      }),
    );
    expect(feedRes.listings.some((l) => l.id === bListingId)).toBe(false);

    await expectApiError(
      expectOk<{ listing: Listing }>(
        await api.get(`/listings/${bListingId}`, { headers: authHeaders(userAToken) }),
      ),
      404,
      "NOT_FOUND",
      "Listado no encontrado",
    );
  });

  test("usuario B ve su propia publicación", async ({ api }: LoopFixtures) => {
    const { listing } = await expectOk<{ listing: Listing }>(
      await api.get(`/listings/${bListingId}`, { headers: authHeaders(userBToken) }),
    );
    expect(listing.id).toBe(bListingId);
    expect(listing.listingStatus).toBe("published");
  });

  test("mensajes cruzados rechazados", async ({ api }: LoopFixtures) => {
    await expectApiError(
      sendMessage(api, userAToken, userBId, "hola desde A"),
      404,
      "NOT_FOUND",
      "Usuario no encontrado",
    );

    const messages = await getMessagesBetween(userAId, userBId);
    expect(messages).toHaveLength(0);
  });

  test("escuelas por comunidad", async ({ api }: LoopFixtures) => {
    const { schools } = await getSchools(api, communityAId);
    expect(schools.length).toBeGreaterThan(0);
    expect(schools.some((s) => s.id === schoolAId)).toBe(true);
    expect(schools.some((s) => s.id === schoolBId)).toBe(false);
    expect(schools.some((s) => s.name === schoolBName)).toBe(false);
  });

  test("credits donados no cruzan", async ({ api }: LoopFixtures) => {
    await creditUser(api, adminToken, userAId, 500);

    const [userBBefore] = await getUserByEmail(userBEmail);
    const balanceBefore = Number(userBBefore.credits_balance);

    await expectApiError(
      donate(api, userAToken, userBId, 100),
      400,
      "INVALID_INPUT",
      "Usuario no encontrado",
    );

    // El saldo de B no cambió: la donación cruzada se cortó antes de tocar nada.
    const [userBAfter] = await getUserByEmail(userBEmail);
    expect(Number(userBAfter.credits_balance)).toBe(balanceBefore);
    expect(Number(userBAfter.credits_locked)).toBe(0);
  });
});