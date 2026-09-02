import { test, expect, type LoopFixtures } from "../fixtures";
import {
  ApiError,
  acceptOffer,
  authHeaders,
  createListing,
  creditUser,
  expectOk,
  getMe,
  makeOffer,
  receiveListing,
  registerAdmin,
  registerUser,
  uploadImage,
  type Listing,
} from "../helpers/api";
import {
  getCategoryByName,
  getCommunityBySlug,
  getListingById,
  getListingMedia,
  getListingTrades,
  getNotificationsForUser,
  getUserByEmail,
  query,
  seedSchool,
} from "../helpers/db";

/**
 * Journey de publicación → intercambio completado: el flujo de negocio crítico de Loop.
 * Un comprador ofrece créditos + un ítem propio (trade) para cubrir un precio mayor, el
 * vendedor acepta y el comprador recibe: los saldos y bloqueos se liquidan en la base.
 */

const PRICE = 500;
const OFFER = 300;
const TRADE_PRICE = 200;
const CREDITS = 100_000;

let communityId: string;
let categoryId: string;
let sellerId: string;
let sellerEmail: string;
let sellerToken: string;
let buyerId: string;
let buyerEmail: string;
let buyerToken: string;
let listingId: string;
let listingTitle: string;
let tradeListingId: string;
let stamp: string;
// Baselines medidos en la base DESPUÉS de las publicaciones (publicar completa misiones que
// otorgan créditos: publish-listing-1 etc. — ver helpersDb.progressMission), así las
// assertions miden el DELTA del intercambio, que es lo que importa.
let sellerBaseline: number;
let buyerBaseline: number;

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

/**
 * seedAdminEmail (helpers/db) inserta solo { email }, y la tabla exige que un
 * community_admin tenga community_id (check admin_valid_emails_role_scope_chk, migración 0006):
 * ese INSERT falla con check_violation. Se siembra el email con la comunidad adjunta, igual que
 * queries.addValidEmailForAdminRegistration en el panel.
 */
const seedCommunityAdmin = async (email: string, communityId: string) => {
  await query(
    `INSERT INTO admin_valid_emails (email, role, community_id) VALUES (lower($1), 'community_admin', $2)
     ON CONFLICT (email) DO NOTHING`,
    [email, communityId],
  );
};

