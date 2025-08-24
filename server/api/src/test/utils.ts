import { randomUUID } from "node:crypto";
import { INITIAL_CREDITS } from "../config";
import { parseListingToDb, parseMediaToDb } from "../utils/parseDb";
import { queries } from "../services/queries";
import type { NamedQuery } from "../types/dbClient";
import { safeValidateUUID } from "../services/validations";

const schoolMediaId = randomUUID();
export const MOCK_SCHOOL: School = {
  id: randomUUID(),
  name: "Test School",
  mediaId: schoolMediaId,
  meta: null,
  media: {
    id: schoolMediaId,
    url: "http://example.com/media.jpg",
    mediaType: "image",
    mime: "image/jpeg",
  },
};
export const MOCK_ROLE: Role = {
  id: randomUUID(),
  name: "Test Role",
};
export const MOCK_USER: PrivateUser & { password: string } = {
  id: randomUUID(),
  email: "test@example.com",
  firstName: "firstName",
  lastName: "lastName",
  schoolId: MOCK_SCHOOL.id,
  roleId: MOCK_ROLE.id,
  password: "validPassword",
  credits: {
    balance: INITIAL_CREDITS,
    locked: 0,
  },
  phone: null,
  profileMediaId: null,
  profileMedia: null,
  role: MOCK_ROLE,
  school: MOCK_SCHOOL,
};
export const MOCK_USER_DB: DB_Users = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  first_name: MOCK_USER.firstName,
  last_name: MOCK_USER.lastName,
  school_id: MOCK_USER.schoolId,
  role_id: MOCK_USER.roleId,
  password: "hashedPassword",
  created_at: new Date().toISOString(),
  credits_balance: INITIAL_CREDITS,
  credits_locked: 0,
  phone: null,
  profile_media_id: null,
  updated_at: null,
};
export const MOCK_SCHOOL_DB: DB_Schools = {
  id: MOCK_SCHOOL.id,
  name: MOCK_SCHOOL.name,
  media_id: MOCK_SCHOOL.mediaId,
  meta: null,
};
export const MOCK_ROLE_DB: DB_Roles = {
  id: MOCK_ROLE.id,
  name: MOCK_ROLE.name,
};
export const MOCK_RANDOM_MEDIA: Media = {
  id: randomUUID(),
  url: "http://example.com/random-media.jpg",
  mediaType: "image",
  mime: "image/jpeg",
};
export const MOCK_CATEGORIES_DB: DB_Categories[] = [
  // Categoría raíz (nivel 1)
  {
    id: "96ae51b4-5198-4cbe-8976-1a6433d59c73" as UUID,
    name: "Electrónicos",
    parent_id: null,
    description: null,
    min_price_credits: null,
    max_price_credits: null,
    created_at: "2024-01-01T00:00:00Z",
    icon: "💻",
    stat_kg_waste: null,
    stat_kg_co2: null,
    stat_l_h2o: null,
  },

  // Subcategorías de Electrónicos (nivel 2)
  {
    id: "40e3e17c-916d-4d65-a72c-3c54affd2df3" as UUID,
    name: "Smartphones",
    parent_id: "96ae51b4-5198-4cbe-8976-1a6433d59c73" as UUID,
    description: "Teléfonos inteligentes y accesorios",
    min_price_credits: 100,
    max_price_credits: 2000,
    created_at: "2024-01-01T00:00:00Z",
    icon: "📱",
    stat_kg_waste: 0.5,
    stat_kg_co2: 10.2,
    stat_l_h2o: 1200,
  },
  {
    id: "c050ad88-4d53-4a17-849e-c250977e3aae" as UUID,
    name: "Computadoras",
    parent_id: "96ae51b4-5198-4cbe-8976-1a6433d59c73" as UUID,
    description: null,
    min_price_credits: null,
    max_price_credits: null,
    created_at: "2024-01-01T00:00:00Z",
    icon: "💻",
    stat_kg_waste: null,
    stat_kg_co2: null,
    stat_l_h2o: null,
  },

  // Subcategorías de Computadoras (nivel 3)
  {
    id: "64bc9311-b039-48fb-8bcf-80f598a638be" as UUID,
    name: "Laptops",
    parent_id: "c050ad88-4d53-4a17-849e-c250977e3aae" as UUID,
    description: "Computadoras portátiles",
    min_price_credits: 800,
    max_price_credits: 3500,
    created_at: "2024-01-01T00:00:00Z",
    icon: "💻",
    stat_kg_waste: 2.1,
    stat_kg_co2: 45.8,
    stat_l_h2o: 3500,
  },
  {
    id: "4c5c4c26-2268-414d-a2f1-92b0917e657a" as UUID,
    name: "Desktop",
    parent_id: "c050ad88-4d53-4a17-849e-c250977e3aae" as UUID,
    description: "Computadoras de escritorio",
    min_price_credits: 600,
    max_price_credits: 2800,
    created_at: "2024-01-01T00:00:00Z",
    icon: "🖥️",
    stat_kg_waste: 3.5,
    stat_kg_co2: 52.3,
    stat_l_h2o: 4200,
  },

  // Otra categoría raíz (nivel 1)
  {
    id: "0041127a-bf0b-4307-8e9d-b8e66e83099a" as UUID,
    name: "Ropa",
    parent_id: null,
    description: null,
    min_price_credits: null,
    max_price_credits: null,
    created_at: "2024-01-01T00:00:00Z",
    icon: "👕",
    stat_kg_waste: null,
    stat_kg_co2: null,
    stat_l_h2o: null,
  },

  // Subcategorías de Ropa (nivel 2)
  {
    id: "feb08ca2-bfec-4881-9bbc-406e25e1c0eb" as UUID,
    name: "Hombre",
    parent_id: "0041127a-bf0b-4307-8e9d-b8e66e83099a" as UUID,
    description: "Ropa para hombre",
    min_price_credits: 50,
    max_price_credits: 500,
    created_at: "2024-01-01T00:00:00Z",
    icon: "👔",
    stat_kg_waste: 0.8,
    stat_kg_co2: 8.5,
    stat_l_h2o: 800,
  },
  {
    id: "cb911d2f-2b35-4a37-b87c-79984a3d6dea" as UUID,
    name: "Mujer",
    parent_id: "0041127a-bf0b-4307-8e9d-b8e66e83099a" as UUID,
    description: "Ropa para mujer",
    min_price_credits: 40,
    max_price_credits: 600,
    created_at: "2024-01-01T00:00:00Z",
    icon: "👗",
    stat_kg_waste: 0.7,
    stat_kg_co2: 7.8,
    stat_l_h2o: 750,
  },

  // Categoría sin hijos (hoja)
  {
    id: "aa872131-0e03-4b00-b751-ddc49fb4b057" as UUID,
    name: "Accesorios iPhone",
    parent_id: "40e3e17c-916d-4d65-a72c-3c54affd2df3" as UUID,
    description: "Accesorios específicos para iPhone",
    min_price_credits: 20,
    max_price_credits: 300,
    created_at: "2024-01-01T00:00:00Z",
    icon: "🎧",
    stat_kg_waste: 0.2,
    stat_kg_co2: 3.1,
    stat_l_h2o: 250,
  },

  // Otra categoría hoja
  {
    id: "9b7525d7-35e7-49dc-8966-e13732fb94b4" as UUID,
    name: "Fundas",
    parent_id: "40e3e17c-916d-4d65-a72c-3c54affd2df3" as UUID,
    description: "Fundas y protectores",
    min_price_credits: 10,
    max_price_credits: 150,
    created_at: "2024-01-01T00:00:00Z",
    icon: "📱",
    stat_kg_waste: 0.1,
    stat_kg_co2: 2.5,
    stat_l_h2o: 180,
  },
];
export const databaseQueryMock = async (
  query: NamedQuery<unknown>,
  params: unknown[],
) => {
  if (query === queries.userExists) {
    return [{ exists: false }];
  }
  if (query === queries.insertUser) {
    return [{ id: MOCK_USER.id }];
  }
  if (query === queries.schoolById) {
    return [MOCK_SCHOOL_DB];
  }
  if (query === queries.roleById) {
    return [MOCK_ROLE_DB];
  }
  if (query === queries.userByEmail) {
    return [MOCK_USER_DB];
  }
  if (query === queries.userById) {
    return [MOCK_USER_DB];
  }
  if (query === queries.mediaById) {
    if (
      params[0] === MOCK_USER_DB.profile_media_id &&
      MOCK_USER_DB.profile_media_id !== null
    ) {
      return [
        parseMediaToDb({
          media: MOCK_USER.profileMedia!,
          userId: MOCK_USER.id,
        }),
      ];
    }
    if (params[0] === MOCK_SCHOOL_DB.media_id) {
      return [
        parseMediaToDb({
          media: MOCK_SCHOOL.media,
          userId: randomUUID(),
        }),
      ];
    }
    if ((await safeValidateUUID(params[0])).success) {
      return [
        parseMediaToDb({
          media: MOCK_RANDOM_MEDIA,
          userId: MOCK_USER.id,
        }),
      ];
    }
    return [MOCK_RANDOM_MEDIA];
  }
  if (query === queries.categoryById) {
    return [MOCK_CATEGORIES_DB.find((cat) => cat.id === params[0])];
  }
  if (query === queries.categoriesByParentId) {
    return MOCK_CATEGORIES_DB.filter((cat) => cat.parent_id === params[0]);
  }
  if (query === queries.mediasByListingId) {
    return [MOCK_RANDOM_MEDIA];
  }
  if (query === queries.listingById) {
    return [MOCK_LISTING_DB];
  }
  if (query === queries.notificationsByUserId) {
    return MOCK_NOTIFICATIONS_DB;
  }
};

