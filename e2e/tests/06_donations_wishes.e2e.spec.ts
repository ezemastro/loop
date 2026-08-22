import { test, expect, type LoopFixtures } from "../fixtures";
import {
  ApiError,
  authHeaders,
  creditUser,
  createWish,
  donate,
  getMe,
  getWishes,
  registerAdmin,
  registerUser,
} from "../helpers/api";
import {
  getCategoryByName,
  getCommunityBySlug,
  getNotificationsForUser,
  getWalletTransactionsForUser,
  getUserByEmail,
  seedAdminEmail,
  seedCommunity,
  seedSchool,
} from "../helpers/db";

/**
 * Créditos, donaciones y deseos:
 * - La acreditación del admin SÍ registra wallet_transactions (type=admin) y mueve el saldo.
 * - Las donaciones mueven saldos y crean notificación de recepción, pero NO registran
 *   wallet_transactions (verificado en models/users.ts donate: solo saldos + notificación).
 * - Los deseos son CRUD completo contra la base.
 */

let communityId: string;
let categoryId: string;
let donorId: string;
let donorEmail: string;
let donorToken: string;
let recipientId: string;
let recipientEmail: string;
let recipientToken: string;
let adminToken: string;

const expectApiError = async (
  promise: Promise<unknown>,
  status: number,
  code: string,
  messagePart?: string,
): Promise<ApiError> => {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    const apiError = err as ApiError;
    expect(apiError.status).toBe(status);
    expect(apiError.code).toBe(code);
    if (messagePart) expect(apiError.message).toContain(messagePart);
    return apiError;
  }
  throw new Error(`Expected request to fail with ${status} "${code}"`);
};

const balanceOf = async (email: string) => {
  const [user] = await getUserByEmail(email);
  return {
    balance: Number(user.credits_balance),
    locked: Number(user.credits_locked),
  };
};

