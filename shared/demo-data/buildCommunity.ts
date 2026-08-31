/**
 * Constructor de comunidades del dataset demo.
 *
 * Un blueprint describe la comunidad en términos legibles — "Ana vende el buzo gris, Sofía le
 * pregunta por él" — y este módulo lo expande a entidades con IDs, fechas y referencias cruzadas
 * resueltas. Toda referencia se hace por *clave*, nunca por índice de array: si una clave no
 * existe, el build revienta acá y no genera datos huérfanos que aparecerían como una pantalla rota
 * tres pasos más adelante.
 */
import { CATEGORY_STATS, demoCategoryByName, demoMissionByKey } from "./catalog";
import { demoId } from "./ids";
import type {
  DemoCommunity,
  DemoListing,
  DemoMedia,
  DemoMessage,
  DemoNotification,
  DemoAdmin,
  DemoDeletionRequest,
  DemoSchool,
  DemoStats,
  DemoUser,
  DemoUserMission,
  DemoLoopNotificationType,
  DemoWish,
  HoursAgo,
} from "./types";

export interface MemberBlueprint {
  /** Clave local a la comunidad. Es también la parte local del email: `ana` → `ana@demo.edu`. */
  key: string;
  firstName: string;
  lastName: string;
  phone?: string;
  credits: number;
  /** Nombres de colegios de esta misma comunidad. */
  schools: string[];
  avatar?: boolean;
}

export interface ListingBlueprint {
  key: string;
  seller: string;
  buyer?: string;
  title: string;
  description: string;
  category: string;
  price: number;
  offeredCredits?: number;
  listingStatus: ListingStatus;
  productStatus: ProductStatus;
  agoHours: HoursAgo;
  images: string[];
}

export interface MissionBlueprint {
  member: string;
  /** Clave de plantilla de `DEMO_MISSION_TEMPLATES`. */
  mission: string;
  completed: boolean;
  completedAgoHours?: HoursAgo;
  progress: { total: number; current: number };
}

export interface MessageBlueprint {
  key: string;
  from: string;
  to: string;
  text: string;
  listing?: string;
  agoHours: HoursAgo;
  isRead: boolean;
}

export type NotificationBlueprintPayload =
  | { kind: "mission"; mission: string }
  | {
      kind: "loop";
      listing: string;
      buyer: string;
      toListingStatus: ListingStatus;
      toOfferedCredits?: number;
      type: DemoLoopNotificationType;
    }
  | { kind: "donation"; donor: string; amount: number; message?: string }
  | { kind: "admin"; action: AdminActions; message: string; target?: string; amount?: number };

export interface NotificationBlueprint {
  key: string;
  member: string;
  agoHours: HoursAgo;
  readAgoHours?: HoursAgo;
  payload: NotificationBlueprintPayload;
}

export interface WishBlueprint {
  member: string;
  category: string;
  comment?: string;
}

export interface AdminBlueprint {
  email: string;
  fullName: string;
}

export interface DeletionRequestBlueprint {
  /** Miembro de esta comunidad que pidió que le borren la cuenta. */
  member: string;
  agoHours: HoursAgo;
}

export interface CommunityBlueprint {
  slug: string;
  name: string;
  /** El primero manda: es el dominio con el que se arman los emails de los usuarios. */
  emailDomains: string[];
  colors: CommunityThemeColors;
  schools: string[];
  members: MemberBlueprint[];
  listings: ListingBlueprint[];
  missions: MissionBlueprint[];
  messages: MessageBlueprint[];
  notifications: NotificationBlueprint[];
  wishes: WishBlueprint[];
  /** Admin de comunidad del panel. Solo ve y administra esta comunidad. */
  admin: AdminBlueprint;
  deletionRequests?: DeletionRequestBlueprint[];
  /** Miembro con el que entra el modo demo. */
  showcase: string;
  /** Loops completados de la comunidad. Alimenta las estadísticas de impacto de la portada. */
  completedLoops: number;
}

/**
 * Contraseña de todas las cuentas del dataset. Es una constante pública a propósito: está
 * documentada en `DEMO.md` y el dataset entero solo se siembra en entornos desechables.
 */