const MOCK_CATEGORY: Category = {
  id: randomUUID(),
  name: "Test Category",
  parentId: null,
  description: "This is a test category",
  price: {
    min: 100,
    max: 100,
  },
  children: [],
  parents: null,
  stats: {
    kgWaste: 0,
    kgCo2: 0,
    lH2o: 0,
  },
  icon: "🛍️",
};
export const MOCK_LISTING: Listing = {
  id: randomUUID(),
  buyerId: MOCK_USER.id,
  buyer: MOCK_USER,
  categoryId: MOCK_CATEGORY.id,
  category: MOCK_CATEGORY,
  disabled: false,
  listingStatus: "offered",
  offeredCredits: 100,
  productStatus: "new",
  sellerId: MOCK_USER.id,
  seller: MOCK_USER,
  title: "Test Listing",
  description: "This is a test listing",
  price: 100,
  media: [MOCK_RANDOM_MEDIA],
  createdAt: new Date(),
};
export const MOCK_LISTING_DB = parseListingToDb(MOCK_LISTING);
export const MOCK_MISSION_TEMPLATE_DB: DB_MissionTemplates = {
  id: randomUUID(),
  title: "Test Mission",
  description: "This is a test mission",
  created_at: new Date().toISOString(),
  active: true,
  key: "test_mission",
  reward_credits: 100,
};
export const MOCK_USER_MISSION_DB: DB_UserMissions = {
  id: randomUUID(),
  user_id: MOCK_USER.id,
  mission_template_id: MOCK_MISSION_TEMPLATE_DB.id,
  completed: false,
  completed_at: null,
  progress: {
    current: 0,
    total: 1,
  },
};

