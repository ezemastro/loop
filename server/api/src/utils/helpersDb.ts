import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError, NotFoundError } from "../services/errors";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { sendMissionNotification } from "./notifications";
import {
  parseCategoryBaseFromDb,
  parseListingBaseFromDb,
  parseListingFromBase,
  parseMediaFromDb,
  parseMessageBaseFromDb,
  parseMessageFromBase,
  parseMissionTemplateFromDb,
  parseNotificationBaseFromDb,
  parseNotificationFromBase,
  parsePagination,
  parsePrivateUserFromBase,
  parsePublicUserFromBase,
  parseSchoolFromBase,
  parseSchoolFromDb,
  parseUserBaseFromDb,
  parseUserMissionBaseFromDb,
  parseUserMissionFromBase,
} from "./parseDb";
import { safeNumber } from "./safeNumber";

const NOTIFICATION_RECOVERABLE_ERRORS = new Set<string>([
  ERROR_MESSAGES.LISTING_NOT_FOUND,
  ERROR_MESSAGES.USER_NOT_FOUND,
  ERROR_MESSAGES.CATEGORY_NOT_FOUND,
  ERROR_MESSAGES.MEDIA_NOT_FOUND,
  ERROR_MESSAGES.SCHOOL_NOT_FOUND,
  ERROR_MESSAGES.MISSION_NOT_FOUND,
  ERROR_MESSAGES.MISSION_TEMPLATE_NOT_FOUND,
]);

const isRecoverableNotificationError = (error: unknown): boolean => {
  if (!(error instanceof InternalServerError)) return false;
  return NOTIFICATION_RECOVERABLE_ERRORS.has(error.message);
};

// ── Media ──

export const getMediaById = async ({
  client,
  mediaId,
}: {
  client: DatabaseClient;
  mediaId: UUID;
}) => {
  const [mediaDb] = await client.query(queries.mediaById, [mediaId]);
  if (!mediaDb) throw new NotFoundError(ERROR_MESSAGES.MEDIA_NOT_FOUND);
  return parseMediaFromDb(mediaDb);
};

export const getMediasByIds = async ({
  client,
  mediaIds,
}: {
  client: DatabaseClient;
  mediaIds: UUID[];
}): Promise<Media[]> => {
  if (mediaIds.length === 0) return [];
  const mediaDb = await client.query(queries.mediaByIds(mediaIds), [mediaIds]);
  return mediaDb.map(parseMediaFromDb);
};

export const getMediasByListingId = async ({
  client,
  listingId,
}: {
  client: DatabaseClient;
  listingId: UUID;
}) => {
  const listingMediasDb = await client.query(queries.listingMediasByListingId, [listingId]);
  if (listingMediasDb.length === 0) return [];
  const mediaIds = listingMediasDb.map((m) => m.media_id);
  return getMediasByIds({ client, mediaIds });
};

export const getMediasByListingIds = async ({
  client,
  listingIds,
}: {
  client: DatabaseClient;
  listingIds: UUID[];
}): Promise<Map<UUID, Media[]>> => {
  const map = new Map<UUID, Media[]>();
  listingIds.forEach((id) => map.set(id, []));
  if (listingIds.length === 0) return map;
  const listingMediasDb = await client.query(
    queries.listingMediasByListingIds(listingIds),
    [listingIds],
  );
  if (listingMediasDb.length === 0) return map;
  const mediaIds = [...new Set(listingMediasDb.map((lm) => lm.media_id))];
  const media = await getMediasByIds({ client, mediaIds });
  const mediaMap = new Map(media.map((m) => [m.id, m]));
  for (const lm of listingMediasDb) {
    const m = mediaMap.get(lm.media_id);
    if (m) map.get(lm.listing_id)!.push(m);
  }
  return map;
};

// ── Schools ──

