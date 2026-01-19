import {
  ERROR_MESSAGES,
  INITIAL_CREDITS,
  VALID_EMAIL_DOMAINS,
  ANDROID_GOOGLE_CLIENT_ID,
  IOS_GOOGLE_CLIENT_ID,
  WEB_GOOGLE_CLIENT_ID,
} from "../config.js";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  StepRequired,
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
import {
  webGoogleClient,
} from "../services/googleOauth.js";

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
          stats: { kgWaste: 0, kgCo2: 0, lH2o: 0 },
          notificationToken: null,
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
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      // Verificar si el usuario tiene contraseña (no es OAuth)
      if (!userDb.password) {
        throw new InvalidInputError(ERROR_MESSAGES.INCORRECT_LOGIN_METHOD);
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

  static googleLogin = async ({
    credential,
    schoolIds,
  }: {
    credential: string;
    schoolIds?: UUID[];
  }) => {
    // Conectarse a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }

    try {
      // Verificar el token de Google
      const ticket = await webGoogleClient.verifyIdToken({
        idToken: credential,
        audience: WEB_GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID);
      }

      // Obtener información del usuario
      const googleId = payload.sub;
      const email = payload.email;
      const emailVerified = payload.email_verified;
      const fullName = payload.name;
      const givenName = payload.given_name;
      const familyName = payload.family_name;

      // Verificar si el email está verificado
      if (!emailVerified) {
        throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_EMAIL_NOT_VERIFIED);
      }

      // Verificar si el email es válido según los dominios permitidos
      const emailLower = email!.toLowerCase();
      const isValidEmail = VALID_EMAIL_DOMAINS.some((domain) =>
        emailLower.endsWith(`@${domain}`),
      );
      if (!isValidEmail) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
      }

      // Verificar si el usuario ya existe
      let userDb: DB_Users | undefined;

      // Primero buscar por google_id
      [userDb] = await client.query(queries.userByGoogleId, [googleId]);

      // Si no existe por google_id, buscar por email
      if (!userDb) {
        [userDb] = await client.query(queries.userByEmail, [email]);

        // Si existe un usuario con ese email pero sin google_id, actualizarlo
        if (userDb) {
          await client.query(queries.updateUserGoogleId, [googleId, userDb.id]);
          userDb.google_id = googleId;
        }
      }

      let user: PrivateUser;

      // Si no existe el usuario, crearlo
      if (!userDb) {
        await client.begin();

        try {
          // Si no envió schoolIds, error pidiendo que las envíe
          if (!schoolIds || schoolIds.length === 0) {
            throw new StepRequired(
              ERROR_MESSAGES.SCHOOL_IDS_REQUIRED_FOR_GOOGLE_SIGNUP,
            );
          }
          // Validar escuelas
          const schoolsDb = await Promise.all(
            schoolIds.map(async (schoolId: UUID) => {
              const [schoolDb] = await client.query(queries.schoolById, [
                schoolId,
              ]);
              if (!schoolDb) {
                throw new InvalidInputError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
              }
              return schoolDb;
            }),
          );

          // Crear el nuevo usuario con Google ID
          const [newUserDb] = await client.query(queries.createUserWithGoogle, [
            email,
            givenName || fullName,
            familyName || "",
            googleId,
          ]);

          if (!newUserDb) {
            throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
          }

          // Insertar las relaciones usuario-escuela
          for (const schoolId of schoolIds) {
            await client.query(
              {
                key: "user_schools.insert",
                text: `INSERT INTO user_schools (user_id, school_id) VALUES ($1, $2)`,
              },
              [newUserDb.id, schoolId],
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

          // Crear el objeto usuario
          user = parsePrivateUserFromBase({
            user: parseUserBaseFromDb(newUserDb),
            profileMedia: null,
            schools,
          });

          // Asignar misiones iniciales al usuario
          await assignAllMissionsToUser({ client, userId: newUserDb.id });

          await client.commit();
        } catch (error) {
          await client.rollback();
          throw error;
        }
      } else {
        // Usuario existente - iniciar sesión
        // Verificar que el google_id coincida
        if (userDb.google_id !== googleId) {
          throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_ID_MISMATCH);
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

        // Crear el objeto usuario
        user = parsePrivateUserFromBase({
          user: parseUserBaseFromDb(userDb),
          profileMedia,
          schools,
        });
      }

      return { user };
    } finally {
      client.release();
    }
  };
}
