import { dbConnection } from "../services/postgresClient";
import type { DatabaseClient } from "../types/dbClient";
import { ADMIN_PASS_TOKEN, ERROR_MESSAGES } from "../config";
import { InternalServerError, InvalidInputError } from "../services/errors";
import { queries } from "../services/queries";
import { parseAdminFromDb } from "../utils/parseDb";
import { comparePasswords } from "../services/hash";

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
        admin.password,
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
    password,
    passToken,
  }: {
    email: string;
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
      const existingAdmin = await client.query(queries.adminByEmail, [email]);
      if (existingAdmin[0]) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }
      // Verificar el token de registro
      if (passToken !== ADMIN_PASS_TOKEN) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }
      // Crear el nuevo administrador
      await client.begin();
      const newAdmin = await client.query(queries.createAdmin, [
        email,
        password,
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
}
