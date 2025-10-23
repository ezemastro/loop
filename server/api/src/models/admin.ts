import { dbConnection } from "../services/postgresClient";
import type { DatabaseClient } from "../types/dbClient";
import { ADMIN_PASS_TOKEN, ERROR_MESSAGES, PAGE_SIZE } from "../config";
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
} from "../utils/parseDb";
import { comparePasswords, hashPassword } from "../services/hash";

export class AdminModel {
  static async login({
    username,
    password,
  }: {
    username: string;
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
      const adminDb = await client.query(queries.adminByUsername, [username]);
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
    username,
    fullName,
    password,
    passToken,
  }: {
    username: string;
    fullName: string;
    password: string;
    passToken: string;
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
      const existingAdmin = await client.query(queries.adminByUsername, [
        username,
      ]);
      if (existingAdmin[0]) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }
      // Verificar el token de registro
      if (passToken !== ADMIN_PASS_TOKEN) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }
      // Hashear la contraseña
      const hashedPassword = await hashPassword(password);
      // Crear el nuevo administrador
      await client.begin();
      const newAdmin = await client.query(queries.createAdmin, [
        username,
        fullName,
        hashedPassword,
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
      let usersDb;
      let totalDb;

      if (search) {
        usersDb = await client.query(queries.adminSearchUsers, [
          `%${search}%`,
          PAGE_SIZE,
          offset,
        ]);
        totalDb = await client.query(queries.adminSearchUsersCount, [
          `%${search}%`,
        ]);
      } else {
        usersDb = await client.query(queries.getAllUsersAdmin, [
          PAGE_SIZE,
          offset,
        ]);
        totalDb = await client.query(queries.getAllUsersAdminCount);
      }

      const users = usersDb.map((row) => {
        return parseUserBaseFromDb(row as DB_Users);
      });
      const total = Number(totalDb[0]?.total || 0);

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

      await client.commit();

      const missionTemplate = parseMissionTemplateFromDb(missionTemplateDb[0]);

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
