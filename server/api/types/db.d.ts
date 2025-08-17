type ISODateString = string;

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
interface JsonObject {
  [k: string]: JsonValue;
}
type JsonArray = Array<JsonValue>;

type DB_ListingStatus = "published" | "offered" | "accepted" | "received";
type DB_TransactionType = "loop" | "mission" | "admin" | "donation";
type DB_NotificationType = "mission" | "loop" | "donation" | "admin";

interface DB_Schools {
  id: UUID;
  name: string;
  media_id: UUID;
  meta: JsonObject | null;
}
interface DB_Roles {
  id: UUID;
  name: string;
}
interface DB_Users {
  id: UUID;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  school_id: UUID;
  role: UUID; // FK -> roles.id
  profile_media_id: UUID | null;
  credits_balance: number;
  credits_locked: number;
  created_at: ISODateString;
  updated_at: ISODateString | null;
}
interface DB_Categories {
  id: UUID;
  name: string;
  parent_id: UUID | null;
  description: string | null;
  min_price_credits: number | null;
  max_price_credits: number | null;
  created_at: ISODateString;
  icon: string | null;
  stat_kg_waste: number;
  stat_kg_co2: number;
  stat_l_h2o: number;
}
interface DB_Media {
  id: UUID;
  url: string;
  mime: string | null;
  media_type: string | null; // free text in DB
  uploaded_by: UUID;
  created_at: ISODateString;
}
interface DB_Listings {
  id: UUID;
  seller_id: UUID;
  title: string;
  description: string | null;
  category_id: UUID;
  price_credits: number;
  status: DB_ListingStatus;
  buyer_id: UUID | null;
  offered_credits: number | null;
  created_at: ISODateString;
  updated_at: ISODateString | null;
}
interface DB_ListingMedia {
  id: UUID;
  listing_id: UUID;
  media_id: UUID;
  position: number | null; // SMALLINT
}
interface DB_WalletTransactions {
  id: UUID;
  user_id: UUID;
  type: DB_TransactionType;
  positive: boolean;
  amount: number;
  balance_after: number | null;
  reference_id: UUID | null;
  meta: JsonObject | null;
  created_at: ISODateString;
}
interface DB_MissionTemplates {
  id: UUID;
  key: string;
  title: string;
  description: string | null;
  reward_credits: number;
  active: boolean;
  created_at: ISODateString;
}
interface DB_UserMissions {
  id: UUID;
  user_id: UUID;
  mission_template_id: UUID;
  completed_at: ISODateString | null;
  completed: boolean;
  progress: JsonObject; // required jsonb
}
// Notification payloads:
interface DB_MissionPayload {
  mission_id: UUID;
}
interface DB_LoopPayload {
  listing_id: UUID;
  buyer_id?: UUID;
  status: DB_ListingStatus;
}
interface DB_DonationPayload {
  donor_user_id: UUID;
  amount: number;
  message?: string;
}
interface DB_AdminPayload {
  message?: string;
  action: "delete" | "update" | "credits";
  target?: {
    type: "listing" | "unknown";
    listing_id?: UUID;
    text?: string;
  };
  amount?: number;
}
interface DB_Notifications {
  id: UUID;
  user_id: UUID;
  type: DB_NotificationType;
  payload:
    | DB_MissionPayload
    | DB_LoopPayload
    | DB_DonationPayload
    | DB_AdminPayload;
  is_read: boolean;
  read_at: ISODateString | null;
  created_at: ISODateString;
}
interface DB_Messages {
  id: UUID;
  sender_id: UUID;
  receiver_id: UUID;
  text: string;
  attached_listing_id: UUID | null;
  created_at: ISODateString;
}
