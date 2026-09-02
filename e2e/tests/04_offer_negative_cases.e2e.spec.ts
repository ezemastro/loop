import { test, expect, type LoopFixtures } from "../fixtures";
import {
  ApiError,
  acceptOffer,
  createListing,
  creditUser,
  deleteOffer,
  makeOffer,
  receiveListing,
  registerAdmin,
  registerUser,
  rejectOffer,
  uploadImage,
} from "../helpers/api";
import {
  getCategoryByName,
  getCommunityBySlug,
  getListingById,
  getNotificationsForUser,
  getUserByEmail,
  seedAdminEmail,
  seedSchool,
} from "../helpers/db";

/**
 * Oferta: casos negativos y autorización. Cada escenario valida la respuesta de la
 * API Y el estado final en la base (listing, saldos, bloqueos y notificaciones).
 */

let categoryId: string;
let schoolId: string;
let sellerId: string;
let sellerToken: string;
let buyerId: string;
let buyerToken: string;
let buyerEmail: string;
let thirdToken: string;
let stamp: string;
// Listing compartida por los tests 4..8 (cadena de estados: offered -> publicado -> accepted)
let chainedListingId: string;

const expectApiError = async (
  promise: Promise<unknown>,
  status: number,
  messagePart: string,
): Promise<ApiError> => {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    const apiError = err as ApiError;
    expect(apiError.status).toBe(status);
    expect(apiError.message).toContain(messagePart);
    return apiError;
  }
  throw new Error(`Expected request to fail with ${status} ("${messagePart}")`);
};

const notificationLoopPayloadTypes = async (userId: string) =>
  (await getNotificationsForUser(userId))
    .filter((n) => n.type === "loop")
    .map((n) => n.payload?.type)
    .filter((t): t is string => Boolean(t));

test.describe.serial("Oferta: casos negativos y autorización", () => {
  test.beforeAll(async ({ api, uniqueEmail }: LoopFixtures) => {
    stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const [community] = await getCommunityBySlug("red-itinere");
    schoolId = await seedSchool(community.id, "E2E Escuela Ofertas");
    const [category] = await getCategoryByName("Lápices y lapiceras");
    categoryId = category.id;

    const seller = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-venta"), [
      schoolId,
    ]);
    sellerId = seller.user.id;
    sellerToken = seller.token;

    const buyer = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-compra"), [
      schoolId,
    ]);
    buyerId = buyer.user.id;
    buyerToken = buyer.token;
    buyerEmail = buyer.user.email;

    const third = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-tercero"), [
      schoolId,
    ]);
    thirdToken = third.token;

    const adminEmail = uniqueEmail("northfield.edu.ar", "e2e-admin-ofertas");
    await seedAdminEmail(adminEmail);
    const admin = await registerAdmin(api, adminEmail);
    await creditUser(api, admin.token, buyerId, 1000);
  });

  const sellerListing = async (api: LoopFixtures["api"], price: number, tag: string) => {
    const media = await uploadImage(api, sellerToken);
    const { listing } = await createListing(api, sellerToken, {
      title: `E2E Oferta ${tag} ${stamp}`,
      description: "Publicacion de prueba",
      price,
      categoryId,
      productStatus: "like_new",
      mediaIds: [media.id],
    });
    return listing.id;
  };

  const buyerBalance = async () => {
    const [user] = await getUserByEmail(buyerEmail);
    return { balance: Number(user.credits_balance), locked: Number(user.credits_locked) };
  };

  test("oferta sobre la propia publicación", async ({ api }: LoopFixtures) => {
    const listingId = await sellerListing(api, 500, "propia");

    await expectApiError(
      makeOffer(api, sellerToken, listingId, 100),
      400,
      "propia publicación",
    );

    const [row] = await getListingById(listingId);
    expect(row.listing_status).toBe("published");
    expect(row.buyer_id).toBeNull();
    expect(row.offered_credits).toBeNull();
  });

  test("oferta mayor al precio", async ({ api }: LoopFixtures) => {
    const listingId = await sellerListing(api, 500, "precio");

    await expectApiError(
      makeOffer(api, buyerToken, listingId, 501),
      400,
      "Precio de oferta inválido",
    );

    const [row] = await getListingById(listingId);
    expect(row.listing_status).toBe("published");
    expect(row.buyer_id).toBeNull();
    expect(await buyerBalance()).toEqual({ balance: 1000, locked: 0 });
  });

  test("oferta con créditos insuficientes", async ({ api, uniqueEmail }: LoopFixtures) => {
    // Precio dentro de la banda de la categoría (140-700, ver seed): un comprador sin saldo
    // propio, no el `buyer` compartido (que arranca con 1000 y nunca sería insuficiente frente
    // a un precio válido para esta categoría).
    const listingId = await sellerListing(api, 700, "creditos");
    const poorBuyer = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-sin-saldo"), [
      schoolId,
    ]);

    await expectApiError(
      makeOffer(api, poorBuyer.token, listingId, 100),
      400,
      "Créditos insuficientes",
    );

    const [row] = await getListingById(listingId);
    expect(row.listing_status).toBe("published");
    expect(row.buyer_id).toBeNull();
  });

  test("solo el vendedor acepta", async ({ api }: LoopFixtures) => {
    chainedListingId = await sellerListing(api, 500, "cadena");
    await makeOffer(api, buyerToken, chainedListingId, 300);

    await expectApiError(
      acceptOffer(api, thirdToken, chainedListingId),
      401,
      "No eres el vendedor",
    );

    const [row] = await getListingById(chainedListingId);
    expect(row.listing_status).toBe("offered");
    expect(row.buyer_id).toBe(buyerId);
    expect(Number(row.offered_credits)).toBe(300);
  });

  test("solo el comprador recibe", async ({ api }: LoopFixtures) => {
    await expectApiError(
      receiveListing(api, thirdToken, chainedListingId),
      401,
      "No eres el comprador",
    );

    const [after] = await getListingById(chainedListingId);
    expect(after.listing_status).toBe("offered");
    expect(after.buyer_id).toBe(buyerId);
  });

  test("comprador cancela la oferta y recupera créditos", async ({ api }: LoopFixtures) => {
    await deleteOffer(api, buyerToken, chainedListingId);

    const [after] = await getListingById(chainedListingId);
    expect(after.listing_status).toBe("published");
    expect(after.buyer_id).toBeNull();
    expect(after.offered_credits).toBeNull();
    expect(await buyerBalance()).toEqual({ balance: 1000, locked: 0 });
    expect(await notificationLoopPayloadTypes(sellerId)).toContain("offer_deleted");
  });

  test("vendedor rechaza y devuelve créditos", async ({ api }: LoopFixtures) => {
    await makeOffer(api, buyerToken, chainedListingId, 300);
    await rejectOffer(api, sellerToken, chainedListingId);

    const [after] = await getListingById(chainedListingId);
    expect(after.listing_status).toBe("published");
    expect(after.buyer_id).toBeNull();
    expect(after.offered_credits).toBeNull();
    expect(await buyerBalance()).toEqual({ balance: 1000, locked: 0 });
    expect(await notificationLoopPayloadTypes(buyerId)).toContain("offer_rejected");
  });

  test("oferta sobre listing no publicado falla", async ({ api }: LoopFixtures) => {
    await makeOffer(api, buyerToken, chainedListingId, 500);
    await acceptOffer(api, sellerToken, chainedListingId);

    const [accepted] = await getListingById(chainedListingId);
    expect(accepted.listing_status).toBe("accepted");

    await expectApiError(
      makeOffer(api, buyerToken, chainedListingId, 100),
      400,
      "hacer una oferta",
    );
  });
});