export const getSchoolsByIds = async ({
  client,
  schoolIds,
}: {
  client: DatabaseClient;
  schoolIds: UUID[];
}): Promise<School[]> => {
  if (schoolIds.length === 0) return [];
  const schoolsDb = await client.query(queries.schoolsByIds(schoolIds), [schoolIds]);
  if (schoolsDb.length === 0) return [];
  const mediaIds = [...new Set(schoolsDb.map((s) => s.media_id))];
  const mediaDb = await client.query(queries.mediaByIds(mediaIds), [mediaIds]);
  const mediaMap = new Map(mediaDb.map((m) => [m.id, parseMediaFromDb(m)]));
  return schoolsDb.map((schoolDb) => {
    const schoolBase = parseSchoolFromDb(schoolDb);
    const media = mediaMap.get(schoolBase.mediaId);
    if (!media) throw new NotFoundError(ERROR_MESSAGES.MEDIA_NOT_FOUND);
    return parseSchoolFromBase({ school: schoolBase, media });
  });
};

export const getUserSchools = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}): Promise<School[]> => {
  const userSchoolsDb = await client.query(queries.userSchoolsByUserId, [userId]);
  if (userSchoolsDb.length === 0) return [];
  return getSchoolsByIds({
    client,
    schoolIds: userSchoolsDb.map((us) => us.school_id),
  });
};

export const getSchoolById = async ({
  client,
  schoolId,
}: {
  client: DatabaseClient;
  schoolId: UUID;
}) => {
  const [schoolDb] = await client.query(queries.schoolById, [schoolId]);
  if (!schoolDb) throw new NotFoundError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
  const schoolBase = parseSchoolFromDb(schoolDb);
  const schoolMedia = await getMediaById({
    client,
    mediaId: schoolBase.mediaId,
  });
  return parseSchoolFromBase({ school: schoolBase, media: schoolMedia });
};

// ── Users ──

export const getPrivateUserById = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}): Promise<PrivateUser> => {
  const [userDb] = await client.query(queries.userById, [userId]);
  if (!userDb) throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
  const userBase = parseUserBaseFromDb(userDb);
  const schools = await getUserSchools({ client, userId });
  const user = parsePrivateUserFromBase({
    user: userBase,
    profileMedia: userBase.profileMediaId
      ? await getMediaById({ client, mediaId: userBase.profileMediaId })
      : null,
    schools,
  });
  return user;
};

export const getUserById = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}) => {
  const [userDb] = await client.query(queries.userById, [userId]);
  if (!userDb) throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
  const userBase = parseUserBaseFromDb(userDb);
  const schools = await getUserSchools({ client, userId });
  const user = parsePublicUserFromBase({
    user: userBase,
    profileMedia: userBase.profileMediaId
      ? await getMediaById({ client, mediaId: userBase.profileMediaId })
      : null,
    schools,
  });
  return user;
};

export const getUsersByIds = async ({
  client,
  userIds,
}: {
  client: DatabaseClient;
  userIds: UUID[];
}): Promise<Map<UUID, PublicUser>> => {
  const map = new Map<UUID, PublicUser>();
  if (userIds.length === 0) return map;
  const usersDb = await client.query(queries.usersByIds(userIds), [userIds]);
  if (usersDb.length === 0) return map;
  // Batch fetch all school memberships for these users
  const allUserSchoolsDb = await client.query(
    queries.userSchoolsByUserIds(userIds),
    [userIds],
  );
  // Collect all unique school IDs
  const allSchoolIds = [...new Set(allUserSchoolsDb.map((us: { school_id: UUID }) => us.school_id))];
  // Batch fetch all schools
  const allSchools = allSchoolIds.length > 0
    ? await getSchoolsByIds({ client, schoolIds: allSchoolIds })
    : [];
  const schoolMap = new Map(allSchools.map((s) => [s.id, s]));
  // Group schools by user
  const userSchoolsMap = new Map<UUID, School[]>();
  for (const us of allUserSchoolsDb) {
    if (!userSchoolsMap.has(us.user_id)) userSchoolsMap.set(us.user_id, []);
    const school = schoolMap.get(us.school_id);
    if (school) userSchoolsMap.get(us.user_id)!.push(school);
  }
  // Batch fetch all profile media
  const profileMediaIds = [...new Set(
    usersDb.map((u) => u.profile_media_id).filter(Boolean) as UUID[],
  )];
  const profileMedia = profileMediaIds.length > 0
    ? await getMediasByIds({ client, mediaIds: profileMediaIds })
    : [];
  const profileMediaMap = new Map(profileMedia.map((m) => [m.id, m]));
  // Assemble
  for (const userDb of usersDb) {
    const userBase = parseUserBaseFromDb(userDb);
    const user = parsePublicUserFromBase({
      user: userBase,
      profileMedia: userBase.profileMediaId
        ? profileMediaMap.get(userBase.profileMediaId) ?? null
        : null,
      schools: userSchoolsMap.get(userBase.id) ?? [],
    });
    map.set(userBase.id, user);
  }
  return map;
};

