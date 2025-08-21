import { ERROR_MESSAGES, INITIAL_CREDITS } from "../config.js";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
} from "../services/errors.js";
import { comparePasswords, hashPassword } from "../services/hash.js";
import type {
  DatabaseClient,
  DatabaseConnection,
  Queries,
} from "../types/dbClient.js";
import type { AuthLoginPayload, AuthRegisterPayload } from "../types/models.js";
import {
  parseSchoolFromDb,
  parseProfileFromDb,
  parseMediaFromDb,
  parseRoleFromDb,
} from "../utils/parseDb.js";

export class AuthModel {
  private dbConnection: DatabaseConnection;
  private queries: Queries;
  constructor({
    dbConnection,
    queries,
  }: {
    dbConnection: DatabaseConnection;
    queries: Queries;
  }) {
    this.dbConnection = dbConnection;
    this.queries = queries;
  }
  registerUser = async ({
    firstName,
    lastName,
    password,
    schoolId,
    roleId,
    email,
  }: AuthRegisterPayload) => {
    // Iniciar conexión con la base de datos
    let client: DatabaseClient;
    try {
      client = await this.dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Realizar la consulta para verificar si el usuario ya existe
      const query = await client.query(this.queries.userExists, [
        email,
        firstName,
        lastName,
      ]);
      if (query[0]?.exists) {
        throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }
      // Obtener rol y escuela
      const [[schoolDb], [roleDb]] = await Promise.all([
        client.query(this.queries.schoolById, [schoolId]),
        client.query(this.queries.roleById, [roleId]),
      ]);

      if (!schoolDb) {
        throw new InvalidInputError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
      }
      if (!roleDb) {
        throw new InvalidInputError(ERROR_MESSAGES.ROLE_NOT_FOUND);
      }
      const school = parseSchoolFromDb(schoolDb);
      const role = parseRoleFromDb(roleDb);
      // Encriptar la contraseña
      const hashedPassword = await hashPassword(password);
      // Insertar el nuevo usuario en la base de datos
      const [newUser] = await client.query(this.queries.insertUser, [
        email,
        firstName,
        lastName,
        hashedPassword,
        schoolId,
        roleId,
      ]);
      // Devolver el usuario creado
      const profile: Profile = {
        id: newUser!.id,
        firstName,
        lastName,
        email,
        phone: null,
        schoolId,
        school,
        roleId,
        role,
        credits: {
          balance: INITIAL_CREDITS,
          locked: 0,
        },
        profileMediaId: null,
      };
      return { profile };
    } catch (error) {
      // Deshacer cambios si ocurre un error
      await client.rollback();
      if (
        error instanceof InvalidInputError ||
        error instanceof ConflictError
      ) {
        throw error;
      }
      console.error(error);
      throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      // Liberar cliente aunque independientemente de si hubo error
      client.release();
    }
  };

  loginUser = async ({ email, password }: AuthLoginPayload) => {
    // Iniciar conexión con la base de datos
    let client: DatabaseClient;
    try {
      client = await this.dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Realizar la consulta para verificar si el usuario existe
      const [userDb] = await client.query(this.queries.userByEmail, [email]);
      if (!userDb) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }
      // Verificar la contraseña
      const isPasswordCorrect = await comparePasswords(
        password,
        userDb.password,
      );
      if (!isPasswordCorrect) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }
      // Obtener información adicional del perfil
      let profileMedia, school, role;
      try {
        [[profileMedia], [school], [role]] = await Promise.all([
          client.query(this.queries.mediaById, [userDb.id]),
          client.query(this.queries.schoolById, [userDb.school_id]),
          client.query(this.queries.roleById, [userDb.role_id]),
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (!school || !role || (!profileMedia && userDb.profile_media_id)) {
        throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
      }
      // Devolver el usuario autenticado
      const profile: Profile = {
        ...parseProfileFromDb(userDb),
        profileMedia: userDb.profile_media_id
          ? parseMediaFromDb(profileMedia!)
          : null,
        school: parseSchoolFromDb(school),
        role: parseRoleFromDb(role),
      };
      return { profile };
    } catch (error) {
      // Manejar errores
      if (
        error instanceof InternalServerError ||
        error instanceof InvalidInputError
      ) {
        throw error;
      }
      console.error(error);
      throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      // Asegurarse de liberar el cliente en caso de error
      client.release();
    }
  };
}
