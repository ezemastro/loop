import { randomBytes } from "node:crypto";
import { unscoped, withClient } from "../services/postgresClient.js";
import {
  ERROR_MESSAGES,
  ADMIN_GOOGLE_CLIENT_ID,
  PAGE_SIZE,
  AUTHORIZED_ADMIN_EMAIL,
  APP_BASE_URL,
} from "../config.js";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  NotFoundError,
} from "../services/errors.js";
import { isUniqueViolation } from "../services/pgErrors.js";
import { queries } from "../services/queries.js";
import {
  parseAdminFromDb,
  parseUserBaseFromDb,
  parseSchoolFromDb,
  parseCategoryBaseFromDb,
  parseNotificationBaseFromDb,
  parseMediaFromDb,
  parseMissionTemplateFromDb,
  parsePrivateUserFromBase,
  parseCommunityFromDb,
  parseInvitationFromDb,
  parseInvitationFromBase,
  parsePagination,
} from "../utils/parseDb.js";
import { comparePasswords, hashPassword } from "../services/hash.js";
import {
  assignMissionToAllUsers,
  getMediaById,
  getUserSchools,
  getUsersByIds,
} from "../utils/helpersDb.js";
import { getCommunityByIdWithClient, hydrateCommunity } from "../utils/communities.js";
import { safeNumber } from "../utils/safeNumber.js";
import { adminGoogleClient } from "../services/googleOauth.js";
import type { DatabaseClient } from "../types/dbClient.js";

/**
 * Todo el panel de admin abre la conexión con `unscoped("admin")`: el aislamiento no lo pone la
 * conexión sino el **rol del admin**, que llega como parámetro de comunidad en cada query.
 *
 *     community_admin → su comunidad (sale del token, nunca del body)
 *     super_admin     → null, que desactiva el predicado y le muestra todas
 *
 * Por eso cada método recibe `communityId: UUID | null` ya resuelto por el controller con
 * `adminScopeCommunityId`. Los INSERT son la excepción: ahí `community_id` es una columna y no
 * admite null, así que se toma de la fila afectada (la del usuario, por ejemplo) o se exige
 * explícito.
 */

const adminScope = { scope: unscoped("admin") } as const;
const adminScopeTx = { scope: unscoped("admin"), transaction: true } as const;

const parseCommunityDomainFromDb = (row: DB_CommunityEmailDomains): CommunityEmailDomain => ({
  id: row.id,
  communityId: row.community_id,
  domain: row.domain,
});

/**
 * Memoriza las comunidades ya hidratadas dentro de un request. El panel lista usuarios o
 * invitaciones de muchas comunidades a la vez y todas comparten un puñado de comunidades.
 */
const communityLoader = (client: DatabaseClient) => {
  const cache = new Map<UUID, Community | null>();
  return async (communityId: UUID): Promise<Community | null> => {
    const cached = cache.get(communityId);
    if (cached !== undefined) return cached;
    const community = await getCommunityByIdWithClient({ client, communityId });
    cache.set(communityId, community);
    return community;
  };
};

type CommunityLoader = ReturnType<typeof communityLoader>;

const buildPrivateUser = async ({
  client,
  userDb,
  loadCommunity,
}: {
  client: DatabaseClient;
  userDb: DB_Users;
  loadCommunity: CommunityLoader;
}): Promise<PrivateUser> => {
  const userBase = parseUserBaseFromDb(userDb);
  const community = await loadCommunity(userBase.communityId);
  if (!community) throw new InternalServerError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND);
  let profileMedia: Media | null = null;
  if (userBase.profileMediaId) {
    try {
      profileMedia = await getMediaById({ client, mediaId: userBase.profileMediaId });
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err;
    }
  }
  return parsePrivateUserFromBase({
    user: userBase,
    schools: await getUserSchools({ client, userId: userBase.id }),
    profileMedia,
    community,
  });
};

export class AdminModel {
  private static isEmailAuthorizedByEnv(email: string): boolean {
    return !!AUTHORIZED_ADMIN_EMAIL && email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
  }