// ── Listings ──

export const getListingById = async ({
  client,
  listingId,
}: {
  client: DatabaseClient;
  listingId: UUID;
}) => {
  const [listingDb] = await client.query(queries.listingById, [listingId]);
  if (!listingDb) throw new NotFoundError(ERROR_MESSAGES.LISTING_NOT_FOUND);
  const listingBase = parseListingBaseFromDb(listingDb);
  const listing = parseListingFromBase({
    listing: listingBase,
    buyer: listingBase.buyerId
      ? await getUserById({ client, userId: listingBase.buyerId })
      : null,
    media: await getMediasByListingId({ client, listingId }),
    seller: await getUserById({ client, userId: listingBase.sellerId }),
    category: await getCategoryById({
      client,
      categoryId: listingBase.categoryId,
    }),
  });
  return listing;
};

// ── Categories ──

const MAX_RECURSION_DEPTH = 20;

export const getCategoryById = async ({
  client,
  categoryId,
}: {
  client: DatabaseClient;
  categoryId: UUID;
}): Promise<Category> => {
  const [categoryDb] = await client.query(queries.categoryById, [categoryId]);
  if (!categoryDb) {
    throw new NotFoundError(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
  }
  const categoryBase = parseCategoryBaseFromDb(categoryDb);
  const [children, parents] = await Promise.all([
    getChildrenCategories({
      client,
      parentId: categoryBase.id,
      currentDepth: 0,
    }),
    categoryBase.parentId
      ? getCategoryParents({
          client,
          parentId: categoryBase.parentId,
          currentDepth: 0,
        })
      : [],
  ]);
  return {
    ...categoryBase,
    children,
    parents,
  };
};

const getChildrenCategories = async ({
  client,
  parentId,
  currentDepth,
}: {
  client: DatabaseClient;
  parentId: UUID;
  currentDepth: number;
}): Promise<Category[] | null> => {
  if (currentDepth >= MAX_RECURSION_DEPTH) {
    console.warn("Max recursion depth reached in getChildrenCategories");
    return null;
  }
  const childrenCategoriesDb = await client.query(queries.categoriesByParentId, [parentId]);
  if (childrenCategoriesDb.length === 0) {
    return null;
  }
  const childrenCategoriesBase = childrenCategoriesDb.map(parseCategoryBaseFromDb);
  return await Promise.all(
    childrenCategoriesBase.map(async (categoryBase) => {
      const children = await getChildrenCategories({
        client,
        parentId: categoryBase.id,
        currentDepth: currentDepth + 1,
      });
      const parents = categoryBase.parentId
        ? await getCategoryParents({
            client,
            parentId: categoryBase.parentId,
            currentDepth: 0,
          })
        : [];
      return {
        ...categoryBase,
        children,
        parents,
      };
    }),
  );
};

const getCategoryParents = async ({
  client,
  parentId,
  currentDepth,
}: {
  client: DatabaseClient;
  parentId: UUID;
  currentDepth: number;
}): Promise<CategoryBase[]> => {
  if (currentDepth >= MAX_RECURSION_DEPTH) {
    console.warn("Max recursion depth reached in getCategoryParents");
    return [];
  }
  const [parentDb] = await client.query(queries.categoryById, [parentId]);
  if (!parentDb) {
    throw new NotFoundError(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
  }
  const parent = parseCategoryBaseFromDb(parentDb);
  if (parent.parentId) {
    const furtherParents = await getCategoryParents({
      client,
      parentId: parent.parentId,
      currentDepth: currentDepth + 1,
    });
    return [parent, ...furtherParents];
  }
  return [parent];
};

export const getAllCategories = async ({
  client,
}: {
  client: DatabaseClient;
}): Promise<Category[]> => {
  const categoriesDb = await client.query(queries.allCategories);
  if (categoriesDb.length === 0) return [];
  const categoriesBase: CategoryBase[] = categoriesDb.map(parseCategoryBaseFromDb);
  const categoryMap = new Map<UUID, CategoryBase>();
  categoriesBase.forEach((cat) => categoryMap.set(cat.id, cat));
  const childrenMap = new Map<UUID, Category[]>();
  categoriesBase.forEach((cat) => childrenMap.set(cat.id, []));
  categoriesBase.forEach((cat) => {
    if (cat.parentId) {
      const parentChildren = childrenMap.get(cat.parentId);
      if (parentChildren) {
        parentChildren.push({ ...cat, children: null, parents: [] });
      }
    }
  });
  const buildParents = (category: CategoryBase, depth = 0): CategoryBase[] => {
    if (depth >= MAX_RECURSION_DEPTH) return [];
    if (!category.parentId) return [];
    const parent = categoryMap.get(category.parentId);
    if (!parent) return [];
    return [parent, ...buildParents(parent, depth + 1)];
  };
  const buildCategory = (cat: CategoryBase, depth = 0): Category => {
    if (depth >= MAX_RECURSION_DEPTH) {
      console.warn("Max recursion depth reached in getAllCategories");
      return { ...cat, children: null, parents: [] };
    }
    const children = childrenMap.get(cat.id)?.map((c) => buildCategory(c, depth + 1)) ?? null;
    const parents = buildParents(cat);
    return { ...cat, children, parents };
  };
  return categoriesBase.filter((cat) => !cat.parentId).map((cat) => buildCategory(cat));
};

// ── Missions ──

export const getUserMissionsByUserId = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}): Promise<UserMission[]> => {
  let userMissionsDb: DB_UserMissions[];
  try {
    userMissionsDb = await client.query(queries.userMissionsByUserId, [userId]);
  } catch {
    throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
  }
  if (userMissionsDb.length === 0) return [];
  const userMissionsBase = userMissionsDb.map((userMissionDb) =>
    parseUserMissionBaseFromDb(userMissionDb),
  );
  const templateIds = [...new Set(userMissionsBase.map((m) => m.missionTemplateId))];
  const templatesDb = await client.query(queries.missionTemplatesByIds(templateIds), [templateIds]);
  const templateMap = new Map(
    templatesDb.map((t) => [t.id, parseMissionTemplateFromDb(t)]),
  );
  return userMissionsBase.map((userMission) =>
    parseUserMissionFromBase({
      userMission,
      missionTemplate: templateMap.get(userMission.missionTemplateId)!,
    }),
  );
};

