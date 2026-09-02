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

interface DB_Communities {
  id: UUID;
  slug: string;
  name: string;
  media_id: UUID | null;
  theme: JsonObject;
  meta: JsonObject | null;
  active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString | null;
}
interface DB_CommunityEmailDomains {
  id: UUID;
  community_id: UUID;
  domain: string;
  created_at: ISODateString;
}
interface DB_Invitations {
  id: UUID;
  token: string;
  community_id: UUID;
  created_by_admin_id: UUID;
  used_by_user_id: UUID | null;
  used_at: ISODateString | null;
  expires_at: ISODateString | null;
  note: string | null;
  created_at: ISODateString;
}
type DB_AccountDeletionStatus = "pending" | "completed" | "rejected";
interface DB_AccountDeletionRequests {
  id: UUID;
  user_id: UUID;
  community_id: UUID;
  email: string;
  status: DB_AccountDeletionStatus;
  resolved_by_admin_id: UUID | null;
  resolved_at: ISODateString | null;
  created_at: ISODateString;
}

interface DB_Schools {
  id: UUID;
  name: string;
  media_id: UUID;
  community_id: UUID;
  meta: JsonObject | null;
  stat_kg_waste: DbNumber | null;
  stat_kg_co2: DbNumber | null;
  stat_l_h2o: DbNumber | null;
}
interface DB_Users {
  id: UUID;
  email: string;
  password: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  profile_media_id: UUID | null;
  credits_balance: DbNumber;
  credits_locked: DbNumber;
  created_at: ISODateString;
  updated_at: ISODateString | null;
  notification_token: string | null;
  stat_kg_waste: DbNumber | null;
  stat_kg_co2: DbNumber | null;
  stat_l_h2o: DbNumber | null;
  google_id: string | null;
  community_id: UUID;
  invitation_id: UUID | null;
  /** Entró por invitación: el login no le exige que su dominio esté en la comunidad. */
  domain_exempt: boolean;
  /** La cuenta confirmó el mail (clic en el enlace) o entró por Google. Bloquea el login. */
  email_verified: boolean;
  /**
   * Digest SHA-256 del token del enlace de verificación; NULL si ya verificó, entró por Google, o
   * nunca se le exigió verificación. Nunca el token en texto plano (0012 lo elimina).
   */
  email_verification_token_hash: string | null;
  /** Vencimiento del token de verificación, 24hs después de emitido. NULL junto con el hash. */
  email_verification_expires_at: ISODateString | null;
}
interface DB_UserSchools {
  id: UUID;
  user_id: UUID;
  school_id: UUID;
  community_id: UUID;
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
  /** null = recurso compartido (logos de comunidad y de colegio), visible desde cualquier comunidad. */
  community_id: UUID | null;
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
  community_id: UUID;
  created_at: ISODateString;
  updated_at: ISODateString | null;
}
interface DB_ListingMedia {
  id: UUID;
  listing_id: UUID;
  media_id: UUID;
  community_id: UUID;
  position: DbNumber | null; // SMALLINT
}
interface DB_ListingTrades {
  id: UUID;
  listing_id: UUID;
  trade_listing_id: UUID;
  community_id: UUID;
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
  community_id: UUID;
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
  community_id: UUID;
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
  community_id: UUID;
  read_at: ISODateString | null;
  created_at: ISODateString;
}
interface DB_Messages {
  id: UUID;
  sender_id: UUID;
  recipient_id: UUID;
  text: string;
  attached_listing_id: UUID | null;
  community_id: UUID;
  created_at: ISODateString;
}

interface DB_Pagination {
  total_records: DbNumber;
}

interface DB_Admin {
  id: UUID;
  email: string;
  full_name: string;
  password: string | null;
  created_at: ISODateString;
  google_id: string | null;
  role: AdminRole;
  /** null ⇔ super_admin */
  community_id: UUID | null;
}

interface DB_AdminValidEmails {
  id: UUID;
  email: string;
  role: AdminRole;
  community_id: UUID | null;
}

interface DB_GlobalStats {
  id: UUID;
  stat_name: string;
  stat_value: DbNumber;
  community_id: UUID;
}

interface DB_UsersWishes {
  id: UUID;
  user_id: UUID;
  category_id: UUID;
  community_id: UUID;
  comment: string | null;
}
