type UUID = string;

type ListingStatus = "published" | "offered" | "accepted" | "received";
type ProductStatus = "new" | "used" | "damaged" | "repaired";
type MediaType = "image" | "video" | "audio" | string;
type TransactionType = "loop" | "mission" | "admin" | "donation";
type NotificationType = "mission" | "loop" | "donation" | "admin";
type AdminActions = "delete" | "update" | "credits";

interface Media {
  id: UUID;
  url: string;
  mime: string | null;
  mediaType: MediaType;
}

interface Role {
  id: UUID;
  name: string;
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
  schoolId: UUID;
  roleId: UUID;
  profileMediaId: UUID | null;
  credits: { balance: number; locked: number };
}
interface User extends UserBase {
  profileMedia: Media | null;
  school: School;
  role: Role;
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
}
interface Listing extends ListingBase {
  seller: PublicUser;
  media: Media[]; // ordered
  category: Category;
  buyer: PublicUser | null;
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

interface NotificationBase {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  createdAt: Date;
  isRead: boolean;
  readAt: Date | null;
  payload:
    | {
        userMissionId: UUID;
      }
    | {
        listingId: UUID;
        buyerId: UUID | null;
        toListingStatus: ListingStatus;
        toOfferedCredits: number | null;
      }
    | {
        donorUserId: UUID;
        amount: number;
        message: string | null;
      }
    | {
        message: string | null;
        action: AdminActions;
        target: "listing" | string;
        referenceId: UUID | null;
        amount: number | null;
      };
}
interface Notification extends NotificationBase {
  payload:
    | {
        userMissionId: UUID;
        userMission: UserMission;
      }
    | {
        listingId: UUID;
        listing: Listing;
        buyerId: UUID | null;
        buyer: PublicUser | null;
        toListingStatus: ListingStatus;
        toOfferedCredits: number | null;
      }
    | {
        donorUserId: UUID;
        donorUser: PublicUser;
        amount: number;
        message: string | null;
      }
    | {
        message: string | null;
        action: AdminActions;
        target: "listing" | string;
        referenceId: UUID | null;
        reference: Listing | null;
        amount: number | null;
      };
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
  id: UUID;
  userId: UUID;
  pendingMessages: number;
}
interface UserMessage extends UserMessageBase {
  lastMessage: Message;
}