export const getMissionTemplateById = async ({
  client,
  templateId,
}: {
  client: DatabaseClient;
  templateId: UUID;
}) => {
  const [templateDb] = await client.query(queries.missionTemplateById, [templateId]);
  if (!templateDb) throw new NotFoundError(ERROR_MESSAGES.MISSION_TEMPLATE_NOT_FOUND);
  return parseMissionTemplateFromDb(templateDb);
};

export const getUserMissionById = async ({
  client,
  userMissionId,
}: {
  client: DatabaseClient;
  userMissionId: UUID;
}) => {
  const [missionDb] = await client.query(queries.userMissionsById, [userMissionId]);
  if (!missionDb) throw new NotFoundError(ERROR_MESSAGES.MISSION_NOT_FOUND);
  const missionBase = parseUserMissionBaseFromDb(missionDb);
  const missionTemplate = await getMissionTemplateById({
    client,
    templateId: missionBase.missionTemplateId,
  });
  return parseUserMissionFromBase({
    userMission: missionBase,
    missionTemplate,
  });
};

// ── Notifications ──

export const getNotificationsByUserId = async ({
  client,
  userId,
  page,
}: {
  client: DatabaseClient;
  userId: UUID;
  page: number | undefined;
}): Promise<{ notifications: AppNotification[]; pagination: Pagination }> => {
  let notificationsDb: (DB_Notifications & DB_Pagination)[];
  try {
    notificationsDb = await client.query(queries.notificationsByUserId, [
      userId,
      PAGE_SIZE,
      PAGE_SIZE * ((page ?? 1) - 1),
    ]);
  } catch {
    throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
  }
  if (notificationsDb.length === 0) {
    return {
      notifications: [],
      pagination: parsePagination({
        currentPage: page ?? 1,
        totalRecords: safeNumber(notificationsDb[0]?.total_records) ?? 0,
      }),
    };
  }
  const notificationsBase = notificationsDb.map(parseNotificationBaseFromDb);
  const notificationsWithGaps = await Promise.all(
    notificationsBase.map(async (notification) => {
      try {
        const buyer =
          notification.type === "loop"
            ? (notification.payload as LoopNotificationPayload).buyerId
              ? await getUserById({
                  client,
                  userId: (notification.payload as LoopNotificationPayload).buyerId!,
                })
              : null
            : undefined;
        const donorUser =
          notification.type === "donation"
            ? await getUserById({
                client,
                userId: (notification.payload as DonationNotificationPayload).donorUserId,
              })
            : undefined;
        const listingReferenceId =
          notification.type === "loop"
            ? (notification.payload as LoopNotificationPayload).listingId
            : notification.type === "admin" &&
                (notification.payload as AdminNotificationPayload).target === "listing" &&
                (notification.payload as AdminNotificationPayload).referenceId
              ? (notification.payload as AdminNotificationPayload).referenceId
              : null;
        const listing = listingReferenceId
          ? await getListingById({
              client,
              listingId: listingReferenceId,
            })
          : undefined;
        const userMission =
          notification.type === "mission"
            ? await getUserMissionById({
                client,
                userMissionId: (notification.payload as MissionNotificationPayload).userMissionId,
              })
            : undefined;
        return parseNotificationFromBase({
          notification,
          buyer,
          donorUser,
          userMission,
          listing,
        });
      } catch (error) {
        if (isRecoverableNotificationError(error)) return null;
        throw error;
      }
    }),
  );
  const notifications = notificationsWithGaps.filter(
    (notification): notification is AppNotification => notification !== null,
  );
  const pagination = parsePagination({
    currentPage: page ?? 1,
    totalRecords: safeNumber(notificationsDb[0]?.total_records) ?? 0,
  });
  return { notifications, pagination };
};