  /**
   * Rol y comunidad que le corresponden a un admin nuevo. **Se heredan de la allowlist**, nunca
   * llegan por el body del registro: si no, cualquiera con un correo autorizado se daría de alta
   * como super admin.
   */
  private static async resolveAdminGrant({
    client,
    email,
  }: {
    client: DatabaseClient;
    email: string;
  }): Promise<{ role: AdminRole; communityId: UUID | null }> {
    // El admin autorizado por entorno es el super admin de arranque, exista o no su fila.
    if (AdminModel.isEmailAuthorizedByEnv(email)) {
      return { role: "super_admin", communityId: null };
    }
    const [validEmail] = await client.query(queries.validEmailForAdminRegistration, [email]);
    if (!validEmail) {
      throw new InvalidInputError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED);
    }
    return {
      role: validEmail.role,
      communityId: validEmail.role === "super_admin" ? null : validEmail.community_id,
    };
  }

  private static async hydrateAdmin({
    client,
    adminDb,
  }: {
    client: DatabaseClient;
    adminDb: DB_Admin;
  }): Promise<Admin> {
    const community = adminDb.community_id
      ? await getCommunityByIdWithClient({ client, communityId: adminDb.community_id })
      : null;
    return parseAdminFromDb(adminDb, community);
  }

  static async login({ email, password }: { email: string; password: string }) {
    return withClient(async (client) => {
      const adminDb = await client.query(queries.adminByEmail, [email]);
      if (!adminDb[0]) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      const isPasswordCorrect = await comparePasswords(password, adminDb[0].password);
      if (!isPasswordCorrect) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }
      const admin = await AdminModel.hydrateAdmin({ client, adminDb: adminDb[0] });
      return { admin };
    }, adminScope);
  }

  static async register({
    email,
    fullName,
    password,
  }: {
    email: string;
    fullName: string;
    password: string;
  }) {
    return withClient(async (client) => {
      const existingAdmin = await client.query(queries.adminByEmail, [email]);
      if (existingAdmin[0]) {
        throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }
      const { role, communityId } = await AdminModel.resolveAdminGrant({ client, email });
      const hashedPassword = await hashPassword(password);
      let newAdmin;
      try {
        newAdmin = await client.query(queries.createAdmin, [
          email,
          fullName,
          hashedPassword,
          null,
          role,
          communityId,
        ]);
      } catch (err: unknown) {
        if (isUniqueViolation(err)) {
          throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS);
        }
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (!newAdmin[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      return { admin: await AdminModel.hydrateAdmin({ client, adminDb: newAdmin[0] }) };
    }, adminScopeTx);
  }

  static async googleLogin({ credential }: { credential: string }) {
    return withClient(async (client) => {
      let payload;
      try {
        const ticket = await adminGoogleClient.verifyIdToken({
          idToken: credential,
          audience: ADMIN_GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
        if (!payload) {
          throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID);
        }
      } catch (error) {
        console.error("Error al verificar token de Google:", error);
        throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID);
      }

      const googleId = payload.sub;
      const email = payload.email;
      const emailVerified = payload.email_verified;
      const fullName = payload.name;

      if (!emailVerified || !email) {
        throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_EMAIL_NOT_VERIFIED);
      }

      let adminDb: DB_Admin | undefined;
      try {
        [adminDb] = await client.query(queries.adminByEmail, [email]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      if (!adminDb) {
        const { role, communityId } = await AdminModel.resolveAdminGrant({ client, email });

        const newAdminDb = await client.query(queries.createAdmin, [
          email,
          fullName,
          null,
          googleId,
          role,
          communityId,
        ]);
        if (!newAdminDb[0]) {
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
        }
        return { admin: await AdminModel.hydrateAdmin({ client, adminDb: newAdminDb[0] }) };
      } else {
        if (!adminDb.google_id) {
          await client.query(queries.updateAdminGoogleId, [googleId, adminDb.id]);
        } else {
          if (adminDb.google_id !== googleId) {
            throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_ID_MISMATCH);
          }
        }
        return { admin: await AdminModel.hydrateAdmin({ client, adminDb }) };
      }
    }, adminScopeTx);
  }

  /**
   * Autoriza un correo para registrarse como admin. El rol y la comunidad de la fila son los que
   * va a heredar el admin nuevo, así que quién puede autorizar qué se decide en el controller.
   */
  static async addValidEmailForRegistration({
    email,
    role,
    communityId,
  }: {
    email: string;
    role: AdminRole;
    communityId: UUID | null;
  }) {
    return withClient(async (client) => {
      if (communityId) {
        const community = await client.query(queries.communityById, [communityId]);
        if (!community[0]) throw new NotFoundError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND);
      }
      try {
        await client.query(queries.addValidEmailForAdminRegistration, [email, role, communityId]);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS);
        }
        throw err;
      }
    }, adminScope);
  }

  static async getUsers({
    page = 1,
    search,
    communityId,
  }: {
    page?: number;
    search?: string;
    communityId: UUID | null;
  }) {
    return withClient(async (client) => {
      const offset = (page - 1) * PAGE_SIZE;

      const usersDb = await client.query(queries.adminSearchUsers, [
        `%${search ?? ""}%`,
        PAGE_SIZE,
        offset,
        communityId,
      ]);

      const loadCommunity = communityLoader(client);
      const users = await Promise.all(
        usersDb.map((row) => buildPrivateUser({ client, userDb: row, loadCommunity })),
      );
      const total = safeNumber(usersDb[0]?.total_records) ?? 0;
      const pagination = parsePagination({ currentPage: page, totalRecords: total });

      return { users, total, pagination };
    }, adminScope);
  }

  static async modifyUserCredits({
    userId,
    amount,
    positive,
    meta,
    communityId,
  }: {
    userId: UUID;
    amount: number;
    positive: boolean;
    meta?: Record<string, unknown>;
    communityId: UUID | null;
  }) {
    return withClient(async (client) => {
      const userDb = await client.query(queries.userById, [userId, communityId]);
      if (!userDb[0]) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      // La transacción se inserta en la comunidad del usuario, no en la del filtro: para un super
      // admin el filtro es null y `community_id` no admite null.
      const userCommunityId = userDb[0].community_id;

      await client.query(queries.createWalletTransaction, [
        userId,
        "admin",
        positive,
        amount,
        null,
        meta ? JSON.stringify(meta) : null,
        userCommunityId,
      ]);

      if (positive) {
        await client.query(queries.increaseUserBalance, [amount, userId, communityId]);
      } else {
        await client.query(queries.decreaseUserBalance, [amount, userId, communityId]);
      }

      const updatedUserDb = await client.query(queries.userById, [userId, communityId]);
      if (!updatedUserDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      const user = await buildPrivateUser({
        client,
        userDb: updatedUserDb[0],
        loadCommunity: communityLoader(client),
      });
      return { user };
    }, adminScopeTx);
  }

  static async resetUserPassword({
    userId,
    newPassword,
    communityId,
  }: {
    userId: UUID;
    newPassword: string;
    communityId: UUID | null;
  }) {
    return withClient(async (client) => {
      // El UPDATE ya filtra por comunidad, pero sin este lookup un admin de otra comunidad
      // recibiría un 200 sin haber cambiado nada.
      const userDb = await client.query(queries.userById, [userId, communityId]);
      if (!userDb[0]) throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      const hashedPassword = await hashPassword(newPassword);
      await client.query(queries.updateUserPassword, [hashedPassword, userId, communityId]);
    }, adminScope);
  }

  static async createSchool({
    name,
    mediaId,
    communityId,
  }: {
    name: string;
    mediaId: UUID;
    communityId: UUID;
  }) {
    return withClient(async (client) => {
      // Los logos de colegio son media compartida (community_id nulo), así que se buscan sin filtro.
      const mediaDb = await client.query(queries.mediaById, [mediaId, null]);
      if (!mediaDb[0]) {
        throw new InvalidInputError(ERROR_MESSAGES.MEDIA_NOT_FOUND);
      }

      const schoolDb = await client.query(queries.createSchool, [name, mediaId, communityId]);
      if (!schoolDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      const schoolBase = parseSchoolFromDb(schoolDb[0]);
      const media = parseMediaFromDb(mediaDb[0]);
      return { school: { ...schoolBase, media } };
    }, adminScopeTx);
  }

  static async updateSchool({
    schoolId,
    name,
    mediaId,
    communityId,
  }: {
    schoolId: UUID;
    name?: string;
    mediaId?: UUID;
    communityId: UUID | null;
  }) {
    return withClient(async (client) => {
      const existingSchoolDb = await client.query(queries.schoolById, [schoolId, communityId]);
      if (!existingSchoolDb[0]) {
        throw new NotFoundError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
      }

      const currentSchool = existingSchoolDb[0];
      const finalName = name ?? currentSchool.name;
      const finalMediaId = mediaId ?? currentSchool.media_id;

      if (mediaId) {
        const mediaDb = await client.query(queries.mediaById, [mediaId, null]);
        if (!mediaDb[0]) {
          throw new InvalidInputError(ERROR_MESSAGES.MEDIA_NOT_FOUND);
        }
      }

      const updatedSchoolDb = await client.query(queries.updateSchool, [
        finalName,
        finalMediaId,
        schoolId,
        communityId,
      ]);
      if (!updatedSchoolDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      const schoolBase = parseSchoolFromDb(updatedSchoolDb[0]);
      const media = await getMediaById({ client, mediaId: finalMediaId });
      return { school: { ...schoolBase, media } };
    }, adminScopeTx);
  }

  // ── Catálogos compartidos (solo super admin) ──
  // No llevan comunidad: una categoría o una misión editada acá cambia para todas.

  static async createCategory({
    name,
    description,
    parentId,
    icon,
    minPriceCredits,
    maxPriceCredits,
    statKgWaste,
    statKgCo2,
    statLH2o,
  }: {
    name: string;
    description?: string;
    parentId?: UUID;
    icon?: string;
    minPriceCredits?: number;
    maxPriceCredits?: number;
    statKgWaste?: number;
    statKgCo2?: number;
    statLH2o?: number;
  }) {
    return withClient(async (client) => {
      if (parentId) {
        const parentDb = await client.query(queries.categoryById, [parentId]);
        if (!parentDb[0]) {
          throw new InvalidInputError(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
        }
      }

      const categoryDb = await client.query(queries.createCategory, [
        name,
        description || null,
        parentId || null,
        icon || null,
        minPriceCredits || null,
        maxPriceCredits || null,
        statKgWaste || null,
        statKgCo2 || null,
        statLH2o || null,
      ]);

      if (!categoryDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      const categoryBase = parseCategoryBaseFromDb(categoryDb[0]);
      return { category: categoryBase };
    }, adminScopeTx);
  }

  static async updateCategory({
    categoryId,
    name,
    description,
    parentId,
    icon,
    minPriceCredits,
    maxPriceCredits,
    statKgWaste,
    statKgCo2,
    statLH2o,
  }: {
    categoryId: UUID;
    name?: string;
    description?: string;
    parentId?: UUID | null;
    icon?: string;
    minPriceCredits?: number;
    maxPriceCredits?: number;
    statKgWaste?: number;
    statKgCo2?: number;
    statLH2o?: number;
  }) {
    return withClient(async (client) => {
      const categoryDb = await client.query(queries.categoryById, [categoryId]);
      if (!categoryDb[0]) {
        throw new NotFoundError(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      }

      if (parentId) {
        const parentDb = await client.query(queries.categoryById, [parentId]);
        if (!parentDb[0]) {
          throw new InvalidInputError(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
        }
      }

      const updatedCategoryDb = await client.query(queries.updateCategory, [
        name !== undefined ? name : categoryDb[0].name,
        description !== undefined ? description : categoryDb[0].description,
        parentId !== undefined ? parentId : categoryDb[0].parent_id,
        icon !== undefined ? icon : categoryDb[0].icon,
        minPriceCredits !== undefined ? minPriceCredits : categoryDb[0].min_price_credits,
        maxPriceCredits !== undefined ? maxPriceCredits : categoryDb[0].max_price_credits,
        statKgWaste !== undefined ? statKgWaste : categoryDb[0].stat_kg_waste,
        statKgCo2 !== undefined ? statKgCo2 : categoryDb[0].stat_kg_co2,
        statLH2o !== undefined ? statLH2o : categoryDb[0].stat_l_h2o,
        categoryId,
      ]);
      if (!updatedCategoryDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      const categoryBase = parseCategoryBaseFromDb(updatedCategoryDb[0]);
      return { category: categoryBase };
    }, adminScopeTx);
  }

  static async sendNotification({
    userId,
    type,
    payload,
    communityId,
  }: {
    userId: UUID;
    type: NotificationType;
    payload: Record<string, unknown>;
    communityId: UUID | null;
  }) {
    return withClient(async (client) => {
      const userDb = await client.query(queries.userById, [userId, communityId]);
      if (!userDb[0]) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      const notificationDb = await client.query(queries.createNotification, [
        userId,
        type,
        JSON.stringify(payload),
        userDb[0].community_id,
      ]);
      if (!notificationDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      const notificationBase = parseNotificationBaseFromDb(notificationDb[0]);
      return { notification: notificationBase };
    }, adminScopeTx);
  }

  static async getStats({ communityId }: { communityId: UUID | null }) {
    return withClient(async (client) => {
      const statsDb = await client.query(queries.getGlobalStats, [communityId]);
      // `global_stats` tiene 3 filas **por comunidad**, así que para un super admin sin filtro hay
      // varias filas por `stat_name`: se suman en lugar de pisarse.
      const stats = statsDb.reduce((acc: Record<string, number>, row) => {
        acc[row.stat_name] = (acc[row.stat_name] ?? 0) + Number(row.stat_value);
        return acc;
      }, {});

      return { stats };
    }, adminScope);
  }

  static async getSchoolStats({ communityId }: { communityId: UUID | null }) {
    return withClient(async (client) => {
      const schoolsDb = await client.query(queries.getSchoolStats, [communityId]);
      const schools = schoolsDb.map((row) => ({
        id: row.id,
        name: row.name,
        communityId: row.community_id,
        statKgWaste: row.stat_kg_waste ? Number(row.stat_kg_waste) : 0,
        statKgCo2: row.stat_kg_co2 ? Number(row.stat_kg_co2) : 0,
        statLH2o: row.stat_l_h2o ? Number(row.stat_l_h2o) : 0,
      }));

      return { schools };
    }, adminScope);
  }

  static async getMissionTemplates() {
    return withClient(async (client) => {
      const missionTemplatesDb = await client.query(queries.allMissionTemplates, []);

      const missionTemplates = missionTemplatesDb.map(parseMissionTemplateFromDb);

      return { missionTemplates };
    }, adminScope);
  }

  static async createMissionTemplate({
    key,
    title,
    description,
    rewardCredits,
    active,
  }: {
    key: string;
    title: string;
    description?: string;
    rewardCredits: number;
    active: boolean;
  }) {
    return withClient(async (client) => {
      const existingMission = await client.query(queries.missionTemplateByKey, [key]);
      if (existingMission[0]) {
        throw new ConflictError(ERROR_MESSAGES.MISSION_KEY_ALREADY_EXISTS);
      }

      const missionTemplateDb = await client.query(queries.createMissionTemplate, [
        key,
        title,
        description || null,
        rewardCredits,
        active,
      ]);

      if (!missionTemplateDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
      }

      const missionTemplate = parseMissionTemplateFromDb(missionTemplateDb[0]);

      // Alcanza a los usuarios de **todas** las comunidades: por eso la ruta es solo super admin.
      await assignMissionToAllUsers({
        client,
        missionTemplateId: missionTemplate.id,
      });

      return { missionTemplate };
    }, adminScopeTx);
  }

  static async updateMissionTemplate({
    missionTemplateId,
    title,
    description,
    rewardCredits,
    active,
  }: {
    missionTemplateId: UUID;
    title?: string;
    description?: string;
    rewardCredits?: number;
    active?: boolean;
  }) {
    return withClient(async (client) => {
      const missionDb = await client.query(queries.missionTemplateById, [missionTemplateId]);
      if (!missionDb[0]) {
        throw new NotFoundError(ERROR_MESSAGES.MISSION_NOT_FOUND);
      }

      const updatedMissionDb = await client.query(queries.updateMissionTemplate, [
        title !== undefined ? title : missionDb[0].title,
        description !== undefined ? description : missionDb[0].description,
        rewardCredits !== undefined ? rewardCredits : missionDb[0].reward_credits,
        active !== undefined ? active : missionDb[0].active,
        missionTemplateId,
      ]);

      if (!updatedMissionDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
      }

      const missionTemplate = parseMissionTemplateFromDb(updatedMissionDb[0]);

      return { missionTemplate };
    }, adminScopeTx);
  }

  // ── Comunidades (solo super admin) ──

  static async getCommunities() {
    return withClient(async (client) => {
      const communitiesDb = await client.query(queries.allCommunities, []);
      const communities = await Promise.all(
        communitiesDb.map(async (row) => {
          const community = await hydrateCommunity({
            client,
            community: parseCommunityFromDb(row),
          });
          const [counts] = await client.query(queries.communityCounts, [row.id]);
          const domainsDb = await client.query(queries.communityDomains, [row.id]);
          return {
            ...community,
            stats: {
              users: safeNumber(counts?.users) ?? 0,
              listings: safeNumber(counts?.listings) ?? 0,
              schools: safeNumber(counts?.schools) ?? 0,
            },
            domains: domainsDb.map(parseCommunityDomainFromDb),
          };
        }),
      );
      return { communities };
    }, adminScope);
  }

  static async createCommunity({
    slug,
    name,
    mediaId,
    theme,
    domains,
  }: {
    slug: string;
    name: string;
    mediaId?: UUID | null;
    theme?: CommunityTheme;
    domains?: string[];
  }) {
    return withClient(async (client) => {
      // Comunidad, stats y dominios en una sola transacción: una comunidad sin sus 3 filas de
      // `global_stats` haría fallar el primer loop que se complete en ella.
      let communityDb;
      try {
        communityDb = await client.query(queries.createCommunity, [
          slug,
          name,
          mediaId ?? null,
          JSON.stringify(theme ?? {}),
        ]);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError(
            ERROR_MESSAGES.COMMUNITY_SLUG_ALREADY_EXISTS,
            "COMMUNITY_SLUG_ALREADY_EXISTS",
          );
        }
        throw err;
      }
      if (!communityDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      const communityId = communityDb[0].id;

      await client.query(queries.seedCommunityStats, [communityId]);

      for (const domain of domains ?? []) {
        const normalized = domain.trim().toLowerCase();
        if (!normalized) continue;
        try {
          await client.query(queries.createCommunityDomain, [communityId, normalized]);
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new ConflictError(ERROR_MESSAGES.DOMAIN_ALREADY_TAKEN, "DOMAIN_ALREADY_TAKEN");
          }
          throw err;
        }
      }

      const community = await hydrateCommunity({
        client,
        community: parseCommunityFromDb(communityDb[0]),
      });
      return { community };
    }, adminScopeTx);
  }

  /** El slug es inmutable: es la clave por la que el cliente resuelve la comunidad. */
  static async updateCommunity({
    communityId,
    name,
    mediaId,
    theme,
    active,
  }: {
    communityId: UUID;
    name?: string;
    mediaId?: UUID | null;
    theme?: CommunityTheme;
    active?: boolean;
  }) {
    return withClient(async (client) => {
      const updatedDb = await client.query(queries.updateCommunity, [
        name ?? null,
        mediaId ?? null,
        theme ? JSON.stringify(theme) : null,
        active ?? null,
        communityId,
        // Distingue "no mandaron mediaId" de "lo mandaron en null": sin esta bandera no habría
        // forma de sacarle el logo a una comunidad.
        mediaId !== undefined,
      ]);
      if (!updatedDb[0]) {
        throw new NotFoundError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND);
      }
      const community = await hydrateCommunity({
        client,
        community: parseCommunityFromDb(updatedDb[0]),
      });
      return { community };
    }, adminScopeTx);
  }

  static async addCommunityDomain({ communityId, domain }: { communityId: UUID; domain: string }) {
    return withClient(async (client) => {
      const communityDb = await client.query(queries.communityById, [communityId]);
      if (!communityDb[0]) {
        throw new NotFoundError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND);
      }
      let domainDb;
      try {
        domainDb = await client.query(queries.createCommunityDomain, [
          communityId,
          domain.trim().toLowerCase(),
        ]);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError(ERROR_MESSAGES.DOMAIN_ALREADY_TAKEN, "DOMAIN_ALREADY_TAKEN");
        }
        throw err;
      }
      if (!domainDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      return { domain: parseCommunityDomainFromDb(domainDb[0]) };
    }, adminScopeTx);
  }

  static async removeCommunityDomain({
    communityId,
    domainId,
  }: {
    communityId: UUID;
    domainId: UUID;
  }) {
    return withClient(async (client) => {
      const deleted = await client.query(queries.deleteCommunityDomain, [domainId, communityId]);
      if (!deleted[0]) {
        throw new NotFoundError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND);
      }
    }, adminScope);
  }

  // ── Invitaciones ──

  static async createInvitation({
    communityId,
    adminId,
    note,
    expiresInDays,
  }: {
    communityId: UUID;
    adminId: UUID;
    note?: string;
    expiresInDays?: number;
  }) {
    return withClient(async (client) => {
      const communityDb = await client.query(queries.communityById, [communityId]);
      if (!communityDb[0]) {
        throw new NotFoundError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND);
      }

      // 32 bytes de entropía: es una credencial de un solo uso y de bajo privilegio, y va en una
      // URL, de ahí base64url.
      const token = randomBytes(32).toString("base64url");
      const expiresAt =
        expiresInDays && expiresInDays > 0
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const invitationDb = await client.query(queries.createInvitation, [
        token,
        communityId,
        adminId,
        note ?? null,
        expiresAt,
      ]);
      if (!invitationDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      const community = await hydrateCommunity({
        client,
        community: parseCommunityFromDb(communityDb[0]),
      });
      const invitation = parseInvitationFromBase({
        invitation: parseInvitationFromDb(invitationDb[0]),
        community,
        usedByUser: null,
        appBaseUrl: APP_BASE_URL,
      });
      return { invitation };
    }, adminScopeTx);
  }

  static async getInvitations({
    communityId,
    page = 1,
  }: {
    communityId: UUID | null;
    page?: number;
  }) {
    return withClient(async (client) => {
      const offset = (page - 1) * PAGE_SIZE;
      const invitationsDb = await client.query(queries.invitationsByCommunity, [
        communityId,
        PAGE_SIZE,
        offset,
      ]);

      const loadCommunity = communityLoader(client);
      const usedByIds = [
        ...new Set(invitationsDb.map((row) => row.used_by_user_id).filter(Boolean) as UUID[]),
      ];
      const usersById = await getUsersByIds({ client, userIds: usedByIds });

      const invitations = await Promise.all(
        invitationsDb.map(async (row) => {
          const invitationBase = parseInvitationFromDb(row);
          return parseInvitationFromBase({
            invitation: invitationBase,
            community: await loadCommunity(invitationBase.communityId),
            usedByUser: invitationBase.usedByUserId
              ? (usersById.get(invitationBase.usedByUserId) ?? null)
              : null,
            appBaseUrl: APP_BASE_URL,
          });
        }),
      );

      const pagination = parsePagination({
        currentPage: page,
        totalRecords: safeNumber(invitationsDb[0]?.total_records) ?? 0,
      });
      return { invitations, pagination };
    }, adminScope);
  }

  /** Revocar solo tiene sentido mientras la invitación siga sin usar. */
  static async deleteInvitation({
    invitationId,
    communityId,
  }: {
    invitationId: UUID;
    communityId: UUID | null;
  }) {
    return withClient(async (client) => {
      const deleted = await client.query(queries.deleteUnusedInvitation, [
        invitationId,
        communityId,
      ]);
      if (!deleted[0]) {
        throw new NotFoundError(ERROR_MESSAGES.INVITATION_INVALID, "INVITATION_INVALID");
      }
    }, adminScope);
  }

  // ── Mover un usuario de comunidad (solo super admin) ──

  /**
   * Solo se puede mover una cuenta **sin actividad**.
   *
   * Mover una con actividad implicaría reescribir `community_id` en 8 tablas (`listings`,
   * `messages`, `listing_media`, `listing_trades`, `wallet_transactions`, `users_wishes`,
   * `notifications`, `user_missions`) y las claves foráneas compuestas
   * `(user_id, community_id) → users(id, community_id)` lo impiden en el medio de la operación:
   * no hay orden de UPDATEs que las satisfaga sin volverlas DEFERRABLE. Y aunque se pudiera, mover
   * publicaciones y chats a una comunidad donde la contraparte no existe dejaría datos sin sentido.
   *
   * Así que el caso soportado es el real: una cuenta recién creada que entró a la comunidad
   * equivocada. `user_missions` y `notifications` se borran porque son filas derivadas —no
   * contenido del usuario— y sus FK compuestas bloquearían el UPDATE.
   */
  static async moveUserToCommunity({
    userId,
    communityId,
    schoolIds,
  }: {
    userId: UUID;
    communityId: UUID;
    schoolIds: UUID[];
  }) {
    return withClient(async (client) => {
      const userDb = await client.query(queries.userById, [userId, null]);
      if (!userDb[0]) throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);

      const communityDb = await client.query(queries.communityById, [communityId]);
      if (!communityDb[0]) throw new NotFoundError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND);

      const [counts] = await client.query(queries.userContentCounts, [userId]);
      if ((safeNumber(counts?.total) ?? 0) > 0) {
        throw new ConflictError(
          ERROR_MESSAGES.CANNOT_MOVE_USER_WITH_CONTENT,
          "CANNOT_MOVE_USER_WITH_CONTENT",
        );
      }

      const uniqueSchoolIds = [...new Set(schoolIds)];
      if (uniqueSchoolIds.length === 0) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
      }
      const [schoolCount] = await client.query(queries.countSchoolsInCommunity, [
        uniqueSchoolIds,
        communityId,
      ]);
      if ((safeNumber(schoolCount?.count) ?? 0) !== uniqueSchoolIds.length) {
        throw new InvalidInputError(ERROR_MESSAGES.SCHOOLS_NOT_IN_COMMUNITY);
      }

      await client.query(queries.deleteUserSchools, [userId, null]);
      await client.query(queries.deleteUserMissionsByUserId, [userId, null]);
      await client.query(queries.deleteNotificationsByUserId, [userId, null]);
      await client.query(queries.moveUserToCommunity, [communityId, userId]);
      await client.query(queries.insertUserSchools(uniqueSchoolIds.length), [
        userId,
        ...uniqueSchoolIds,
        communityId,
      ]);

      const movedUserDb = await client.query(queries.userById, [userId, null]);
      if (!movedUserDb[0]) throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      const user = await buildPrivateUser({
        client,
        userDb: movedUserDb[0],
        loadCommunity: communityLoader(client),
      });
      return { user };
    }, adminScopeTx);
  }
}
