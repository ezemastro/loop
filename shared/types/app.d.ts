type UUID = string;

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
interface JsonObject {
  [k: string]: JsonValue;
}
type JsonArray = Array<JsonValue>;

type ListingStatus = "published" | "offered" | "accepted" | "received";
type ProductStatus = "new" | "used" | "damaged" | "repaired";
type MediaType = "image" | "video" | "audio" | string;
type TransactionType = "loop" | "mission" | "admin" | "donation";
type NotificationType = "mission" | "loop" | "donation" | "admin";
type AdminActions = "delete" | "update" | "credits";
type SortOptions = "createdAt" | "price" | "title" | "updatedAt" | "listingStatus" | "categoryId" | "sellerId" | "buyerId";
type OrderOptions = "asc" | "desc";

interface Media {
  id: UUID;
  url: string;
  mime: string | null;
  mediaType: MediaType;
}

interface SchoolBase {
  id: UUID;
  name: string;
  mediaId: UUID;
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
  credits: { balance: number; locked: number };
  stats: { kgWaste: number | null; kgCo2: number | null; lH2o: number | null };
}
interface User extends UserBase {
  profileMedia: Media | null;
  schools: School[];
}

type PublicUser = Omit<User, "phone" | "credits">;
type PrivateUser = User;

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
interface Notification extends NotificationBase {
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

interface Admin {
  id: UUID;
  username: string;
  fullName: string;
}

interface UserWhishBase {
  id: UUID;
  userId: UUID;
  categoryId: UUID;
  comment: string | null;
}
interface UserWhish extends UserWhishBase {
  category: Category;
}