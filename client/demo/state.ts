import { createSeed, type DemoDb } from "./db/seed";
import type {
  ListingRecord,
  MessageRecord,
  NotificationRecord,
  UserMissionRecord,
  WishRecord,
} from "./db/content";
import { userIdFromToken } from "./ids";

let demoDb: DemoDb = createSeed();

/** Reinicia el estado demo a sus valores iniciales (para re-entrar a la demo desde debug). */
export const resetDemoDb = () => {
  demoDb = createSeed();
};

export const getDemoDb = () => demoDb;

export const userById = (id: UUID | null | undefined) =>
  id ? demoDb.users.find((u) => u.id === id) ?? null : null;

/** Usuario de la sesión a partir del Bearer token. `null` = no logueado. */
export const currentUserFromToken = (token: string | null): PrivateUser | null => {
  const id = userIdFromToken(token);
  return userById(id);
};

export const toPublicUser = (user: PrivateUser | null): PublicUser | null => {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileMediaId: user.profileMediaId,
    communityId: user.communityId,
    stats: { ...user.stats },
    profileMedia: user.profileMedia,
    schools: user.schools,
  };
};

export const toUserBase = (user: PrivateUser): UserBase => ({
  id: user.id,
  email: user.email,
  phone: user.phone,
  firstName: user.firstName,
  lastName: user.lastName,
  profileMediaId: user.profileMediaId,
  communityId: user.communityId,
  credits: { ...user.credits },
  stats: { ...user.stats },
  // El servidor real los devuelve nulos para el propio usuario.
  notificationToken: null,
  password: null,
  googleId: null,
});

/** Árbol de categorías: raíces con hijos, cada una con su lista de padres. */
const buildCategory = (id: UUID): Category => {
  const base = demoDb.categories.find((c) => c.id === id);
  if (!base) throw new Error(`Categoría demo inexistente: ${id}`);
  const children = demoDb.categories
    .filter((c) => c.parentId === id)
    .map((c) => buildCategory(c.id));
  const parents: CategoryBase[] = [];
  let current = base.parentId;
  while (current) {
    const parent = demoDb.categories.find((c) => c.id === current);
    if (!parent) break;
    parents.push(parent);
    current = parent.parentId;
  }
  return { ...base, parents, children };
};

export const categoryTree = (): Category[] =>
  demoDb.categories.filter((c) => !c.parentId).map((c) => buildCategory(c.id));

export const categoryById = (id: UUID): Category => buildCategory(id);

/** Hace el "join" que hace el servidor: listing → seller, categoría y buyer hidratados. */
export const toListing = (record: ListingRecord): Listing => ({
  id: record.id,
  sellerId: record.sellerId,
  title: record.title,
  description: record.description,
  categoryId: record.categoryId,
  price: record.price,
  listingStatus: record.listingStatus,
  productStatus: record.productStatus,
  disabled: record.disabled,
  buyerId: record.buyerId,
  offeredCredits: record.offeredCredits,
  createdAt: record.createdAt,
  seller: toPublicUser(userById(record.sellerId))!,
  media: record.media,
  category: buildCategory(record.categoryId),
  buyer: toPublicUser(userById(record.buyerId)),
});

export const listingById = (id: UUID): ListingRecord | null =>
  demoDb.listings.find((l) => l.id === id && !l.disabled) ?? null;

/** Stub para referencias a listings que ya no existen (borrados en la sesión). */
const deletedListingStub = (listingId: UUID, title = "Publicación eliminada"): ListingRecord => ({
  id: listingId,
  sellerId: "00000000-0000-4000-8000-000000000000",
  title,
  description: null,
  categoryId: demoDb.categories[0].id,
  price: 0,
  listingStatus: "received",
  productStatus: "good",
  disabled: true,
  buyerId: null,
  offeredCredits: null,
  createdAt: new Date(0).toISOString(),
  media: [],
});

export const toMessage = (record: MessageRecord): Message => {
  const { isRead: _isRead, ...base } = record;
  return {
    ...base,
    createdAt: base.createdAt,
    attachedListing: base.attachedListingId
      ? toListing(listingById(base.attachedListingId) ?? deletedListingStub(base.attachedListingId))
      : null,
  };
};

export const toUserMission = (record: UserMissionRecord): UserMission => {
  const template = demoDb.missionTemplates.find((m) => m.id === record.missionTemplateId);
  if (!template) throw new Error(`Misión demo inexistente: ${record.missionTemplateId}`);
  return {
    id: record.id,
    userId: record.userId,
    missionTemplateId: record.missionTemplateId,
    completed: record.completed,
    completedAt: record.completedAt,
    progress: { ...record.progress },
    missionTemplate: { ...template },
  };
};

export const toWish = (record: WishRecord): UserWish => ({
  id: record.id,
  userId: record.userId,
  categoryId: record.categoryId,
  comment: record.comment,
  category: buildCategory(record.categoryId),
});

export const toNotification = (record: NotificationRecord): AppNotification => {
  let payload: AppNotification["payload"];
  switch (record.type) {
    case "mission": {
      const base = record.payload as MissionNotificationPayloadBase;
      const mission = demoDb.userMissions.find((m) => m.id === base.userMissionId);
      payload = { ...base, userMission: toUserMission(mission!) };
      break;
    }
    case "loop": {
      const base = record.payload as LoopNotificationPayloadBase;
      const listing = listingById(base.listingId);
      payload = {
        ...base,
        listing: toListing(listing ?? deletedListingStub(base.listingId)),
        buyer: toPublicUser(userById(base.buyerId)),
      };
      break;
    }
    case "donation": {
      const base = record.payload as DonationNotificationPayloadBase;
      payload = { ...base, donorUser: toPublicUser(userById(base.donorUserId))! };
      break;
    }
    case "admin": {
      const base = record.payload as AdminNotificationPayloadBase;
      payload = { ...base, reference: null };
      break;
    }
  }
  return {
    id: record.id,
    userId: record.userId,
    type: record.type,
    createdAt: record.createdAt,
    isRead: record.isRead,
    readAt: record.readAt,
    payload,
  };
};

export const paginate = <T>(items: T[], page: number, pageSize = 10) => {
  const currentPage = Math.max(1, page || 1);
  const totalRecords = items.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pagination: {
      totalRecords,
      currentPage,
      pageSize,
      totalPages,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      previousPage: currentPage > 1 ? currentPage - 1 : null,
    },
  };
};
