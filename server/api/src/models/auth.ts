import {
  ERROR_MESSAGES,
  INITIAL_CREDITS,
  VALID_EMAIL_DOMAINS,
} from "../config.js";
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
import { assignAllMissionsToUser } from "../utils/helpersDb.js";
import {
  parseSchoolFromDb,
  parseUserBaseFromDb,
  parseMediaFromDb,
  parseSchoolFromBase,
  parsePrivateUserFromBase,
} from "../utils/parseDb.js";

export class AuthModel {
  static registerUser = async ({
    firstName,
    lastName,
    password,
    schoolIds,
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
      await client.begin();
      // Realizar la consulta para verificar si el usuario ya existe
      const query = await client.query(queries.userExists, [email]);
      if (query[0]?.user_exists) {
        throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }
      // Validar escuelas
      const schoolsDb = await Promise.all(
        schoolIds.map(async (schoolId: UUID) => {
          const [schoolDb] = await client.query(queries.schoolById, [schoolId]);
          if (!schoolDb) {
            throw new InvalidInputError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
          }
          return schoolDb;
        }),
      );
      // Encriptar la contraseña
      const hashedPassword = await hashPassword(password);
      // Validar email
      const emailLower = email.toLowerCase();
      const isValidEmail = VALID_EMAIL_DOMAINS.some((domain) =>
        emailLower.endsWith(`@${domain}`),
      );
      if (!isValidEmail) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
      }
      // Insertar el nuevo usuario en la base de datos
      const [newUser] = await client.query(queries.insertUser, [
        email,
        firstName,
        lastName,
        hashedPassword,
      ]);
      // Insertar las relaciones usuario-escuela
      for (const schoolId of schoolIds) {
        if (!newUser) {
          throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
        }
        await client.query(
          {
            key: "user_schools.insert",
            text: `INSERT INTO user_schools (user_id, school_id) VALUES ($1, $2)`,
          },
          [newUser.id, schoolId],
        );
      }
      // Obtener las escuelas completas
      const schools = await Promise.all(
        schoolsDb.map(async (schoolDb) => {
          const [schoolMediaDb] = await client.query(queries.mediaById, [
            schoolDb.media_id,
          ]);
          if (!schoolMediaDb) {
            throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
          }
          const schoolBase = parseSchoolFromDb(schoolDb);
          const schoolMedia = parseMediaFromDb(schoolMediaDb);
          return parseSchoolFromBase({
            school: schoolBase,
            media: schoolMedia,
          });
        }),
      );
      // Devolver el usuario creado
      const user: PrivateUser = parsePrivateUserFromBase({
        user: {
          id: newUser!.id,
          email,
          firstName,
          lastName,
          phone: null,
          profileMediaId: null,
          credits: {
            balance: INITIAL_CREDITS,
            locked: 0,
          },
        },
        profileMedia: null,
        schools,
      });
      // Asignar misiones iniciales al usuario
      await assignAllMissionsToUser({ client, userId: newUser!.id });
      await client.commit();
      return { user };
    } catch (error) {
      await client.rollback();
      throw error;
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
      let profileMedia = null;
      if (userDb.profile_media_id) {
        const [profileMediaDb] = await client.query(queries.mediaById, [
          userDb.profile_media_id,
        ]);
        if (profileMediaDb) profileMedia = parseMediaFromDb(profileMediaDb);
      }
      // Obtener todas las escuelas del usuario
      const userSchoolsDb = await client.query(queries.userSchoolsByUserId, [
        userDb.id,
      ]);
      const schools = await Promise.all(
        userSchoolsDb.map(async (us: { school_id: UUID }) => {
          const [schoolDb] = await client.query(queries.schoolById, [
            us.school_id,
          ]);
          if (!schoolDb) {
            throw new InternalServerError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
          }
          const [schoolMediaDb] = await client.query(queries.mediaById, [
            schoolDb.media_id,
          ]);
          if (!schoolMediaDb) {
            throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
          }
          const schoolBase = parseSchoolFromDb(schoolDb);
          const schoolMedia = parseMediaFromDb(schoolMediaDb);
          return parseSchoolFromBase({
            school: schoolBase,
            media: schoolMedia,
          });
        }),
      );
      // Devolver el usuario autenticado
      const user: PrivateUser = parsePrivateUserFromBase({
        user: parseUserBaseFromDb(userDb),
        profileMedia,
        schools,
      });
      return { user };
    } finally {
      // Asegurarse de liberar el cliente en caso de error
      client.release();
    }
  };
}
