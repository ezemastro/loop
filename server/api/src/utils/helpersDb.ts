import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError } from "../services/errors";
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

export const getPrivateUserById = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}): Promise<PrivateUser> => {
  const [userDb] = await client.query(queries.userById, [userId]);
  if (!userDb) throw new InternalServerError(ERROR_MESSAGES.USER_NOT_FOUND);
  const userBase = parseUserBaseFromDb(userDb);
  // Obtener todas las escuelas del usuario
  const userSchoolsDb = await client.query(queries.userSchoolsByUserId, [
    userId,
  ]);
  const schools = await Promise.all(
    userSchoolsDb.map(async (us: { school_id: UUID }) => {
      const schoolDb = await client.query(queries.schoolById, [us.school_id]);
      if (!schoolDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
      }
      const schoolBase = parseSchoolFromDb(schoolDb[0]);
      const schoolMedia = await getMediaById({
        client,
        mediaId: schoolBase.mediaId,
      });
      return parseSchoolFromBase({ school: schoolBase, media: schoolMedia });
    }),
  );
  const user = parsePrivateUserFromBase({
    user: userBase,
    profileMedia: userBase.profileMediaId
      ? await getMediaById({ client, mediaId: userBase.profileMediaId })
      : null,
    schools,
  });
  return user;
};
export const getListingById = async ({
  client,
  listingId,
}: {
  client: DatabaseClient;
  listingId: UUID;
}) => {
  const [listingDb] = await client.query(queries.listingById, [listingId]);
  if (!listingDb)
    throw new InternalServerError(ERROR_MESSAGES.LISTING_NOT_FOUND);
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

export const getUserById = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}) => {
  const [userDb] = await client.query(queries.userById, [userId]);
  if (!userDb) throw new InternalServerError(ERROR_MESSAGES.USER_NOT_FOUND);
  const userBase = parseUserBaseFromDb(userDb);
  // Obtener todas las escuelas del usuario
  const userSchoolsDb = await client.query(queries.userSchoolsByUserId, [
    userId,
  ]);
  const schools = await Promise.all(
    userSchoolsDb.map(async (us: { school_id: UUID }) => {
      const schoolDb = await client.query(queries.schoolById, [us.school_id]);
      if (!schoolDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
      }
      const schoolBase = parseSchoolFromDb(schoolDb[0]);
      const schoolMedia = await getMediaById({
        client,
        mediaId: schoolBase.mediaId,
      });
      return parseSchoolFromBase({ school: schoolBase, media: schoolMedia });
    }),
  );
  const user = parsePublicUserFromBase({
    user: userBase,
    profileMedia: userBase.profileMediaId
      ? await getMediaById({ client, mediaId: userBase.profileMediaId })
      : null,
    schools,
  });
  return user;
};
export const getMediaById = async ({
  client,
  mediaId,
}: {
  client: DatabaseClient;
  mediaId: UUID;
}) => {
  const [mediaDb] = await client.query(queries.mediaById, [mediaId]);
  if (!mediaDb) throw new InternalServerError(ERROR_MESSAGES.MEDIA_NOT_FOUND);
  return parseMediaFromDb(mediaDb);
};
export const getSchoolById = async ({
  client,
  schoolId,
}: {
  client: DatabaseClient;
  schoolId: UUID;
}) => {
  const [schoolDb] = await client.query(queries.schoolById, [schoolId]);
  if (!schoolDb) throw new InternalServerError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
  const schoolBase = parseSchoolFromDb(schoolDb);
  const schoolMedia = await getMediaById({
    client,
    mediaId: schoolBase.mediaId,
  });
  if (!schoolMedia)
    throw new InternalServerError(ERROR_MESSAGES.MEDIA_NOT_FOUND);
  const school = parseSchoolFromBase({
    school: schoolBase,
    media: schoolMedia,
  });
  return school;
};
export const getMediasByListingId = async ({
  client,
  listingId,
}: {
  client: DatabaseClient;
  listingId: UUID;
}) => {
  const listingMediasDb = await client.query(queries.listingMediasByListingId, [
    listingId,
  ]);
  return await Promise.all(
    listingMediasDb.map((listingMediaDb) =>
      getMediaById({ client, mediaId: listingMediaDb.media_id }),
    ),
  );
};
// Categories
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
    throw new InternalServerError(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
  }

  const categoryBase = parseCategoryBaseFromDb(categoryDb);

  // Obtenemos hijos y padres en paralelo
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
  // Prevención de recursión infinita
  if (currentDepth >= MAX_RECURSION_DEPTH) {
    console.warn("Max recursion depth reached in getChildrenCategories");
    return null;
  }
  // Obtener hijos
  const childrenCategoriesDb = await client.query(
    queries.categoriesByParentId,
    [parentId],
  );
  // Si no tiene hijos retornar null
  if (childrenCategoriesDb.length === 0) {
    return null;
  }

  const childrenCategoriesBase = childrenCategoriesDb.map(
    parseCategoryBaseFromDb,
  );

  // Procesar los hijos en paralelo
  return await Promise.all(
    childrenCategoriesBase.map(async (categoryBase) => {
      const children = await getChildrenCategories({
        client,
        parentId: categoryBase.id,
        currentDepth: currentDepth + 1,
      });

      // Para los padres, solo necesitamos obtener la cadena de padres si es necesario
      // Esto evita la necesidad de pasar todo el array de padres
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
  // Prevención de recursión infinita
  if (currentDepth >= MAX_RECURSION_DEPTH) {
    console.warn("Max recursion depth reached in getCategoryParents");
    return [];
  }

  const [parentDb] = await client.query(queries.categoryById, [parentId]);
  if (!parentDb) {
    throw new InternalServerError(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
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
// Obtener todas las categorías
export const getAllCategories = async ({
  client,
}: {
  client: DatabaseClient;
}): Promise<Category[]> => {
  // 1. Traer todas las categorías en una sola query
  const categoriesDb = await client.query(queries.allCategories);
  if (categoriesDb.length === 0) return [];

  // 2. Parsear a objetos base
  const categoriesBase: CategoryBase[] = categoriesDb.map(
    parseCategoryBaseFromDb,
  );

  // 3. Crear un diccionario id -> categoryBase
  const categoryMap = new Map<UUID, CategoryBase>();
  categoriesBase.forEach((cat) => categoryMap.set(cat.id, cat));

  // 4. Inicializar children vacíos
  const childrenMap = new Map<UUID, Category[]>();
  categoriesBase.forEach((cat) => childrenMap.set(cat.id, []));

  // 5. Armar la relación padre-hijo en memoria
  categoriesBase.forEach((cat) => {
    if (cat.parentId) {
      const parentChildren = childrenMap.get(cat.parentId);
      if (parentChildren) {
        parentChildren.push({ ...cat, children: null, parents: [] });
      }
    }
  });

  // 6. Función recursiva para obtener parents
  const buildParents = (category: CategoryBase, depth = 0): CategoryBase[] => {
    if (depth >= MAX_RECURSION_DEPTH) return [];
    if (!category.parentId) return [];

    const parent = categoryMap.get(category.parentId);
    if (!parent) return [];

    return [parent, ...buildParents(parent, depth + 1)];
  };

  // 7. Construir la estructura final
  const buildCategory = (cat: CategoryBase, depth = 0): Category => {
    if (depth >= MAX_RECURSION_DEPTH) {
      console.warn("Max recursion depth reached in getAllCategories");
      return { ...cat, children: null, parents: [] };
    }

    const children =
      childrenMap.get(cat.id)?.map((c) => buildCategory(c, depth + 1)) ?? null;
    const parents = buildParents(cat);

    return {
      ...cat,
      children,
      parents,
    };
  };

  // 8. Devolvemos solo las categorías raíz
  return categoriesBase
    .filter((cat) => !cat.parentId)
    .map((cat) => buildCategory(cat));
};

export const getUserMissionsByUserId = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}): Promise<UserMission[]> => {
  // Obtener misión del usuario
  let userMissionsDb: DB_UserMissions[];
  try {
    userMissionsDb = await client.query(queries.userMissionsByUserId, [userId]);
  } catch {
    throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
  }
  if (userMissionsDb.length === 0) {
    return [];
  }
  // Parsear misiones de DB a Base
  const userMissionsBase = userMissionsDb.map((userMissionDb) =>
    parseUserMissionBaseFromDb(userMissionDb),
  );
  // Obtener plantillas de misiones
  const missionTemplates = await Promise.all(
    userMissionsBase.map((userMission) =>
      getMissionTemplateById({
        client,
        templateId: userMission.missionTemplateId,
      }),
    ),
  );
  // Parsear misiones de usuario
  return userMissionsBase.map((userMission) =>
    parseUserMissionFromBase({
      userMission,
      missionTemplate: missionTemplates.find(
        (template) => template.id === userMission.missionTemplateId,
      )!,
    }),
  );
};

export const getNotificationsByUserId = async ({
  client,
  userId,
  page,
}: {
  client: DatabaseClient;
  userId: UUID;
  page: number | undefined;
}): Promise<{ notifications: AppNotification[]; pagination: Pagination }> => {
  // Obtener notificaciones del usuario
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
  // Parsear notificaciones de DB a Base
  const notificationsBase = notificationsDb.map(parseNotificationBaseFromDb);
  const notifications = await Promise.all(
    notificationsBase.map(async (notification) => {
      const buyer =
        notification.type === "loop"
          ? (notification.payload as LoopNotificationPayload).buyerId
            ? await getUserById({
                client,
                userId: (notification.payload as LoopNotificationPayload)
                  .buyerId!,
              })
            : null
          : undefined;
      const donorUser =
        notification.type === "donation"
          ? await getUserById({
              client,
              userId: (notification.payload as DonationNotificationPayload)
                .donorUserId,
            })
          : undefined;
      const listing =
        notification.type === "loop"
          ? await getListingById({
              client,
              listingId: (notification.payload as LoopNotificationPayload)
                .listingId,
            })
          : undefined;
      const userMission =
        notification.type === "mission"
          ? await getUserMissionById({
              client,
              userMissionId: (
                notification.payload as MissionNotificationPayload
              ).userMissionId,
            })
          : undefined;
      return parseNotificationFromBase({
        notification,
        buyer,
        donorUser,
        userMission,
        listing,
      });
    }),
  );
  const pagination = parsePagination({
    currentPage: page ?? 1,
    totalRecords: safeNumber(notificationsDb[0]?.total_records) ?? 0,
  });
  return { notifications, pagination };
};
export const getUserMissionById = async ({
  client,
  userMissionId,
}: {
  client: DatabaseClient;
  userMissionId: UUID;
}) => {
  const [missionDb] = await client.query(queries.userMissionsById, [
    userMissionId,
  ]);
  if (!missionDb)
    throw new InternalServerError(ERROR_MESSAGES.MISSION_NOT_FOUND);
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
export const getMissionTemplateById = async ({
  client,
  templateId,
}: {
  client: DatabaseClient;
  templateId: UUID;
}) => {
  const [templateDb] = await client.query(queries.missionTemplateById, [
    templateId,
  ]);
  if (!templateDb)
    throw new InternalServerError(ERROR_MESSAGES.MISSION_TEMPLATE_NOT_FOUND);
  return parseMissionTemplateFromDb(templateDb);
};
export const getMessageById = async ({
  client,
  messageId,
}: {
  client: DatabaseClient;
  messageId: UUID;
}) => {
  const [messageDb] = await client.query(queries.messageById, [messageId]);
  if (!messageDb)
    throw new InternalServerError(ERROR_MESSAGES.MESSAGE_NOT_FOUND);
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
export const progressMission = async ({
  client,
  userId,
  missionKey,
}: {
  client: DatabaseClient;
  userId: UUID;
  missionKey: string;
}) => {
  const missionTemplateDb = await client.query(queries.missionTemplateByKey, [
    missionKey,
  ]);
  if (missionTemplateDb.length === 0) return;
  const missionTemplate = parseMissionTemplateFromDb(missionTemplateDb[0]!);
  if (missionTemplate.active === false) return;
  const userMissionDb = await client.query(
    queries.userMissionsByUserIdAndTemplateId,
    [userId, missionTemplate.id],
  );
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
    // Actualizar créditos del usuario
    const userDb = await client.query(queries.userById, [userId]);
    if (userDb.length === 0) return;
    const userBase = parseUserBaseFromDb(userDb[0]!);
    const newCredits =
      (userBase.credits.balance ?? 0) + missionTemplate.rewardCredits;
    await client.query(queries.updateUserBalance, [
      newCredits,
      userBase.credits.locked,
      userId,
    ]);
    // Enviar notificación de misión completada
    await sendMissionNotification({
      client,
      userId,
      missionId: userMission.id,
      notificationToken: userBase.notificationToken,
    });
  }
  await client.query(queries.progressMission, [
    {
      current,
      total: userMission.progress.total,
    },
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
  const missionTemplateDb = await client.query(queries.missionTemplateByKey, [
    missionKey,
  ]);
  if (missionTemplateDb.length === 0) return;
  const missionTemplate = parseMissionTemplateFromDb(missionTemplateDb[0]!);
  const userMissionDb = await client.query(
    queries.userMissionsByUserIdAndTemplateId,
    [userId, missionTemplate.id],
  );
  if (userMissionDb.length > 0) return;
  const total =
    safeNumber(missionKey.split("-")[missionKey.split("-").length - 1]) ?? 1;
  await client.query(queries.assignMissionToUser, [
    userId,
    missionTemplate.id,
    {
      current: 0,
      total,
    },
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
    const userMissionDb = await client.query(
      queries.userMissionsByUserIdAndTemplateId,
      [userId, missionTemplate.id],
    );
    if (userMissionDb.length > 0) continue;
    await client.query(queries.assignMissionToUser, [
      userId,
      missionTemplate.id,
      {
        current: 0,
        total:
          safeNumber(
            missionTemplate.key.split("-")[
              missionTemplate.key.split("-").length - 1
            ],
          ) ?? 1,
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
  // Obtener la mission template
  const missionTemplateDb = await client.query(queries.missionTemplateById, [
    missionTemplateId,
  ]);
  if (missionTemplateDb.length === 0) {
    throw new InternalServerError(ERROR_MESSAGES.MISSION_TEMPLATE_NOT_FOUND);
  }
  const missionTemplate = parseMissionTemplateFromDb(missionTemplateDb[0]!);

  // Obtener todos los usuarios
  const usersDb = await client.query(queries.getAllUsersAdmin);
  if (usersDb.length === 0) return;

  // Calcular el total desde el key
  const total =
    safeNumber(
      missionTemplate.key.split("-")[missionTemplate.key.split("-").length - 1],
    ) ?? 1;

  // Asignar la misión a cada usuario que no la tenga ya
  for (const userDb of usersDb) {
    const userId = userDb.id;
    const userMissionDb = await client.query(
      queries.userMissionsByUserIdAndTemplateId,
      [userId, missionTemplate.id],
    );
    // Si el usuario ya tiene la misión, continuar
    if (userMissionDb.length > 0) continue;
    // Asignar la misión al usuario
    await client.query(queries.assignMissionToUser, [
      userId,
      missionTemplate.id,
      {
        current: 0,
        total,
      },
      false,
    ]);
  }
};
