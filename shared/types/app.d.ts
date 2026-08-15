type UUID = string;

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
interface JsonObject {
  [k: string]: JsonValue;
}
type JsonArray = Array<JsonValue>;

type ListingStatus = "published" | "offered" | "accepted" | "received";
type ProductStatus = "like_new" | "good" | "fair";
type MediaType = "image" | "video" | "audio" | string;
type TransactionType = "loop" | "mission" | "admin" | "donation";
type NotificationType = "mission" | "loop" | "donation" | "admin";
type AdminActions = "delete" | "update" | "credits";
type SortOptions =
  | "createdAt"
  | "price"
  | "title"
  | "updatedAt"
  | "listingStatus"
  | "categoryId"
  | "sellerId"
  | "buyerId";
type OrderOptions = "asc" | "desc";

interface Media {
  id: UUID;
  url: string;
  mime: string | null;
  mediaType: MediaType;
}

/**
 * Paleta de una comunidad. Las claves son exactamente las de `COLORS` en `client/config.ts`, así
 * el mapeo a las variables CSS de NativeWind es uno a uno.
 */
interface CommunityThemeColors {
  primary: string;
  secondary: string;
  tertiary: string;
  mainText: string;
  secondaryText: string;
  credits: string;
  creditsLight: string;
  stroke: string;
  background: string;
  alert: string;
}
interface CommunityTheme {
  colors: CommunityThemeColors;
}

/**
 * Una comunidad agrupa colegios y es la unidad de aislamiento: un usuario pertenece a exactamente
 * una, determinada por el dominio de su correo al registrarse, e inmutable después.
 */
interface CommunityBase {
  id: UUID;
  slug: string;
  name: string;
  mediaId: UUID | null;
  theme: CommunityTheme;
  meta: JsonObject | null;
  active: boolean;
}
interface Community extends CommunityBase {
  media: Media | null;
}
interface CommunityEmailDomain {
  id: UUID;
  communityId: UUID;
  domain: string;
}

interface SchoolBase {
  id: UUID;
  name: string;
  mediaId: UUID;
  communityId: UUID;
  meta: JsonObject | null;
}
interface School extends SchoolBase {
  media: Media;
}

interface UserBase {
  id: UUID;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  profileMediaId: UUID | null;
  communityId: UUID;
  credits: { balance: number; locked: number };
  stats: Stats;
  notificationToken: string | null;
  googleId: string | null;
  password: string | null;
}
interface User extends UserBase {
  profileMedia: Media | null;
  schools: School[];
}

type UserWithoutSecrets = Omit<User, "notificationToken" | "password" | "googleId">;

/**
 * El usuario de la sesión. Es el único que viaja con la comunidad hidratada, porque es de donde
 * el cliente saca la paleta y el logo con los que se pinta la app.
 */
interface PrivateUser extends UserWithoutSecrets {
  community: Community;
}

/**
 * Otro usuario visto desde la app. No lleva `community` a propósito: por definición es la misma
 * que la de quien lo está mirando, así que hidratarla en cada vendedor y cada chat sería puro peso.
 */
type PublicUser = Omit<UserWithoutSecrets, "phone" | "credits" | "email">;

interface CategoryBase {
  id: UUID;
  name: string;
  parentId: UUID | null;
  description: string | null;
  price: {
    min: number | null;
    max: number | null;
  } | null;
  icon: string | null;
  stats: {
    kgWaste: number;
    kgCo2: number;
    lH2o: number;
  } | null;
}
interface Category extends CategoryBase {
  parents: CategoryBase[] | null;
  children: Category[] | null;
}

interface ListingBase {
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
  createdAt: Date;
}
interface Listing extends ListingBase {
  seller: PublicUser;
  media: Media[]; // ordered
  category: Category;
  buyer: PublicUser | null;
}
interface ListingTrade {
  id: UUID;
  listingId: UUID;
  tradeListingId: UUID;
}

interface MissionTemplate {
  id: UUID;
  key: string;
  title: string;
  description: string | null;
  rewardCredits: number;
  active: boolean;
}

