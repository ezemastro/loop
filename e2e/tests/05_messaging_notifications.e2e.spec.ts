import { test, expect, type LoopFixtures } from "../fixtures";
import {
  acceptOffer,
  createListing,
  creditUser,
  getNotifications,
  getUnreadMessages,
  makeOffer,
  markMessagesRead,
  registerAdmin,
  registerUser,
  sendMessage,
  uploadImage,
} from "../helpers/api";
import {
  getCategoryByName,
  getCommunityBySlug,
  getListingById,
  getMessagesBetween,
  getNotificationsForUser,
  seedAdminEmail,
  seedSchool,
} from "../helpers/db";

/**
 * Mensajería y notificaciones: cada mensaje se persiste con emisor, receptor y comunidad;
 * los contadores de no leídos reflejan la base; y las ofertas generan notificaciones
 * persistidas que se pueden marcar como leídas.
 */

let communityId: string;
let categoryId: string;
let schoolId: string;
let userAId: string;
let userAToken: string;
let userBId: string;
let userBToken: string;
let listingId: string;
let stamp: string;

test.describe.serial("Mensajería y notificaciones", () => {
  test.beforeAll(async ({ api, uniqueEmail }: LoopFixtures) => {
    stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const [community] = await getCommunityBySlug("red-itinere");
    communityId = community.id;
    schoolId = await seedSchool(communityId, "E2E Escuela Mensajes");
    const [category] = await getCategoryByName("Lápices y lapiceras");
    categoryId = category.id;

    const userA = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-msg-a"), [
      schoolId,
    ]);
    userAId = userA.user.id;
    userAToken = userA.token;

    const userB = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-msg-b"), [
      schoolId,
    ]);
    userBId = userB.user.id;
    userBToken = userB.token;
  });

  test("el mensaje se persiste con emisor, receptor y texto", async ({ api }: LoopFixtures) => {
    await sendMessage(api, userAToken, userBId, "Hola, ¿sigue disponible?");

    const rows = await getMessagesBetween(userAId, userBId);
    expect(rows).toHaveLength(1);
    expect(rows[0].sender_id).toBe(userAId);
    expect(rows[0].recipient_id).toBe(userBId);
    expect(rows[0].text).toBe("Hola, ¿sigue disponible?");
    expect(rows[0].is_read).toBe(false);
  });

  test("la conversación guarda el orden cronológico", async ({ api }: LoopFixtures) => {
    await sendMessage(api, userBToken, userAId, "Sí, seguimos con él");
    await sendMessage(api, userAToken, userBId, "Perfecto, te hago una oferta");

    const rows = await getMessagesBetween(userAId, userBId);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.text)).toEqual([
      "Hola, ¿sigue disponible?",
      "Sí, seguimos con él",
      "Perfecto, te hago una oferta",
    ]);
  });

  test("el contador de chats no leídos refleja los mensajes pendientes", async ({
    api,
  }: LoopFixtures) => {
    const unreadB = await getUnreadMessages(api, userBToken);
    expect(unreadB.unreadChatsCount).toBe(1);
  });

  test("marcar como leído actualiza la base", async ({ api }: LoopFixtures) => {
    await markMessagesRead(api, userBToken, userAId);

    const rows = await getMessagesBetween(userAId, userBId);
    const incomingToB = rows.filter((r) => r.recipient_id === userBId);
    expect(incomingToB.every((r) => r.is_read)).toBe(true);
  });

  test("una oferta genera una notificación persistida para el vendedor", async ({
    api,
    uniqueEmail,
  }: LoopFixtures) => {
    const adminEmail = uniqueEmail("northfield.edu.ar", "e2e-msg-admin");
    await seedAdminEmail(adminEmail);
    const admin = await registerAdmin(api, adminEmail);
    // El comprador necesita créditos para ofertar.
    await creditUser(api, admin.token, userBId, 1000);

    const media = await uploadImage(api, userAToken);
    const { listing } = await createListing(api, userAToken, {
      title: `E2E Notif ${stamp}`,
      description: "Publicación para testear notificaciones",
      price: 500,
      categoryId,
      productStatus: "good",
      mediaIds: [media.id],
    });
    listingId = listing.id;

    await makeOffer(api, userBToken, listingId, 300);

    const dbNotifications = await getNotificationsForUser(userAId);
    expect(dbNotifications.some((n) => n.payload?.type === "new_offer")).toBe(true);

    const apiNotifications = await getNotifications(api, userAToken);
    expect(
      apiNotifications.notifications.some((n) => n.payload?.type === "new_offer"),
    ).toBe(true);
  });

  test("aceptar la oferta genera notificación para el comprador", async ({
    api,
  }: LoopFixtures) => {
    // La oferta es parcial (300/500): aceptarla sin trades daría TOTAL_PRICE_EXCEEDED.
    // Completo el total ofertando el precio completo sobre un listing nuevo del mismo vendedor
    // y propago el flujo hasta accepted para verificar la notificación.
    const [duplicate] = await getListingById(listingId);
    expect(duplicate).toBeDefined();

    const media = await uploadImage(api, userAToken);
    const { listing } = await createListing(api, userAToken, {
      title: `E2E Notif Accept ${stamp}`,
      description: "Segunda publicación para aceptación",
      price: 500,
      categoryId,
      productStatus: "good",
      mediaIds: [media.id],
    });

    await makeOffer(api, userBToken, listing.id, 500);
    await acceptOffer(api, userAToken, listing.id);

    const [dbListing] = await getListingById(listing.id);
    expect(dbListing.listing_status).toBe("accepted");

    const buyerNotifications = await getNotificationsForUser(userBId);
    expect(buyerNotifications.some((n) => n.payload?.type === "offer_accepted")).toBe(true);

    const apiNotif = await getNotifications(api, userBToken);
    expect(apiNotif.notifications.some((n) => n.payload?.type === "offer_accepted")).toBe(true);
  });

  test("marcar todas las notificaciones como leídas", async ({ api }: LoopFixtures) => {
    const { markNotificationsRead } = await import("../helpers/api");
    await markNotificationsRead(api, userBToken);

    const rows = await getNotificationsForUser(userBId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((n) => n.is_read)).toBe(true);
  });
});