test.describe.serial("Créditos, donaciones y deseos", () => {
  test.beforeAll(async ({ api, uniqueEmail }: LoopFixtures) => {
    const [community] = await getCommunityBySlug("red-itinere");
    communityId = community.id;
    const schoolId = await seedSchool(communityId, "E2E Escuela Creditos");
    const [category] = await getCategoryByName("Lápices y lapiceras");
    categoryId = category.id;

    const donor = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-donor"), [
      schoolId,
    ]);
    donorId = donor.user.id;
    donorEmail = donor.user.email;
    donorToken = donor.token;

    const recipient = await registerUser(api, uniqueEmail("northfield.edu.ar", "e2e-rx"), [
      schoolId,
    ]);
    recipientId = recipient.user.id;
    recipientEmail = recipient.user.email;
    recipientToken = recipient.token;

    const adminEmail = uniqueEmail("northfield.edu.ar", "e2e-cred-admin");
    await seedAdminEmail(adminEmail);
    const admin = await registerAdmin(api, adminEmail);
    adminToken = admin.token;
  });

  test("la acreditación del admin registra wallet_transaction y saldo", async ({
    api,
  }: LoopFixtures) => {
    await creditUser(api, adminToken, donorId, 5000);

    const me = await getMe(api, donorToken);
    expect(me.user.credits.balance).toBe(5000);
    expect(me.user.credits.locked).toBe(0);

    const txs = await getWalletTransactionsForUser(donorId);
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe("admin");
    expect(txs[0].positive).toBe(true);
    expect(Number(txs[0].amount)).toBe(5000);
  });

  test("la donación mueve saldos y notifica, pero no crea wallet_transactions", async ({
    api,
  }: LoopFixtures) => {
    await donate(api, donorToken, recipientId, 2000);

    expect(await balanceOf(donorEmail)).toEqual({ balance: 3000, locked: 0 });
    expect(await balanceOf(recipientEmail)).toEqual({ balance: 2000, locked: 0 });

    // El flujo de donación no audita wallet_transactions: solo saldos + notificación.
    expect(await getWalletTransactionsForUser(donorId)).toHaveLength(1);
    expect(await getWalletTransactionsForUser(recipientId)).toHaveLength(0);

    const recipientNotifs = await getNotificationsForUser(recipientId);
    expect(recipientNotifs.some((n) => n.type === "donation")).toBe(true);
  });

  test("la donación sin saldo suficiente se rechaza sin tocar la base", async ({
    api,
  }: LoopFixtures) => {
    // El modelo lanza InvalidInputError(INSUFFICIENT_CREDITS) SIN código explícito: el error
    // middleware usa el fallback "INVALID_INPUT" pero el mensaje es el de créditos insuficientes.
    const error = await expectApiError(
      donate(api, recipientToken, donorId, 3000),
      400,
      "INVALID_INPUT",
      "Créditos insuficientes",
    );
    void error;

    expect(await balanceOf(donorEmail)).toEqual({ balance: 3000, locked: 0 });
    expect(await balanceOf(recipientEmail)).toEqual({ balance: 2000, locked: 0 });
    expect(await getWalletTransactionsForUser(donorId)).toHaveLength(1);
  });

  test("la donación cruzada de comunidad se rechaza", async ({
    api,
    uniqueEmail,
  }: LoopFixtures) => {
    // Comunidad B real (dominio propio y único por corrida); el outsider se registra con ese dominio.
    const bDomain = `e2e-x-${Date.now()}-${Math.floor(Math.random() * 1e6)}.test`;
    const communityB = await seedCommunity({
      slug: `e2e-x-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: "E2E Comunidad Vecina 06",
      domains: [bDomain],
    });
    const outsider = await registerUser(api, uniqueEmail(bDomain, "e2e-outsider"), [
      communityB.schoolId,
    ]);
    expect(outsider.user.communityId).toBe(communityB.communityId);

    // El receptor no existe en la comunidad del donante → el modelo corta con 400 INVALID_INPUT
    // (InvalidInputError sin código explícito: code = "INVALID_INPUT").
    await expectApiError(donate(api, donorToken, outsider.user.id, 100), 400, "INVALID_INPUT");

    // El saldo del donante no cambió y el outsider sigue en cero.
    expect(await balanceOf(donorEmail)).toEqual({ balance: 3000, locked: 0 });
    expect(await balanceOf(outsider.user.email)).toEqual({ balance: 0, locked: 0 });
  });

  test("wishlist: crear, listar, modificar y eliminar", async ({ api }: LoopFixtures) => {
    const { userWish } = await createWish(api, donorToken, categoryId, "Quiero lápices 2B");
    expect(userWish.id).toBeDefined();

    const wishes = await getWishes(api, donorToken);
    expect(wishes.userWishes).toHaveLength(1);
    expect(wishes.userWishes[0].categoryId).toBe(categoryId);
    expect(wishes.userWishes[0].comment).toBe("Quiero lápices 2B");

    const updateRes = await api.put(`/me/wishes/${userWish.id}`, {
      headers: authHeaders(donorToken),
      data: { comment: "2B y de colores" },
    });
    expect(updateRes.status()).toBe(204);

    const afterUpdate = await getWishes(api, donorToken);
    expect(afterUpdate.userWishes).toHaveLength(1);
    expect(afterUpdate.userWishes[0].comment).toBe("2B y de colores");

    const delRes = await api.delete(`/me/wishes/${categoryId}`, {
      headers: authHeaders(donorToken),
    });
    expect(delRes.status()).toBe(204);

    const afterDelete = await getWishes(api, donorToken);
    expect(afterDelete.userWishes).toHaveLength(0);
  });

  test("los deseos son por usuario: el ajeno no aparece", async ({ api }: LoopFixtures) => {
    await createWish(api, recipientToken, categoryId, "Deseo del receptor");

    const donorWishes = await getWishes(api, donorToken);
    expect(donorWishes.userWishes).toHaveLength(0);

    const recipientWishes = await getWishes(api, recipientToken);
    expect(recipientWishes.userWishes).toHaveLength(1);
    expect(recipientWishes.userWishes[0].categoryId).toBe(categoryId);
  });
});