interface UserMissionBase {
  id: UUID;
  userId: UUID;
  missionTemplateId: UUID;
  completed: boolean;
  completedAt: Date | null;
  progress: {
    total: number;
    current: number;
  };
}
interface UserMission extends UserMissionBase {
  missionTemplate: MissionTemplate;
}

interface WalletTransactionBase {
  id: UUID;
  userId: UUID;
  type: TransactionType;
  positive: boolean;
  amount: number;
  balanceAfter: number;
  referenceId: UUID | null;
  meta: JsonObject | null;
  createdAt: Date;
}
interface WalletTransaction extends WalletTransactionBase {
  user: User;
  reference: Listing | UserMission | PublicUser;
}

interface MissionNotificationPayloadBase {
  userMissionId: UUID;
}
interface MissionNotificationPayload extends MissionNotificationPayloadBase {
  userMission: UserMission;
}
interface LoopNotificationPayloadBase {
  listingId: UUID;
  buyerId: UUID | null;
  toListingStatus: ListingStatus;
  toOfferedCredits: number | null;
  type:
    | "new_offer"
    | "offer_accepted"
    | "offer_rejected"
    | "offer_deleted"
    | "listing_sold"
    | "listing_received"
    | "listing_cancelled";
}
interface LoopNotificationPayload extends LoopNotificationPayloadBase {
  listing: Listing;
  buyer: PublicUser | null;
}
interface AdminNotificationPayloadBase {
  message: string | null;
  action: AdminActions;
  target: "listing" | string | null;
  referenceId: UUID | null;
  amount: number | null;
}
interface AdminNotificationPayload extends AdminNotificationPayloadBase {
  reference: Listing | null;
}
interface DonationNotificationPayloadBase {
  donorUserId: UUID;
  amount: number;
  message: string | null;
}
interface DonationNotificationPayload extends DonationNotificationPayloadBase {
  donorUser: PublicUser;
}
interface NotificationBase {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  createdAt: Date;
  isRead: boolean;
  readAt: Date | null;
  payload:
    | MissionNotificationPayloadBase
    | LoopNotificationPayloadBase
    | DonationNotificationPayloadBase
    | AdminNotificationPayloadBase;
}
interface AppNotification extends NotificationBase {
  payload:
    | MissionNotificationPayload
    | LoopNotificationPayload
    | DonationNotificationPayload
    | AdminNotificationPayload;
}

interface MessageBase {
  id: UUID;
  senderId: UUID;
  recipientId: UUID;
  text: string;
  attachedListingId?: UUID | null;
  createdAt: Date;
}
interface Message extends MessageBase {
  attachedListing: Listing | null;
}

interface UserMessageBase {
  userId: UUID;
  lastMessageId: UUID;
  pendingMessages: number;
}
interface UserMessage extends UserMessageBase {
  lastMessage: Message;
  user: PublicUser;
}

/** `super_admin` administra todas las comunidades; `community_admin` solo la suya. */
type AdminRole = "super_admin" | "community_admin";

interface Admin {
  id: UUID;
  email: string;
  fullName: string;
  role: AdminRole;
  /** null ⇔ super_admin */
  communityId: UUID | null;
  community: Community | null;
}

/**
 * Enlace de un solo uso que permite registrarse con un correo que no pertenece a los dominios de
 * la comunidad. Quien lo use entra a la comunidad del admin que lo generó.
 */
interface InvitationBase {
  id: UUID;
  token: string;
  communityId: UUID;
  usedByUserId: UUID | null;
  usedAt: Date | null;
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
}
interface Invitation extends InvitationBase {
  /** Link listo para compartir, armado con APP_BASE_URL. */
  url: string;
  community: Community | null;
  usedByUser: PublicUser | null;
}

interface UserWishBase {
  id: UUID;
  userId: UUID;
  categoryId: UUID;
  comment: string | null;
}
interface UserWish extends UserWishBase {
  category: Category;
}

interface Stats {
  kgWaste: number | null;
  kgCo2: number | null;
  lH2o: number | null;
}
