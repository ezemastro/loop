import { dbConnection } from "../services/postgresClient";
import type { DatabaseClient } from "../types/dbClient";
import { ERROR_MESSAGES, ADMIN_GOOGLE_CLIENT_ID, PAGE_SIZE } from "../config";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
} from "../services/errors";
import { queries } from "../services/queries";
import {
  parseAdminFromDb,
  parseUserBaseFromDb,
  parseSchoolFromDb,
  parseCategoryBaseFromDb,
  parseNotificationBaseFromDb,
  parseMediaFromDb,
  parseMissionTemplateFromDb,
  parsePrivateUserFromBase,
} from "../utils/parseDb";
import { comparePasswords, hashPassword } from "../services/hash";
import {
  assignMissionToAllUsers,
  getMediaById,
  getUserSchools,
} from "../utils/helpersDb";
import {
  DEFAULT_ORDER_OPTION,
  DEFAULT_SORT_OPTION,
} from "../utils/sortOptions";
import { safeNumber } from "../utils/safeNumber";
import { adminGoogleClient } from "../services/googleOauth";

export class AdminModel {
  static async login({ email, password }: { email: string; password: string }) {
    // Conectarse a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const adminDb = await client.query(queries.adminByEmail, [email]);
      if (!adminDb[0]) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      const admin = parseAdminFromDb(adminDb[0]);
      // Verificar la contraseña
      const isPasswordCorrect = await comparePasswords(
        password,
        adminDb[0].password,
      );
      if (!isPasswordCorrect) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }
      return { admin };
    } finally {
      client.release();
    }
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
    // Conectarse a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Verificar si el admin ya existe
      const existingAdmin = await client.query(queries.adminByEmail, [email]);
      if (existingAdmin[0]) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }
      // Verificar si el mail de registro está autorizado
      const isValidEmailDb = await client.query(
        queries.isValidEmailForAdminRegistration,
        [email],
      );
      if (!isValidEmailDb[0]?.exists) {
        throw new InvalidInputError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED);
      }
      // Hashear la contraseña
      const hashedPassword = await hashPassword(password);
      // Crear el nuevo administrador
      await client.begin();
      const newAdmin = await client.query(queries.createAdmin, [
        email,
        fullName,
        hashedPassword,
        null,
      ]);
      if (!newAdmin[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      await client.commit();
      return {
        admin: parseAdminFromDb(newAdmin[0]),
      };
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  }

  static async googleLogin({ credential }: { credential: string }) {
    // Conectarse a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
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
        // Capturar errores de verificación de Google (e.g., audience mismatch)
        console.error("Error al verificar token de Google:", error);
        throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID);
      }

      // Obtener información del usuario
      const googleId = payload.sub;
      const email = payload.email;
      const emailVerified = payload.email_verified;
      const fullName = payload.name;

      // Verificar si el email está verificado
      if (!emailVerified) {
        throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_EMAIL_NOT_VERIFIED);
      }

      // Verificar si el email ya está registrado
      let adminDb: DB_Admin | undefined;
      try {
        [adminDb] = await client.query(queries.adminByEmail, [email]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (!adminDb) {
        // Registrar nuevo admin
        // Verificar si el mail de registro está autorizado
        const isValidEmailDb = await client.query(
          queries.isValidEmailForAdminRegistration,
          [email],
        );
        if (!isValidEmailDb[0]?.exists) {
          throw new InvalidInputError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED);
        }
        // Crear el nuevo administrador
        await client.begin();
        let admin;
        try {
          const newAdminDb = await client.query(queries.createAdmin, [
            email,
            fullName,
            null,
            googleId,
          ]);
          if (!newAdminDb[0]) {
            // Posible error si no se devuelve como array
            throw new Error();
          }
          admin = parseAdminFromDb(newAdminDb[0]);
          await client.commit();
        } catch {
          await client.rollback();
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
        }
        return { admin };
      } else {
        // Iniciar sesión admin existente
        // Verificar si el admin no se registró con Google
        if (!adminDb.google_id) {
          // Agregar googleId al admin existente
          await client.query(queries.updateAdminGoogleId, [
            googleId,
            adminDb.id,
          ]);
        } else {
          // Verificar que el googleId coincida
          if (adminDb.google_id !== googleId) {
            throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_ID_MISMATCH);
          }
        }
        const admin = parseAdminFromDb(adminDb);
        return { admin };
      }
    } finally {
      client.release();
    }
  }

  static async addValidEmailForRegistration({ email }: { email: string }) {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.query(queries.addValidEmailForAdminRegistration, [email]);
    } finally {
      client.release();
    }
  }

  // Gestión de usuarios
  static async getUsers({
    page = 1,
    search,
  }: {
    page?: number;
    search?: string;
  }) {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const offset = (page - 1) * PAGE_SIZE;

      const usersDb = await client.query(
        queries.searchUsers({
          order: DEFAULT_ORDER_OPTION,
          sort: DEFAULT_SORT_OPTION,
        }),
        [search, null, null, PAGE_SIZE, offset],
      );

      const users = await Promise.all(
        usersDb.map(async (row) => {
          return parsePrivateUserFromBase({
            user: parseUserBaseFromDb(row),
            schools: await getUserSchools({ client, userId: row.id }),
            profileMedia: row.profile_media_id
              ? await getMediaById({
                  client,
                  mediaId: row.profile_media_id,
                })
              : null,
          });
        }),
      );
      const total = safeNumber(usersDb[0]?.total_records);

      return { users, total };
    } finally {
      client.release();
    }
  }

  static async modifyUserCredits({
    userId,
    amount,
    positive,
    meta,
  }: {
    userId: UUID;
    amount: number;
    positive: boolean;
    meta?: Record<string, unknown>;
  }) {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.begin();

      // Verificar que el usuario existe
      const userDb = await client.query(queries.userById, [userId]);
      if (!userDb[0]) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Crear la transacción
      await client.query(queries.createWalletTransaction, [
        userId,
        "admin",
        positive,
        amount,
        null,
        meta ? JSON.stringify(meta) : null,
      ]);

      // Actualizar el balance del usuario
      if (positive) {
        await client.query(queries.increaseUserBalance, [amount, userId]);
      } else {
        await client.query(queries.decreaseUserBalance, [amount, userId]);
      }

      await client.commit();

      // Obtener el usuario actualizado
      const updatedUserDb = await client.query(queries.userById, [userId]);
      if (!updatedUserDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      const userBase = parseUserBaseFromDb(updatedUserDb[0] as DB_Users);
      return { user: userBase };
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  }
  // TODO ---------------
  // MODIFICAR CONTRASEÑA DE USUARIO
  // Y AGREGAR ENDPOINT EN USER PARA QUE LA PUEDA CAMBIAR ELLA MISMA

  static async resetUserPassword({
    userId,
    newPassword,
  }: {
    userId: UUID;
    newPassword: string;
  }) {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Hashear la nueva contraseña
      const hashedPassword = await hashPassword(newPassword);
      // Actualizar la contraseña del usuario

      await client.query(queries.updateUserPassword, [hashedPassword, userId]);
    } finally {
      client.release();
    }
  }

  // Gestión de escuelas
  static async createSchool({
    name,
    mediaId,
  }: {
    name: string;
    mediaId: UUID;
  }) {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.begin();

      // Verificar que el media existe
      const mediaDb = await client.query(queries.mediaById, [mediaId]);
      if (!mediaDb[0]) {
        throw new InvalidInputError("Media no encontrado");
      }

      // Crear la escuela
      const schoolDb = await client.query(queries.createSchool, [
        name,
        mediaId,
      ]);
      if (!schoolDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      await client.commit();

      const schoolBase = parseSchoolFromDb(schoolDb[0] as DB_Schools);
      const media = parseMediaFromDb(mediaDb[0] as DB_Media);
      return { school: { ...schoolBase, media } };
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  }

  // Gestión de categorías
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
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.begin();

      // Si hay parentId, verificar que existe
      if (parentId) {
        const parentDb = await client.query(queries.categoryById, [parentId]);
        if (!parentDb[0]) {
          throw new InvalidInputError("Categoría padre no encontrada");
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

      await client.commit();

      const categoryBase = parseCategoryBaseFromDb(
        categoryDb[0] as DB_Categories,
      );
      return { category: categoryBase };
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
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
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.begin();

      // Verificar que la categoría existe
      const categoryDb = await client.query(queries.categoryById, [categoryId]);
      if (!categoryDb[0]) {
        throw new InvalidInputError("Categoría no encontrada");
      }

      // Si hay parentId, verificar que existe
      if (parentId) {
        const parentDb = await client.query(queries.categoryById, [parentId]);
        if (!parentDb[0]) {
          throw new InvalidInputError("Categoría padre no encontrada");
        }
      }

      const updatedCategoryDb = await client.query(queries.updateCategory, [
        name !== undefined ? name : categoryDb[0].name,
        description !== undefined ? description : categoryDb[0].description,
        parentId !== undefined ? parentId : categoryDb[0].parent_id,
        icon !== undefined ? icon : categoryDb[0].icon,
        minPriceCredits !== undefined
          ? minPriceCredits
          : categoryDb[0].min_price_credits,
        maxPriceCredits !== undefined
          ? maxPriceCredits
          : categoryDb[0].max_price_credits,
        statKgWaste !== undefined ? statKgWaste : categoryDb[0].stat_kg_waste,
        statKgCo2 !== undefined ? statKgCo2 : categoryDb[0].stat_kg_co2,
        statLH2o !== undefined ? statLH2o : categoryDb[0].stat_l_h2o,
        categoryId,
      ]);

      await client.commit();

      const categoryBase = parseCategoryBaseFromDb(
        updatedCategoryDb[0] as DB_Categories,
      );
      return { category: categoryBase };
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  }

  // Gestión de notificaciones
  static async sendNotification({
    userId,
    type,
    payload,
  }: {
    userId: UUID;
    type: NotificationType;
    payload: Record<string, unknown>;
  }) {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.begin();

      // Verificar que el usuario existe
      const userDb = await client.query(queries.userById, [userId]);
      if (!userDb[0]) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      const notificationDb = await client.query(queries.createNotification, [
        userId,
        type,
        JSON.stringify(payload),
      ]);

      await client.commit();

      const notificationBase = parseNotificationBaseFromDb(
        notificationDb[0] as DB_Notifications,
      );
      return { notification: notificationBase };
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  }

  // Estadísticas
  static async getStats() {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const statsDb = await client.query(queries.getGlobalStats);
      const stats = statsDb.reduce(
        (acc: Record<string, number>, row: DB_GlobalStats) => {
          acc[row.stat_name] = Number(row.stat_value);
          return acc;
        },
        {},
      );

      return { stats };
    } finally {
      client.release();
    }
  }

  static async getSchoolStats() {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const schoolsDb = await client.query(queries.getSchoolStats);
      const schools = schoolsDb.map((row: DB_Schools) => ({
        id: row.id,
        name: row.name,
        statKgWaste: row.stat_kg_waste ? Number(row.stat_kg_waste) : 0,
        statKgCo2: row.stat_kg_co2 ? Number(row.stat_kg_co2) : 0,
        statLH2o: row.stat_l_h2o ? Number(row.stat_l_h2o) : 0,
      }));

      return { schools };
    } finally {
      client.release();
    }
  }

  // Gestión de mission templates
  static async getMissionTemplates() {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const missionTemplatesDb = await client.query(
        queries.allMissionTemplates,
        [],
      );

      const missionTemplates = missionTemplatesDb.map((row) =>
        parseMissionTemplateFromDb(row as DB_MissionTemplates),
      );

      return { missionTemplates };
    } finally {
      client.release();
    }
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
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.begin();

      // Verificar que el key no exista
      const existingMission = await client.query(queries.missionTemplateByKey, [
        key,
      ]);
      if (existingMission[0]) {
        throw new ConflictError(ERROR_MESSAGES.MISSION_KEY_ALREADY_EXISTS);
      }

      const missionTemplateDb = await client.query(
        queries.createMissionTemplate,
        [key, title, description || null, rewardCredits, active],
      );

      if (!missionTemplateDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
      }

      const missionTemplate = parseMissionTemplateFromDb(missionTemplateDb[0]);

      // Asignar la misión a todos los usuarios existentes
      await assignMissionToAllUsers({
        client,
        missionTemplateId: missionTemplate.id,
      });

      await client.commit();

      return { missionTemplate };
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
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
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.begin();

      // Verificar que la misión existe
      const missionDb = await client.query(queries.missionTemplateById, [
        missionTemplateId,
      ]);
      if (!missionDb[0]) {
        throw new InvalidInputError(ERROR_MESSAGES.MISSION_NOT_FOUND);
      }

      const updatedMissionDb = await client.query(
        queries.updateMissionTemplate,
        [
          title !== undefined ? title : missionDb[0].title,
          description !== undefined ? description : missionDb[0].description,
          rewardCredits !== undefined
            ? rewardCredits
            : missionDb[0].reward_credits,
          active !== undefined ? active : missionDb[0].active,
          missionTemplateId,
        ],
      );

      if (!updatedMissionDb[0]) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
      }

      await client.commit();

      const missionTemplate = parseMissionTemplateFromDb(updatedMissionDb[0]);

      return { missionTemplate };
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  }
}