// ── Messages ──

export const getMessageById = async ({
  client,
  messageId,
}: {
  client: DatabaseClient;
  messageId: UUID;
}) => {
  const [messageDb] = await client.query(queries.messageById, [messageId]);
  if (!messageDb) throw new NotFoundError(ERROR_MESSAGES.MESSAGE_NOT_FOUND);
  const messageBase = parseMessageBaseFromDb(messageDb);
  return parseMessageFromBase({
    message: messageBase,
    listing: messageBase.attachedListingId
      ? await getListingById({
          client,
          listingId: messageBase.attachedListingId,
        })
      : null,
  });
};

// ── Mission Progress ──

export const progressMission = async ({
  client,
  userId,
  missionKey,
}: {
  client: DatabaseClient;
  userId: UUID;
  missionKey: string;
}) => {
  const missionTemplateDb = await client.query(queries.missionTemplateByKey, [missionKey]);
  if (missionTemplateDb.length === 0) return;
  const missionTemplate = parseMissionTemplateFromDb(missionTemplateDb[0]!);
  if (missionTemplate.active === false) return;
  const userMissionDb = await client.query(queries.userMissionsByUserIdAndTemplateId, [
    userId,
    missionTemplate.id,
  ]);
  if (userMissionDb.length === 0) return;
  const userMissionBase = parseUserMissionBaseFromDb(userMissionDb[0]!);
  if (userMissionBase.completed) return;
  const userMission = parseUserMissionFromBase({
    userMission: userMissionBase,
    missionTemplate,
  });
  const current = userMission.progress.current + 1;
  const completed = current >= userMission.progress.total;
  if (completed && !userMission.completed) {
    const userDb = await client.query(queries.userById, [userId]);
    if (userDb.length === 0) return;
    const userBase = parseUserBaseFromDb(userDb[0]!);
    const newCredits = (userBase.credits.balance ?? 0) + missionTemplate.rewardCredits;
    await client.query(queries.updateUserBalance, [newCredits, userBase.credits.locked, userId]);
    await sendMissionNotification({
      client,
      userId,
      missionId: userMission.id,
      notificationToken: userBase.notificationToken,
    });
  }
  await client.query(queries.progressMission, [
    { current, total: userMission.progress.total },
    completed,
    userMission.id,
  ]);
};

