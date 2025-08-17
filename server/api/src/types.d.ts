type UUID = string;

interface Media {
  id: UUID;
  url: string;
  mime?: string;
  mediaType: "image" | "video" | "audio";
  uploadedAt: Date;
}

interface School {
  id: UUID;
  name: string;
  media: Media;
}

interface User {
  id: UUID;
  name: {
    first: string;
    last: string;
  };
  email?: string;
  phone?: string;
  school: School;
  role: string;
  profile: Media;
  credits: {
    balance: number;
    locked: number;
  };
}

interface Category {
  id: UUID;
  name: string;
  description?: string;
  icon: string;
  createdAt: Date;
  subcategories: Array<Category | FinalCategory>;
}
interface FinalCategory extends Omit<Category, "subcategories"> {
  price: { min: number; max: number };
  stats: { kgWaste: number; kgCo2: number; lH2o: number };
}
type ListingStatus = "published" | "offered" | "accepted" | "received";

interface Listing {
  id: UUID;
  title: string;
  description?: string;
  price: number;
  createdAt: Date;
  updatedAt?: Date;
  media: Media[];
  seller: User;
  status: ListingStatus;
  buyer?: User;
  offeredCredits?: number;
  category: Category;
}

interface Message {
  id: UUID;
  sender: User;
  receiver: User;
  content: string;
  sentAt: Date;
}

interface Mission {
  id: UUID;
  title: string;
  description: string;
  key: string;
  reward: number;
  status: {
    completed: boolean;
    completedAt?: Date;
    progress: {
      current: number;
      total: number;
    };
  };
}

interface NotificationBase {
  id: UUID;
  user: User;
  createdAt: Date;
  readAt?: Date;
}
interface LoopNotification extends NotificationBase {
  type: "loop";
  content: {
    buyer: User;
    status: ListingStatus;
    listing: Listing;
  };
}
interface MissionNotification extends NotificationBase {
  type: "mission";
  content: {
    mission: Mission;
    // Crear mission type
  };
}
interface AdminNotification extends NotificationBase {
  type: "admin";
  content: {
    admin: User;
    message: string;
    action?:
      | {
          type: "delete";
          target?:
            | {
                type: "unknown";
                text: string;
              }
            | {
                type: "listing";
                listing: Listing;
              };
        }
      | {
          type: "credits";
          amount: number;
        };
  };
}
interface DonationNotification extends NotificationBase {
  type: "donation";
  content: {
    donor: User;
    amount: number;
    message?: string;
  };
}
type Notification =
  | LoopNotification
  | MissionNotification
  | AdminNotification
  | DonationNotification;