export const MOCK_NOTIFICATIONS_DB: DB_Notifications[] = [
  {
    id: randomUUID(),
    user_id: MOCK_USER.id,
    created_at: new Date().toISOString(),
    is_read: false,
    type: "mission",
    payload: {
      userMissionId: MOCK_USER_MISSION_DB.id,
    } as MissionNotificationPayloadBase,
    read_at: null,
  },
  {
    id: randomUUID(),
    user_id: MOCK_USER.id,
    created_at: new Date().toISOString(),
    is_read: false,
    type: "donation",
    payload: {
      amount: 50,
      donorUserId: MOCK_USER.id,
      message: "Thank you for your donation!",
    } as DonationNotificationPayloadBase,
    read_at: null,
  },
  {
    id: randomUUID(),
    user_id: MOCK_USER.id,
    created_at: new Date().toISOString(),
    is_read: true,
    type: "loop",
    payload: {
      buyerId: MOCK_USER.id,
      listingId: MOCK_LISTING.id,
      toListingStatus: "offered",
      toOfferedCredits: 100,
    } as LoopNotificationPayloadBase,
    read_at: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    user_id: MOCK_USER.id,
    created_at: new Date().toISOString(),
    is_read: false,
    type: "admin",
    payload: {
      action: "credits",
      amount: 200,
      message: "You have received 200 credits.",
      referenceId: null,
      target: "credits",
    } as AdminNotificationPayloadBase,
    read_at: null,
  },
];
