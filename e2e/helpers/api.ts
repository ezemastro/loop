import type { APIRequestContext, APIResponse } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { ENV } from "./config";
import { seedExpiredVerificationToken, seedVerificationToken } from "./db";

/**
 * Helpers de API: envuelven los ENDPOINTS REALES del backend (los mismos que llama el cliente).
 * Un test E2E "near-frontend" simula con estas llamadas exactamente lo que el botón/formulario
 * haría en el cliente, y después verifica en la base que el efecto fue el correcto.
 */

export type ApiUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  credits: { balance: number; locked: number };
  communityId: string;
  schools: { id: string }[];
};

export type Listing = {
  id: string;
  sellerId: string;
  buyerId: string | null;
  listingStatus: string;
  price: number;
  offeredCredits: number | null;
  categoryId: string;
  title: string;
  media: { id: string }[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

/** Lanza ApiError si la respuesta no es 2xx; devuelve el body tipado. */
export const expectOk = async <T>(res: APIResponse): Promise<T> => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new ApiError(
      res.status(),
      (body as { errorCode?: string }).errorCode,
      (body as { error?: string }).error || `HTTP ${res.status()}`,
    );
  }
  return (body as { data: T }).data;
};

export const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

export const newUserPayload = (email: string, schoolIds: string[]) => ({
  email,
  password: "TestPass123!",
  firstName: "E2E",
  lastName: "Tester",
  schoolIds,
});

/**
 * Completa la verificación de email por el endpoint real (el mismo que abre el link del mail).
 *
 * Desde la migración 0012 (SEC-10) la base solo guarda el hash del token: ya no hay forma de leer
 * un cleartext existente. El harness invierte la dirección — genera un token conocido, escribe su
 * hash directo en la base con el pool dueño (`seedVerificationToken`, exento de RLS) y llama al
 * endpoint real con ese cleartext, igual que haría el usuario al clickear el link. Nunca se mockea
 * ni se saltea `GET /auth/verify-email`.
 */
export const verifyUserEmail = async (api: APIRequestContext, email: string) => {
  const token = randomBytes(32).toString("hex");
  await seedVerificationToken(email, token);
  const res = await api.get(`/auth/verify-email?token=${token}`);
  if (!res.ok()) {
    throw new ApiError(res.status(), "VERIFY_EMAIL_FAILED", `No se pudo verificar ${email}`);
  }
};

/**
 * Siembra un token ya vencido y confirma que `GET /auth/verify-email` lo rechaza — cubre
 * `email-verification-tokens: "An expired token is refused"`.
 */
export const verifyUserEmailExpired = async (api: APIRequestContext, email: string) => {
  const token = randomBytes(32).toString("hex");
  await seedExpiredVerificationToken(email, token);
  return api.get(`/auth/verify-email?token=${token}`);
};

/**
 * El registro ya no devuelve sesión (la cuenta nace sin verificar): este helper recorre el flujo
 * completo — registrar, verificar el mail, loguear — y devuelve lo mismo que antes, user + token.
 */
export const registerUser = async (api: APIRequestContext, email: string, schoolIds: string[]) => {
  await expectOk<{ message: string }>(
    await api.post("/auth/register", { data: newUserPayload(email, schoolIds) }),
  );
  await verifyUserEmail(api, email);
  return loginUser(api, email);
};

export const loginUser = async (api: APIRequestContext, email: string) =>
  expectOk<{ user: ApiUser; token: string }>(
    await api.post("/auth/login", { data: { email, password: "TestPass123!" } }),
  );

/**
 * Autoriza el email en admin_valid_emails (siembra) y registra el admin.
 * El token de admin viaja en la cookie `admin_token` (httpOnly), no en el body: lo extraemos
 * del set-cookie para mandarlo como header `Cookie` en las llamadas admin, igual que el navegador.
 */