export const DEMO_PASSWORD = "Demo1234!";

const NOTIFICATION_TYPES: Record<NotificationBlueprintPayload["kind"], NotificationType> = {
  mission: "mission",
  loop: "loop",
  donation: "donation",
  admin: "admin",
};

const scaleStats = (times: number): DemoStats => ({
  kgWaste: Number((CATEGORY_STATS.kgWaste * times).toFixed(2)),
  kgCo2: Number((CATEGORY_STATS.kgCo2 * times).toFixed(2)),
  lH2o: Number((CATEGORY_STATS.lH2o * times).toFixed(2)),
});

export const buildDemoCommunity = (blueprint: CommunityBlueprint): DemoCommunity => {
  const { slug } = blueprint;
  const id = (kind: string, key: string): UUID => demoId(slug, kind, key);

  const media = (seed: string, size = "800/600"): DemoMedia => ({
    id: id("media", seed),
    url: `https://picsum.photos/seed/${seed}/${size}`,
    mime: "image/jpeg",
    mediaType: "image",
  });

  const communityId = id("community", slug);

  const domain = blueprint.emailDomains[0];
  if (!domain) throw new Error(`La comunidad demo "${slug}" no declara ningún dominio de email`);

  // ── Colegios ──────────────────────────────────────────────────────────────────────────────
  const schools: DemoSchool[] = blueprint.schools.map((name, index) => ({
    id: id("school", name),
    communityId,
    name,
    media: media(`${slug}-school-${index + 1}`, "600/600"),
  }));

  const schoolByName = (name: string): DemoSchool => {
    const found = schools.find((school) => school.name === name);
    if (!found) throw new Error(`Colegio inexistente en la comunidad "${slug}": ${name}`);
    return found;
  };

  // ── Usuarios ──────────────────────────────────────────────────────────────────────────────
  // Las estadísticas de cada usuario derivan de sus loops cerrados (`received`), así el número que
  // ve el usuario en su perfil se corresponde con lo que ve en su historial.
  const receivedByMember = new Map<string, number>();
  for (const listing of blueprint.listings) {
    if (listing.listingStatus !== "received") continue;
    for (const member of [listing.seller, listing.buyer]) {
      if (member) receivedByMember.set(member, (receivedByMember.get(member) ?? 0) + 1);
    }
  }

  const users: DemoUser[] = blueprint.members.map((member) => ({
    id: id("user", member.key),
    communityId,
    email: `${member.key}@${domain}`,
    password: DEMO_PASSWORD,
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone ?? null,
    creditsBalance: member.credits,
    creditsLocked: 0,
    schoolIds: member.schools.map((name) => schoolByName(name).id),
    avatar: member.avatar ? media(`${slug}-avatar-${member.key}`, "300/300") : null,
    stats: scaleStats(receivedByMember.get(member.key) ?? 0),
  }));

  const memberId = (key: string): UUID => {
    const index = blueprint.members.findIndex((member) => member.key === key);
    const user = users[index];
    if (!user) throw new Error(`Miembro inexistente en la comunidad "${slug}": ${key}`);
    return user.id;
  };

  // ── Publicaciones ─────────────────────────────────────────────────────────────────────────
  const listingKeys = new Set(blueprint.listings.map((listing) => listing.key));
  const listingId = (key: string): UUID => {
    if (!listingKeys.has(key)) {
      throw new Error(`Publicación inexistente en la comunidad "${slug}": ${key}`);
    }
    return id("listing", key);
  };

  const listings: DemoListing[] = blueprint.listings.map((listing) => ({
    id: id("listing", listing.key),
    communityId,
    sellerId: memberId(listing.seller),
    buyerId: listing.buyer ? memberId(listing.buyer) : null,
    title: listing.title,
    description: listing.description,
    categoryId: demoCategoryByName(listing.category).id,
    priceCredits: listing.price,
    offeredCredits: listing.offeredCredits ?? null,
    listingStatus: listing.listingStatus,
    productStatus: listing.productStatus,
    disabled: false,
    createdHoursAgo: listing.agoHours,
    media: listing.images.map((seed) => media(seed)),
  }));

  // ── Misiones ──────────────────────────────────────────────────────────────────────────────
  const userMissionId = (member: string, mission: string): UUID =>
    id("user-mission", `${member}/${mission}`);

  const userMissions: DemoUserMission[] = blueprint.missions.map((mission) => ({
    id: userMissionId(mission.member, mission.mission),
    communityId,
    userId: memberId(mission.member),
    missionTemplateId: demoMissionByKey(mission.mission).id,
    completed: mission.completed,
    completedHoursAgo: mission.completedAgoHours ?? null,
    progress: { ...mission.progress },
  }));

  // ── Mensajes ──────────────────────────────────────────────────────────────────────────────
  const messages: DemoMessage[] = blueprint.messages.map((message) => ({
    id: id("message", message.key),
    communityId,
    senderId: memberId(message.from),
    recipientId: memberId(message.to),
    text: message.text,
    attachedListingId: message.listing ? listingId(message.listing) : null,
    isRead: message.isRead,
    createdHoursAgo: message.agoHours,
  }));

  // ── Notificaciones ────────────────────────────────────────────────────────────────────────
  const notifications: DemoNotification[] = blueprint.notifications.map((notification) => {
    const { payload } = notification;
    const resolved: DemoNotification["payload"] =
      payload.kind === "mission"
        ? { kind: "mission", userMissionId: userMissionId(notification.member, payload.mission) }
        : payload.kind === "loop"
          ? {
              kind: "loop",
              listingId: listingId(payload.listing),
              buyerId: memberId(payload.buyer),
              toListingStatus: payload.toListingStatus,
              toOfferedCredits: payload.toOfferedCredits ?? null,
              type: payload.type,
            }
          : payload.kind === "donation"
            ? {
                kind: "donation",
                donorUserId: memberId(payload.donor),
                amount: payload.amount,
                message: payload.message ?? null,
              }
            : {
                kind: "admin",
                action: payload.action,
                message: payload.message,
                target: payload.target ?? null,
                amount: payload.amount ?? null,
                referenceId: null,
              };

    return {
      id: id("notification", notification.key),
      communityId,
      userId: memberId(notification.member),
      type: NOTIFICATION_TYPES[payload.kind],
      isRead: notification.readAgoHours !== undefined,
      createdHoursAgo: notification.agoHours,
      readHoursAgo: notification.readAgoHours ?? null,
      payload: resolved,
    };
  });

  // ── Deseos ────────────────────────────────────────────────────────────────────────────────
  const wishes: DemoWish[] = blueprint.wishes.map((wish) => ({
    id: id("wish", `${wish.member}/${wish.category}`),
    communityId,
    userId: memberId(wish.member),
    categoryId: demoCategoryByName(wish.category).id,
    comment: wish.comment ?? null,
  }));

  // ── Panel de administración ───────────────────────────────────────────────────────────────
  const admin: DemoAdmin = {
    id: id("admin", blueprint.admin.email),
    email: blueprint.admin.email,
    password: DEMO_PASSWORD,
    fullName: blueprint.admin.fullName,
    role: "community_admin",
    communityId,
  };

  const deletionRequests: DemoDeletionRequest[] = (blueprint.deletionRequests ?? []).map(
    (request) => {
      const user = users.find((candidate) => candidate.id === memberId(request.member));
      if (!user)
        throw new Error(`Solicitud de borrado de un miembro inexistente: ${request.member}`);
      return {
        id: id("deletion-request", request.member),
        communityId,
        userId: user.id,
        email: user.email,
        createdHoursAgo: request.agoHours,
      };
    },
  );

  return {
    id: communityId,
    slug,
    name: blueprint.name,
    emailDomains: [...blueprint.emailDomains],
    theme: { colors: { ...blueprint.colors } },
    media: media(`${slug}-community`, "600/600"),
    showcaseUserId: memberId(blueprint.showcase),
    schools,
    users,
    listings,
    userMissions,
    messages,
    notifications,
    wishes,
    admin,
    deletionRequests,
    globalStats: scaleStats(blueprint.completedLoops),
  };
};
