import { ERROR_MESSAGES } from "../config";
import { InternalServerError } from "../services/errors";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import {
  parseCategoryBaseFromDb,
  parseChatFromDb,
  parseListingBaseFromDb,
  parseListingFromBase,
  parseMediaFromDb,
  parseMessageBaseFromDb,
  parseMessageFromBase,
  parseMissionTemplateFromDb,
  parseNotificationBaseFromDb,
  parseNotificationFromBase,
  parsePublicUserFromBase,
  parseRoleFromDb,
  parseSchoolFromBase,
  parseSchoolFromDb,
  parseUserBaseFromDb,
  parseUserMissionBaseFromDb,
  parseUserMissionFromBase,
} from "./parseDb";

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
    media: await getListingMediasById({ client, listingId }),
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
  const user = parsePublicUserFromBase({
    user: userBase,
    profileMedia: userBase.profileMediaId
      ? await getMediaById({
          client,
          mediaId: userBase.profileMediaId,
        })
      : null,
    school: await getSchoolById({ client, schoolId: userBase.schoolId }),
    role: await getRoleById({ client, roleId: userBase.roleId }),
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
export const getRoleById = async ({
  client,
  roleId,
}: {
  client: DatabaseClient;
  roleId: UUID;
}) => {
  const [roleDb] = await client.query(queries.roleById, [roleId]);
  if (!roleDb) throw new InternalServerError(ERROR_MESSAGES.ROLE_NOT_FOUND);
  return parseRoleFromDb(roleDb);
};
export const getListingMediasById = async ({
  client,
  listingId,
}: {
  client: DatabaseClient;
  listingId: UUID;
}) => {
  const mediasDb = await client.query(queries.mediasByListingId, [listingId]);
  return mediasDb.map(parseMediaFromDb);
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
}: {
  client: DatabaseClient;
  userId: UUID;
}): Promise<Notification[]> => {
  // Obtener notificaciones del usuario
  let notificationsDb: DB_Notifications[];
  try {
    notificationsDb = await client.query(queries.notificationsByUserId, [
      userId,
    ]);
  } catch {
    throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
  }
  if (notificationsDb.length === 0) {
    return [];
  }
  // Parsear notificaciones de DB a Base
  const notificationsBase = notificationsDb.map(parseNotificationBaseFromDb);
  return await Promise.all(
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
export const getChatsByUserId = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}): Promise<UserMessage[]> => {
  const chatsDb = await client.query(queries.chatsByUserId, [userId]);
  const chats = chatsDb.map(parseChatFromDb);
  return await Promise.all(
    chats.map(async (chat) => {
      return {
        ...chat,
        lastMessage: await getMessageById({
          client,
          messageId: chat.lastMessageId,
        }),
        user: await getUserById({ client, userId: chat.userId }),
      };
    }),
  );
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
