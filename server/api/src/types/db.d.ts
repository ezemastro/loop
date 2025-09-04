type DbNumber = string;
type ISODateString = string;

type JsonValue = string | DbNumber | boolean | null | JsonObject | JsonArray;
interface JsonObject {
  [k: string]: JsonValue;
}
type JsonArray = Array<JsonValue>;

type DB_ListingStatus = ListingStatus;
type DB_TransactionType = TransactionType;
type DB_NotificationType = NotificationType;
type DB_AdminActions = AdminActions;

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
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  school_id: UUID;
  role_id: UUID;
  profile_media_id: UUID | null;
  credits_balance: DbNumber;
  credits_locked: DbNumber;
  created_at: ISODateString;
  updated_at: ISODateString | null;
}
interface DB_Categories {
  id: UUID;
  name: string;
  parent_id: UUID | null;
  description: string | null;
  min_price_credits: DbNumber | null;
  max_price_credits: DbNumber | null;
  created_at: ISODateString;
  icon: string | null;
  stat_kg_waste: DbNumber | null;
  stat_kg_co2: DbNumber | null;
  stat_l_h2o: DbNumber | null;
}
interface DB_Media {
  id: UUID;
  url: string;
  mime: string | null;
  media_type: string; // free text in DB
  uploaded_by: UUID;
  created_at?: ISODateString; // Default Now() in db
}
interface DB_Listings {
  id: UUID;
  disabled: boolean;
  seller_id: UUID;
  title: string;
  description: string | null;
  category_id: UUID;
  price_credits: DbNumber;
  listing_status: DB_ListingStatus;
  product_status: DB_ProductStatus;
  buyer_id: UUID | null;
  offered_credits: DbNumber | null;
  created_at: ISODateString;
  updated_at: ISODateString | null;
}
interface DB_ListingMedia {
  id: UUID;
  listing_id: UUID;
  media_id: UUID;
  position: DbNumber | null; // SMALLINT
}
interface DB_ListingTrades {
  id: UUID;
  listing_id: UUID;
  trade_listing_id: UUID;
}
interface DB_WalletTransactions {
  id: UUID;
  user_id: UUID;
  type: DB_TransactionType;
  positive: boolean;
  amount: DbNumber;
  balance_after: DbNumber | null;
  reference_id: UUID | null;
  meta: JsonObject | null;
  created_at: ISODateString;
}
interface DB_MissionTemplates {
  id: UUID;
  key: string;
  title: string;
  description: string | null;
  reward_credits: DbNumber;
  active: boolean;
  created_at: ISODateString;
}
interface DB_UserMissions {
  id: UUID;
  user_id: UUID;
  mission_template_id: UUID;
  completed_at: ISODateString | null;
  completed: boolean;
  progress: {
    total: DbNumber;
    current: DbNumber;
  }; // required jsonb
}
interface DB_Notifications {
  id: UUID;
  user_id: UUID;
  type: DB_NotificationType;
  payload: NotificationBase["payload"];
  is_read: boolean;
  read_at: ISODateString | null;
  created_at: ISODateString;
}
interface DB_Messages {
  id: UUID;
  sender_id: UUID;
  recipient_id: UUID;
  text: string;
  attached_listing_id: UUID | null;
  created_at: ISODateString;
}

interface DB_Pagination {
  total_records: DbNumber;
}
