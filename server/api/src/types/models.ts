import type { AuthModel as AuthModelType } from "../models/auth";
import type { SelfModel as SelfModelType } from "../models/self";

export interface AuthRegisterPayload {
  firstName: string;
  lastName: string;
  password: string;
  schoolIds: string[];
  email: string;
  /** Presente solo cuando alguien se registra con un correo fuera de los dominios de la comunidad. */
  invitationToken?: string | undefined;
}
export interface AuthLoginPayload {
  email: string;
  password: string;
}

export type AuthModel = AuthModelType;

export type SelfModel = SelfModelType;

// ─── Payloads scopeados por comunidad ───────────────────────────────────────
//
// `communityId` viaja en el payload —y no se saca de un helper— porque el modelo es quien abre la
// conexión: es el valor con el que se llama a `inCommunity(...)`. El controller lo toma de
// `req.session!.communityId!`. Nunca se puede actualizar: la comunidad de una cuenta la fija el
// dominio de su correo en el registro.

export interface CommunityScopedPayload {
  communityId: UUID;
}

/** Acción sobre el propio usuario de la sesión. */
export interface UserScopedPayload extends CommunityScopedPayload {
  userId: UUID;
}

// ── Self ──

export type GetSelfPayload = UserScopedPayload;

/**
 * `email` no está a propósito: el dominio del correo es lo que determina la comunidad, así que
 * dejar cambiarlo por `PATCH /me` dejaría email y comunidad en desacuerdo para siempre.
 */
export interface UpdateSelfPayload extends UserScopedPayload {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  profileMediaId?: string | null;
  password?: string;
  schoolIds?: string[];
}

export interface GetSelfListingsPayload extends UserScopedPayload {
  sellerId?: string;
  buyerId?: string;
  searchTerm?: string;
  categoryId?: string;
  productStatus?: ProductStatus;
  listingStatus?: ListingStatus;
  page?: number;
  sort?: SortOptions;
  order?: "asc" | "desc";
}

/** Listados paginados del propio usuario (notificaciones, chats). */
export interface GetSelfPaginatedPayload extends UserScopedPayload {
  page: number | undefined;
}

export interface UpdateNotificationTokenPayload extends UserScopedPayload {
  notificationToken: string | null;
}

export interface CreateSelfWishPayload extends UserScopedPayload {
  categoryId: UUID;
  comment?: string | null;
}

export interface DeleteSelfWishPayload extends UserScopedPayload {
  categoryId: UUID;
}

export interface ModifySelfWishPayload extends UserScopedPayload {
  wishId: UUID;
  comment?: string | null;
  categoryId?: UUID;
}

export interface ModifyUserPasswordPayload extends UserScopedPayload {
  newPassword: string;
  oldPassword: string;
}

export type DeleteSelfPayload = UserScopedPayload;

// ── Users ──

export interface GetUsersPayload extends CommunityScopedPayload {
  page?: number;
  sort?: SortOptions;
  order?: "asc" | "desc";
  searchTerm?: string;
  schoolId?: UUID;
  userId?: UUID;
}

export interface GetUserByIdPayload extends CommunityScopedPayload {
  userId: UUID;
}

export interface DonatePayload extends CommunityScopedPayload {
  fromUserId: UUID;
  toUserId: UUID;
  amount: number;
}

// ── Schools ──

/**
 * `communityId` es obligatorio aunque `GET /schools` sea público: lo resuelve el controller
 * (sesión → query `communityId` → dominio) antes de llamar al modelo.
 */
export interface GetSchoolsPayload extends CommunityScopedPayload {
  page?: number;
  sort?: SortOptions;
  order?: "asc" | "desc";
  searchTerm?: string;
}

export interface GetSchoolByIdPayload extends CommunityScopedPayload {
  schoolId: UUID;
}

// ── Stats ──

export type GetGlobalStatsPayload = CommunityScopedPayload;

// ── Categories ──

/**
 * El catálogo de categorías se comparte entre comunidades a propósito, así que sus queries no
 * filtran. `communityId` solo elige con qué conexión se lee: `null` cuando el request no tiene
 * sesión (pantalla de registro).
 */
export interface GetCategoriesPayload {
  communityId: UUID | null;
}

// ── Listings ──

export type GetListingsPayload = NonNullable<GetListingsRequest["query"]> & CommunityScopedPayload;

export interface CreateListingPayload extends UserScopedPayload {
  title: string;
  description: string | null;
  price: number;
  categoryId: UUID;
  productStatus: ProductStatus;
  mediaIds: UUID[];
}

export interface UpdateListingPayload extends UserScopedPayload {
  listingId: UUID;
  title?: string;
  description?: string | null;
  price?: number;
  categoryId?: UUID;
  productStatus?: ProductStatus;
  mediaIds?: UUID[];
}

/** Acción del usuario de la sesión sobre una publicación (borrar, ofertar, aceptar, recibir…). */
export interface ListingActionPayload extends UserScopedPayload {
  listingId: UUID;
}

/** No lleva `userId`: cualquiera de la comunidad puede ver una publicación. */
export interface GetListingByIdPayload extends CommunityScopedPayload {
  listingId: UUID;
}

export interface NewOfferPayload extends ListingActionPayload {
  offeredCredits: number;
}

export interface AcceptOfferPayload extends ListingActionPayload {
  tradingListingIds: UUID[];
}

// ── Messages ──

export interface GetMessagesFromUserPayload extends CommunityScopedPayload {
  senderId: UUID;
  recipientId: UUID;
  page: number | undefined;
}

export interface SendMessagePayload extends CommunityScopedPayload {
  senderId: UUID;
  recipientId: UUID;
  text: string;
  attachedListingId?: UUID | null;
}

export interface MarkMessagesAsReadPayload extends UserScopedPayload {
  senderId: UUID;
}

// ── Upload ──

export interface SaveFilePayload {
  filename: string;
  mimetype: string;
  userId: UUID;
  isAdmin: boolean;
  /** `null` para las subidas del panel de admin: son media compartida (logos), sin comunidad. */
  communityId: UUID | null;
}