test.describe.serial("Journey de publicación→intercambio completado", () => {
  test.beforeAll(async ({ api, uniqueEmail }: LoopFixtures) => {
    stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const [community] = await getCommunityBySlug("red-itinere");
    communityId = community.id;
    const schoolId = await seedSchool(communityId, "E2E Escuela Journey");
    const [category] = await getCategoryByName("Lápices y lapiceras"); // precio 140-700
    categoryId = category.id;

    const seller = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-journey-vendedor"), [
      schoolId,
    ]);
    sellerId = seller.user.id;
    sellerEmail = seller.user.email;
    sellerToken = seller.token;

    const buyer = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-journey-comprador"), [
      schoolId,
    ]);
    buyerId = buyer.user.id;
    buyerEmail = buyer.user.email;
    buyerToken = buyer.token;

    const adminEmail = uniqueEmail("reditinere.com", "admin");
    await seedCommunityAdmin(adminEmail, communityId);
    const admin = await registerAdmin(api, adminEmail);
    await creditUser(api, admin.token, buyerId, CREDITS);

    const { user: creditedUser } = await getMe(api, buyerToken);
    expect(creditedUser.credits.balance).toBe(CREDITS);
    expect(creditedUser.credits.locked).toBe(0);

    const [buyerDb] = await getUserByEmail(buyerEmail);
    expect(Number(buyerDb.credits_balance)).toBe(CREDITS);
    expect(Number(buyerDb.credits_locked)).toBe(0);
  });

  test("el vendedor publica y la base lo confirma", async ({ api }: LoopFixtures) => {
    const media = await uploadImage(api, sellerToken);
    listingTitle = `E2E Journey ${stamp}`;
    const { listing } = await createListing(api, sellerToken, {
      title: listingTitle,
      description: "Publicación del viaje completo de intercambio",
      price: PRICE,
      categoryId,
      productStatus: "good",
      mediaIds: [media.id],
    });
    listingId = listing.id;

    expect(listing.listingStatus).toBe("published");
    expect(listing.sellerId).toBe(sellerId);
    expect(listing.price).toBe(PRICE);
    expect(listing.media.map((m) => m.id)).toContain(media.id);

    const [dbListing] = await getListingById(listingId);
    expect(dbListing.listing_status).toBe("published");
    expect(dbListing.buyer_id).toBeNull();
    expect(dbListing.offered_credits).toBeNull();
    expect(Number(dbListing.price_credits)).toBe(PRICE);
    expect(dbListing.community_id).toBe(communityId);

    const mediaRows = await getListingMedia(listingId);
    expect(mediaRows.map((m) => m.media_id)).toEqual([media.id]);

    // Publicar completa la misión publish-listing-1 (reward de créditos + helpersDb.progressMission).
    // Se mide el baseline del vendedor DESPUÉS de su publicación para que las assertions del
    // intercambio midan SOLO el delta de loopies.
    const [sellerDb] = await getUserByEmail(sellerEmail);
    sellerBaseline = Number(sellerDb.credits_balance);
  });

  test("el comprador ve la publicación en el feed", async ({ api }: LoopFixtures) => {
    const res = await expectOk<{ listings: Listing[] }>(
      await api.get("/listings", {
        headers: authHeaders(buyerToken),
        params: new URLSearchParams({ searchTerm: listingTitle }).toString(),
      }),
    );
    expect(res.listings.some((l) => l.id === listingId)).toBe(true);
    expect(res.listings.some((l) => l.title === listingTitle)).toBe(true);
  });

  test("el comprador ofrece por debajo del precio con un ítem de intercambio", async ({
    api,
  }: LoopFixtures) => {
    // Oferta de 300 < precio 500. acceptOffer solo acepta ofertas parciales cuando créditos +
    // ítems a intercambiar cubren el precio (TOTAL_PRICE_EXCEEDED en models/listings.ts), así
    // que el comprador publica su propio ítem de 200 para completar el total.
    const tradeMedia = await uploadImage(api, buyerToken);
    const { listing: tradeListing } = await createListing(api, buyerToken, {
      title: `E2E Trade ${stamp}`,
      description: "Ítem del comprador para completar el intercambio",
      price: TRADE_PRICE,
      categoryId,
      productStatus: "like_new",
      mediaIds: [tradeMedia.id],
    });
    tradeListingId = tradeListing.id;

    // El buyer también completa la misión de publicación al crear su ítem de intercambio:
    // el baseline se captura acá para que el delta de la oferta sea exacto.
    const [buyerBeforeOffer] = await getUserByEmail(buyerEmail);
    buyerBaseline = Number(buyerBeforeOffer.credits_balance);

    const { listing } = await makeOffer(api, buyerToken, listingId, OFFER);
    expect(listing.listingStatus).toBe("offered");
    expect(listing.buyerId).toBe(buyerId);
    expect(listing.offeredCredits).toBe(OFFER);

    const [dbListing] = await getListingById(listingId);
    expect(dbListing.listing_status).toBe("offered");
    expect(dbListing.buyer_id).toBe(buyerId);
    expect(Number(dbListing.offered_credits)).toBe(OFFER);
    expect(Number(dbListing.price_credits)).toBe(PRICE);

    const [buyerDb] = await getUserByEmail(buyerEmail);
    expect(Number(buyerDb.credits_balance)).toBe(buyerBaseline - OFFER);
    expect(Number(buyerDb.credits_locked)).toBe(OFFER);
  });

  test("el vendedor recibe la notificación de oferta", async () => {
    expect(await notificationLoopPayloadTypes(sellerId)).toContain("new_offer");
  });

  test("el vendedor acepta la oferta y la base confirma", async ({ api }: LoopFixtures) => {
    await acceptOffer(api, sellerToken, listingId, [tradeListingId]);

    const [dbListing] = await getListingById(listingId);
    expect(dbListing.listing_status).toBe("accepted");
    expect(dbListing.buyer_id).toBe(buyerId);
    expect(Number(dbListing.offered_credits)).toBe(OFFER);

    const tradeRows = await getListingTrades(listingId);
    // credit-economy-integrity (ECO-04): `acceptOffer` ahora SÍ inserta en `listing_trades` por
    // cada listing tradeado (queries.storeTrade, antes con cero call sites) — necesario para que
    // `POST /:listingId/cancel` (ECO-05) sepa qué listings devolver al mercado si el loop se
    // cancela. La aserción vieja de esta línea esperaba `toHaveLength(0)`; ahora es 1.
    expect(tradeRows).toHaveLength(1);
    expect(tradeRows[0]?.trade_listing_id).toBe(tradeListingId);

    const [tradeDb] = await getListingById(tradeListingId);
    expect(tradeDb.listing_status).toBe("accepted");
    expect(tradeDb.buyer_id).toBe(sellerId);

    const [buyerDb] = await getUserByEmail(buyerEmail);
    expect(Number(buyerDb.credits_balance)).toBe(buyerBaseline - OFFER);
    expect(Number(buyerDb.credits_locked)).toBe(OFFER);
  });

  test("el comprador recibe y los saldos se liquidan", async ({ api }: LoopFixtures) => {
    await receiveListing(api, buyerToken, listingId);

    const [dbListing] = await getListingById(listingId);
    expect(dbListing.listing_status).toBe("received");
    expect(dbListing.buyer_id).toBe(buyerId);
    expect(Number(dbListing.offered_credits)).toBe(OFFER);

    const [sellerDb] = await getUserByEmail(sellerEmail);
    expect(Number(sellerDb.credits_balance)).toBe(sellerBaseline + OFFER);
    expect(Number(sellerDb.credits_locked)).toBe(0);

    const [buyerDb] = await getUserByEmail(buyerEmail);
    expect(Number(buyerDb.credits_balance)).toBe(buyerBaseline - OFFER);
    expect(Number(buyerDb.credits_locked)).toBe(0);
  });

  test("notificaciones de cierre del loop", async () => {
    const buyerTypes = await notificationLoopPayloadTypes(buyerId);
    expect(buyerTypes).toContain("offer_accepted");

    // listing_received va al VENDEDOR (models/listings.ts receiveListing), no al comprador.
    const sellerTypes = await notificationLoopPayloadTypes(sellerId);
    expect(sellerTypes).toContain("new_offer");
    expect(sellerTypes).toContain("listing_received");
  });

  test("no se puede ofertar sobre una publicación recibida", async ({ api }: LoopFixtures) => {
    await expectApiError(makeOffer(api, buyerToken, listingId, OFFER), 400, "hacer una oferta");

    const [dbListing] = await getListingById(listingId);
    expect(dbListing.listing_status).toBe("received");
    expect(dbListing.buyer_id).toBe(buyerId);
  });
});