import { ERROR_MESSAGES, INITIAL_CREDITS } from "../config.js";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
} from "../services/errors.js";
import { comparePasswords, hashPassword } from "../services/hash.js";
import { dbConnection } from "../services/postgresClient.js";
import { queries } from "../services/queries.js";
import type { DatabaseClient } from "../types/dbClient.js";
import type { AuthLoginPayload, AuthRegisterPayload } from "../types/models.js";
import {
  parseSchoolFromDb,
  parseUserBaseFromDb,
  parseMediaFromDb,
  parseRoleFromDb,
  parseSchoolFromBase,
  parsePrivateUserFromBase,
} from "../utils/parseDb.js";

export class AuthModel {
  static registerUser = async ({
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
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Realizar la consulta para verificar si el usuario ya existe
      const query = await client.query(queries.userExists, [
        email,
        firstName,
        lastName,
      ]);
      if (query[0]?.exists) {
        throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }
      // Obtener rol y escuela
      const [[schoolDb], [roleDb]] = await Promise.all([
        client.query(queries.schoolById, [schoolId]),
        client.query(queries.roleById, [roleId]),
      ]);

      if (!schoolDb) {
        throw new InvalidInputError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
      }
      if (!roleDb) {
        throw new InvalidInputError(ERROR_MESSAGES.ROLE_NOT_FOUND);
      }
      const [schoolMediaDb] = await client.query(queries.mediaById, [
        schoolDb.media_id,
      ]);
      if (!schoolMediaDb) {
        throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
      }
      const school = parseSchoolFromDb(schoolDb);
      const role = parseRoleFromDb(roleDb);
      const schoolMedia = parseMediaFromDb(schoolMediaDb);
      // Encriptar la contraseña
      const hashedPassword = await hashPassword(password);
      // Insertar el nuevo usuario en la base de datos
      const [newUser] = await client.query(queries.insertUser, [
        email,
        firstName,
        lastName,
        hashedPassword,
        schoolId,
        roleId,
      ]);
      // Devolver el usuario creado
      const user: PrivateUser = parsePrivateUserFromBase({
        user: {
          id: newUser!.id,
          email,
          firstName,
          lastName,
          phone: null,
          profileMediaId: null,
          roleId,
          schoolId,
          credits: {
            balance: INITIAL_CREDITS,
            locked: 0,
          },
        },
        profileMedia: null,
        role,
        school: parseSchoolFromBase({ school, media: schoolMedia }),
      });
      return { user };
    } finally {
      // Liberar cliente aunque independientemente de si hubo error
      client.release();
    }
  };

  static loginUser = async ({ email, password }: AuthLoginPayload) => {
    // Iniciar conexión con la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Realizar la consulta para verificar si el usuario existe
      const [userDb] = await client.query(queries.userByEmail, [email]);
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
      let profileMedia, school, role, schoolMedia;
      try {
        [[profileMedia], [school], [role]] = await Promise.all([
          client.query(queries.mediaById, [userDb.profile_media_id]),
          client.query(queries.schoolById, [userDb.school_id]),
          client.query(queries.roleById, [userDb.role_id]),
        ]);
        if (school) {
          [schoolMedia] = await client.query(queries.mediaById, [
            school.media_id,
          ]);
        }
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (
        !school ||
        !role ||
        (!profileMedia && userDb.profile_media_id) ||
        !schoolMedia
      ) {
        throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
      }
      // Devolver el usuario autenticado
      const user: PrivateUser = {
        ...parseUserBaseFromDb(userDb),
        profileMedia: userDb.profile_media_id
          ? parseMediaFromDb(profileMedia!)
          : null,
        school: parseSchoolFromBase({
          school: parseSchoolFromDb(school),
          media: parseMediaFromDb(schoolMedia),
        }),
        role: parseRoleFromDb(role),
      };
      return { user };
    } finally {
      // Asegurarse de liberar el cliente en caso de error
      client.release();
    }
  };
}
