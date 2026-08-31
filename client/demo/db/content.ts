/**
 * Contenido del modo demo: publicaciones, misiones, mensajes, notificaciones y deseos.
 *
 * Los `*Record` son las formas *internas* de la base en memoria — llevan campos que la API real
 * guarda pero no expone (`isRead` de un mensaje, por ejemplo). `state.ts` los proyecta a las formas
 * públicas cuando un handler responde.
 */
import { SHARED_COMMUNITY, SHARED_MISSIONS, isoHoursAgo, toMedia } from "./dataset";

export interface ListingRecord {
  id: UUID;
  sellerId: UUID;
  title: string;
  description: string | null;
  categoryId: UUID;
  price: number;
  listingStatus: ListingStatus;
  productStatus: ProductStatus;
  disabled: boolean;
  buyerId: UUID | null;
  offeredCredits: number | null;
  createdAt: string;
  media: Media[];
}

export const DEMO_LISTINGS: ListingRecord[] = SHARED_COMMUNITY.listings.map((listing) => ({
  id: listing.id,
  sellerId: listing.sellerId,
  title: listing.title,
  description: listing.description,
  categoryId: listing.categoryId,
  price: listing.priceCredits,
  listingStatus: listing.listingStatus,
  productStatus: listing.productStatus,
  disabled: listing.disabled,
  buyerId: listing.buyerId,
  offeredCredits: listing.offeredCredits,
  createdAt: isoHoursAgo(listing.createdHoursAgo),
  media: listing.media.map(toMedia),
}));

export interface MissionTemplateSeed extends MissionTemplate {
  id: UUID;
}

export const DEMO_MISSION_TEMPLATES: MissionTemplateSeed[] = SHARED_MISSIONS.map((mission) => ({
  id: mission.id,
  key: mission.key,
  title: mission.title,
  description: mission.description,
  rewardCredits: mission.rewardCredits,
  active: mission.active,
}));

export interface UserMissionRecord {
  id: UUID;
  userId: UUID;
  missionTemplateId: UUID;
  completed: boolean;
  completedAt: string | null;
  progress: { total: number; current: number };
}

export const DEMO_USER_MISSIONS: UserMissionRecord[] = SHARED_COMMUNITY.userMissions.map(
  (mission) => ({
    id: mission.id,
    userId: mission.userId,
    missionTemplateId: mission.missionTemplateId,
    completed: mission.completed,
    completedAt: mission.completedHoursAgo === null ? null : isoHoursAgo(mission.completedHoursAgo),
    progress: { ...mission.progress },
  }),
);

export interface MessageRecord {
  id: UUID;
  senderId: UUID;
  recipientId: UUID;
  text: string;
  attachedListingId?: UUID | null;
  createdAt: string;
  /** Interno: el tipo público `Message` no expone el estado de lectura. */
  isRead: boolean;
}

export const DEMO_MESSAGES: MessageRecord[] = SHARED_COMMUNITY.messages.map((message) => ({
  id: message.id,
  senderId: message.senderId,
  recipientId: message.recipientId,
  text: message.text,
  attachedListingId: message.attachedListingId,
  createdAt: isoHoursAgo(message.createdHoursAgo),
  isRead: message.isRead,
}));

export type NotificationSeedPayload =
  | MissionNotificationPayloadBase
  | LoopNotificationPayloadBase
  | DonationNotificationPayloadBase
  | AdminNotificationPayloadBase;

export interface NotificationRecord {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  createdAt: string;
  isRead: boolean;
  readAt: string | null;
  payload: NotificationSeedPayload;
}

export const DEMO_NOTIFICATIONS: NotificationRecord[] = SHARED_COMMUNITY.notifications.map(
  (notification) => {
    // `kind` solo discrimina la unión mientras se arma el dataset; la API nunca lo manda.
    const { kind: _kind, ...payload } = notification.payload;
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      createdAt: isoHoursAgo(notification.createdHoursAgo),
      isRead: notification.isRead,
      readAt: notification.readHoursAgo === null ? null : isoHoursAgo(notification.readHoursAgo),
      payload: payload as NotificationSeedPayload,
    };
  },
);

export interface WishRecord {
  id: UUID;
  userId: UUID;
  categoryId: UUID;
  comment: string | null;
}

export const DEMO_WISHES: WishRecord[] = SHARED_COMMUNITY.wishes.map((wish) => ({
  id: wish.id,
  userId: wish.userId,
  categoryId: wish.categoryId,
  comment: wish.comment,
}));

export const DEMO_GLOBAL_STATS: Stats = { ...SHARED_COMMUNITY.globalStats };
