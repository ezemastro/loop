/**
 * Formas del dataset de demostración.
 *
 * Son deliberadamente *neutras*: no son filas de Postgres ni respuestas de la API, sino el dato
 * crudo del que ambos derivan. El seed del servidor las traduce a INSERTs; el modo demo del
 * cliente las hidrata a las formas que devuelve la API real.
 *
 * Regla de oro al agregar campos: si un campo solo tiene sentido para uno de los dos consumidores,
 * no va acá — va en el adaptador de ese lado.
 */

/** Antigüedad en horas respecto del momento en que se materializa el dataset. */
export type HoursAgo = number;

/**
 * Estadísticas de impacto. Es `Stats` con los tres campos obligatorios: en la app son nullables
 * porque la base puede no tenerlos, pero un dataset que se escribe entero siempre los tiene.
 */
export interface DemoStats {
  kgWaste: number;
  kgCo2: number;
  lH2o: number;
}

export interface DemoMedia {
  id: UUID;
  url: string;
  mime: string;
  mediaType: "image";
}

export interface DemoCategory {
  id: UUID;
  name: string;
  parentName: string | null;
  parentId: UUID | null;
  description: string | null;
  minPriceCredits: number | null;
  maxPriceCredits: number | null;
  icon: string | null;
  stats: DemoStats;
}

export interface DemoMissionTemplate {
  id: UUID;
  key: string;
  title: string;
  description: string | null;
  rewardCredits: number;
  active: boolean;
}

export interface DemoSchool {
  id: UUID;
  communityId: UUID;
  name: string;
  media: DemoMedia;
}

export interface DemoUser {
  id: UUID;
  communityId: UUID;
  email: string;
  /**
   * Contraseña **en texto plano**, a propósito: es el dato que se documenta en `DEMO.md` y el que
   * el seed hashea con bcrypt antes de escribirlo. Este dataset nunca debe sembrarse en una base
   * con usuarios reales.
   */
  password: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  creditsBalance: number;
  creditsLocked: number;
  schoolIds: UUID[];
  avatar: DemoMedia | null;
  stats: DemoStats;
}

export interface DemoListing {
  id: UUID;
  communityId: UUID;
  sellerId: UUID;
  buyerId: UUID | null;
  title: string;
  description: string | null;
  categoryId: UUID;
  priceCredits: number;
  offeredCredits: number | null;
  listingStatus: ListingStatus;
  productStatus: ProductStatus;
  disabled: boolean;
  createdHoursAgo: HoursAgo;
  media: DemoMedia[];
}

export interface DemoUserMission {
  id: UUID;
  communityId: UUID;
  userId: UUID;
  missionTemplateId: UUID;
  completed: boolean;
  completedHoursAgo: HoursAgo | null;
  progress: { total: number; current: number };
}

export interface DemoMessage {
  id: UUID;
  communityId: UUID;
  senderId: UUID;
  recipientId: UUID;
  text: string;
  attachedListingId: UUID | null;
  isRead: boolean;
  createdHoursAgo: HoursAgo;
}

/** Mismas variantes que `LoopNotificationPayloadBase["type"]` en `shared/types/app.d.ts`. */
export type DemoLoopNotificationType =
  | "new_offer"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_deleted"
  | "listing_sold"
  | "listing_received"
  | "listing_cancelled";

/**
 * `kind` es andamiaje del constructor: discrimina la unión mientras se arma el dataset y ninguno
 * de los dos consumidores lo persiste — la API espera el payload sin él.
 */
export type DemoNotificationPayload =
  | { kind: "mission"; userMissionId: UUID }
  | {
      kind: "loop";
      listingId: UUID;
      buyerId: UUID | null;
      toListingStatus: ListingStatus;
      toOfferedCredits: number | null;
      type: DemoLoopNotificationType;
    }
  | { kind: "donation"; donorUserId: UUID; amount: number; message: string | null }
  | {
      kind: "admin";
      action: AdminActions;
      message: string | null;
      target: string | null;
      referenceId: UUID | null;
      amount: number | null;
    };

export interface DemoNotification {
  id: UUID;
  communityId: UUID;
  userId: UUID;
  type: NotificationType;
  isRead: boolean;
  createdHoursAgo: HoursAgo;
  readHoursAgo: HoursAgo | null;
  payload: DemoNotificationPayload;
}

export type DemoAdminRole = "super_admin" | "community_admin";

/**
 * Admin del panel. Ojo con el invariante: la base tiene un CHECK que ata rol y alcance —
 * `super_admin` ⇔ `communityId === null`, `community_admin` ⇔ `communityId !== null`. Romperlo no
 * da un dato raro, da un INSERT rechazado.
 *
 * El panel (`adminClient`) no tiene modo demo, así que estos solo los consume el seed.
 */
export interface DemoAdmin {
  id: UUID;
  email: string;
  password: string;
  fullName: string;
  role: DemoAdminRole;
  communityId: UUID | null;
}

/**
 * Email habilitado para registrarse como admin. Es la allowlist que consulta `POST /admin/register`:
 * sin una fila acá, registrarse devuelve `EMAIL_NOT_AUTHORIZED`.
 */
export interface DemoAuthorizedAdminEmail {
  email: string;
  role: DemoAdminRole;
  communityId: UUID | null;
}

/**
 * Solicitud de borrado de cuenta pendiente. La crea el endpoint público de la landing y la resuelve
 * un admin desde el panel; se siembra una para que esa pantalla no arranque vacía.
 */
export interface DemoDeletionRequest {
  id: UUID;
  communityId: UUID;
  userId: UUID;
  email: string;
  createdHoursAgo: HoursAgo;
}

export interface DemoWish {
  id: UUID;
  communityId: UUID;
  userId: UUID;
  categoryId: UUID;
  comment: string | null;
}

export interface DemoCommunity {
  id: UUID;
  slug: string;
  name: string;
  emailDomains: string[];
  theme: CommunityTheme;
  media: DemoMedia;
  /** Usuario con el que entra el modo demo. Siempre pertenece a esta comunidad. */
  showcaseUserId: UUID;
  schools: DemoSchool[];
  users: DemoUser[];
  listings: DemoListing[];
  userMissions: DemoUserMission[];
  messages: DemoMessage[];
  notifications: DemoNotification[];
  wishes: DemoWish[];
  /** Admin de esta comunidad. Ve y administra solo lo de acá. */
  admin: DemoAdmin;
  deletionRequests: DemoDeletionRequest[];
  globalStats: DemoStats;
}

/**
 * Un dataset completo. `categories` y `missionTemplates` viven fuera de las comunidades porque en
 * la base son catálogos compartidos: no llevan `community_id`.
 */
export interface DemoDataset {
  categories: DemoCategory[];
  missionTemplates: DemoMissionTemplate[];
  /** Super admin: no cuelga de ninguna comunidad, justamente porque las ve todas. */
  superAdmin: DemoAdmin;
  /** Allowlist del panel, incluidos los emails que todavía no se registraron. */
  authorizedAdminEmails: DemoAuthorizedAdminEmail[];
  communities: DemoCommunity[];
}
