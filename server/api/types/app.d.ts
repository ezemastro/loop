type UUID = string;

type ListingStatus = DB_ListingStatus;

type MediaType = "image" | "video" | "audio" | string;

interface Media {
  id: UUID;
  url: string;
  mime?: string | null;
  mediaType?: MediaType | null;
  uploadedBy: UUID;
  createdAt: Date;
}

interface School {
  id: UUID;
  name: string;
  mediaId: UUID;
  media?: Media;
  meta?: JsonObject | null;
}

interface Role {
  id: UUID;
  name: string;
}

interface User {
  id: UUID;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  schoolId: UUID;
  roleId: UUID;
  profileMediaId?: UUID | null;
  profileMedia?: Media | null;
  credits: { balance: number; locked: number };
  createdAt: Date;
  updatedAt?: Date | null;
  /* Optionally expanded */
  school?: School;
  role?: Role;
}

interface Category {
  id: UUID;
  name: string;
  parentId?: UUID | null;
  description?: string | null;
  priceRange?: { min?: number | null; max?: number | null };
  icon?: string | null;
  stats: { kgWaste: number; kgCo2: number; lH2o: number };
  createdAt: Date;
  children?: Category[];
}

interface Listing {
  id: UUID;
  sellerId: UUID;
  title: string;
  description?: string | null;
  categoryId: UUID;
  priceCredits: number;
  status: ListingStatus;
  buyerId?: UUID | null;
  offeredCredits?: number | null;
  createdAt: Date;
  updatedAt?: Date | null;
  media?: Media[]; // ordered
  seller?: User;
  buyer?: User | null;
  category?: Category;
}

type TransactionKind = DB_TransactionType;
interface WalletTransaction {
  id: UUID;
  userId: UUID;
  type: TransactionKind;
  positive: boolean;
  amount: number;
  balanceAfter?: number | null;
  referenceId?: UUID | null;
  meta?: JsonObject | null;
  createdAt: Date;
}

interface MissionTemplate {
  id: UUID;
  key: string;
  title: string;
  description?: string | null;
  rewardCredits: number;
  active: boolean;
  createdAt: Date;
}

interface UserMission {
  id: UUID;
  userId: UUID;
  missionTemplateId: UUID;
  missionTemplate: MissionTemplate;
  completed: boolean;
  completedAt?: Date | null;
  progress: JsonObject;
}

type NotificationType = DB_NotificationType;
type MissionPayload = {
  missionId: string;
  mission: UserMission;
  reward: number;
};
type LoopPayload = {
  listingId: UUID;
  listing: Listing;
  buyerId?: UUID;
  buyer?: User | null;
  offeredCredits?: number;
  status?: ListingStatus;
};
type DonationPayload = {
  donorUserId: UUID;
  donorUser: User;
  amount: number;
  message?: string;
};
type AdminPayload = {
  message?: string;
  action: "delete" | "update" | "credits";
  target?: {
    type: "listing" | "unknown";
    listingId?: UUID;
    listing?: Listing | null;
    text?: string;
  };
  amount?: number;
};

interface NotificationBase {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  createdAt: Date;
  isRead: boolean;
  readAt?: Date | null;
}

interface MissionNotification extends NotificationBase {
  type: "mission";
  payload: MissionPayload;
}

interface LoopNotification extends NotificationBase {
  type: "loop";
  payload: LoopPayload;
}

interface DonationNotification extends NotificationBase {
  type: "donation";
  payload: DonationPayload;
}

interface AdminNotification extends NotificationBase {
  type: "admin";
  payload: AdminPayload;
}

type Notification =
  | MissionNotification
  | LoopNotification
  | DonationNotification
  | AdminNotification;

interface Message {
  id: UUID;
  senderId: UUID;
  sender?: User;
  receiverId: UUID;
  receiver?: User;
  text: string;
  attachedListingId?: UUID | null;
  attachedListing?: Listing | null;
  createdAt: Date;
}