export const registerAdmin = async (api: APIRequestContext, adminEmail: string) => {
  const res = await api.post("/admin/register", {
    data: { email: adminEmail, fullName: "E2E Admin", password: "TestPass123!" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new ApiError(
      res.status(),
      (body as { errorCode?: string }).errorCode,
      (body as { error?: string }).error || `HTTP ${res.status()}`,
    );
  }
  const cookie = (res.headers()["set-cookie"] || "")
    .split(";")
    .find((c) => c.trim().startsWith("admin_token="));
  const token = cookie ? cookie.trim().slice("admin_token=".length) : "";
  if (!token) throw new ApiError(res.status(), "NO_ADMIN_COOKIE", "Falta la cookie admin_token");
  return { admin: (body as { data: { admin: { id: string; email: string } } }).data.admin, token };
};

export const creditUser = async (
  api: APIRequestContext,
  adminToken: string,
  userId: string,
  amount: number,
) =>
  expectOk(
    await api.post(`/admin/users/${userId}/credits`, {
      headers: { Cookie: `admin_token=${adminToken}` },
      data: { amount, positive: true },
    }),
  );

export const getMe = async (api: APIRequestContext, token: string) =>
  expectOk<{ user: ApiUser }>(await api.get("/me", { headers: authHeaders(token) }));

/** Sube un PNG mínimo real por el endpoint de uploads (lo que hace el cliente al publicar). */
export const uploadImage = async (
  api: APIRequestContext,
  token: string,
): Promise<{ id: string; url: string }> => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  return expectOk<{ media: { id: string; url: string } }>(
    await api.post("/uploads", {
      headers: authHeaders(token),
      multipart: {
        file: { name: "e2e-image.png", mimeType: "image/png", buffer: png },
      },
    }),
  ).then((d) => d.media);
};

export const createListing = async (
  api: APIRequestContext,
  token: string,
  data: {
    title: string;
    description: string;
    price: number;
    categoryId: string;
    productStatus: string;
    mediaIds: string[];
  },
) =>
  expectOk<{ listing: Listing }>(
    await api.post("/listings", {
      headers: authHeaders(token),
      data,
    }),
  );

export const getListings = async (api: APIRequestContext, query: Record<string, string> = {}) =>
  expectOk<{ listings: Listing[] }>(
    await api.get("/listings", { params: new URLSearchParams(query).toString() }),
  );

export const getListing = async (api: APIRequestContext, listingId: string) =>
  expectOk<{ listing: Listing }>(await api.get(`/listings/${listingId}`));

export const makeOffer = async (
  api: APIRequestContext,
  token: string,
  listingId: string,
  price: number,
) =>
  expectOk<{ listing: Listing }>(
    await api.post(`/listings/${listingId}/offer`, {
      headers: authHeaders(token),
      data: { price },
    }),
  );

export const deleteOffer = async (api: APIRequestContext, token: string, listingId: string) =>
  expectOk(await api.delete(`/listings/${listingId}/offer`, { headers: authHeaders(token) }));

export const rejectOffer = async (api: APIRequestContext, token: string, listingId: string) =>
  expectOk(await api.post(`/listings/${listingId}/offer/reject`, { headers: authHeaders(token) }));

export const acceptOffer = async (
  api: APIRequestContext,
  token: string,
  listingId: string,
  tradingListingIds: string[] = [],
) =>
  expectOk(
    await api.post(`/listings/${listingId}/offer/accept`, {
      headers: authHeaders(token),
      data: { tradingListingIds },
    }),
  );

export const receiveListing = async (api: APIRequestContext, token: string, listingId: string) =>
  expectOk(await api.post(`/listings/${listingId}/receive`, { headers: authHeaders(token) }));

export const sendMessage = async (
  api: APIRequestContext,
  token: string,
  recipientId: string,
  text: string,
) =>
  expectOk(
    await api.post(`/messages/${recipientId}`, {
      headers: authHeaders(token),
      data: { text },
    }),
  );

export const markMessagesRead = async (
  api: APIRequestContext,
  token: string,
  otherUserId: string,
) => expectOk(await api.post(`/messages/${otherUserId}/read`, { headers: authHeaders(token) }));

export const getUnreadMessages = async (api: APIRequestContext, token: string) =>
  expectOk<{ unreadChatsCount: number }>(
    await api.get("/me/messages/unread", { headers: authHeaders(token) }),
  );

export const getNotifications = async (api: APIRequestContext, token: string) =>
  expectOk<{
    notifications: {
      id: string;
      type: string;
      isRead: boolean;
      payload: { type?: string } | null;
    }[];
  }>(await api.get("/me/notifications", { headers: authHeaders(token) }));

export const markNotificationsRead = async (api: APIRequestContext, token: string) =>
  expectOk(await api.post("/me/notifications/read-all", { headers: authHeaders(token) }));

export const donate = async (
  api: APIRequestContext,
  token: string,
  toUserId: string,
  amount: number,
) =>
  expectOk(
    await api.post(`/users/${toUserId}/donate`, {
      headers: authHeaders(token),
      data: { amount },
    }),
  );

export const createWish = async (
  api: APIRequestContext,
  token: string,
  categoryId: string,
  comment?: string,
) =>
  expectOk<{ userWish: { id: string } }>(
    await api.post("/me/wishes", {
      headers: authHeaders(token),
      data: { categoryId, comment: comment ?? null },
    }),
  );

export const getWishes = async (api: APIRequestContext, token: string) =>
  expectOk<{ userWishes: { id: string; categoryId: string; comment: string | null }[] }>(
    await api.get("/me/wishes", { headers: authHeaders(token) }),
  );

export const getCommunityByEmail = async (api: APIRequestContext, email: string) =>
  expectOk<{ community: { id: string; slug: string; name: string } }>(
    await api.get("/communities/resolve", { params: new URLSearchParams({ email }).toString() }),
  );

export const getSchools = async (api: APIRequestContext, communityId?: string) =>
  expectOk<{ schools: { id: string; name: string; communityId: string }[] }>(
    await api.get(
      "/schools",
      communityId ? { params: new URLSearchParams({ communityId }).toString() } : {},
    ),
  );

export { ENV };