export const assignMissionToUser = async ({
  client,
  userId,
  missionKey,
}: {
  client: DatabaseClient;
  userId: UUID;
  missionKey: string;
}) => {
  const missionTemplateDb = await client.query(queries.missionTemplateByKey, [missionKey]);
  if (missionTemplateDb.length === 0) return;
  const missionTemplate = parseMissionTemplateFromDb(missionTemplateDb[0]!);
  const userMissionDb = await client.query(queries.userMissionsByUserIdAndTemplateId, [
    userId,
    missionTemplate.id,
  ]);
  if (userMissionDb.length > 0) return;
  const total = safeNumber(missionKey.split("-")[missionKey.split("-").length - 1]) ?? 1;
  await client.query(queries.assignMissionToUser, [
    userId,
    missionTemplate.id,
    { current: 0, total },
    false,
  ]);
};

export const assignAllMissionsToUser = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}) => {
  const missionTemplatesDb = await client.query(queries.allMissionTemplates);
  if (missionTemplatesDb.length === 0) return;
  const missionTemplates = missionTemplatesDb.map(parseMissionTemplateFromDb);
  for (const missionTemplate of missionTemplates) {
    const userMissionDb = await client.query(queries.userMissionsByUserIdAndTemplateId, [
      userId,
      missionTemplate.id,
    ]);
    if (userMissionDb.length > 0) continue;
    await client.query(queries.assignMissionToUser, [
      userId,
      missionTemplate.id,
      {
        current: 0,
        total:
          safeNumber(missionTemplate.key.split("-")[missionTemplate.key.split("-").length - 1]) ??
          1,
      },
      false,
    ]);
  }
};

export const assignMissionToAllUsers = async ({
  client,
  missionTemplateId,
}: {
  client: DatabaseClient;
  missionTemplateId: UUID;
}) => {
  const missionTemplateDb = await client.query(queries.missionTemplateById, [missionTemplateId]);
  if (missionTemplateDb.length === 0) {
    throw new NotFoundError(ERROR_MESSAGES.MISSION_TEMPLATE_NOT_FOUND);
  }
  const missionTemplate = parseMissionTemplateFromDb(missionTemplateDb[0]!);
  const usersDb = await client.query(queries.getAllUsersAdmin);
  if (usersDb.length === 0) return;
  const total =
    safeNumber(missionTemplate.key.split("-")[missionTemplate.key.split("-").length - 1]) ?? 1;
  for (const userDb of usersDb) {
    const userId = userDb.id;
    const userMissionDb = await client.query(queries.userMissionsByUserIdAndTemplateId, [
      userId,
      missionTemplate.id,
    ]);
    if (userMissionDb.length > 0) continue;
    await client.query(queries.assignMissionToUser, [
      userId,
      missionTemplate.id,
      { current: 0, total },
      false,
    ]);
  }
};
