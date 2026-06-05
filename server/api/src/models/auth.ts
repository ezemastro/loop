import {
  ERROR_MESSAGES,
  INITIAL_CREDITS,
  VALID_EMAIL_DOMAINS,
  WEB_GOOGLE_CLIENT_ID,
} from "../config.js";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  StepRequired,
  UnauthorizedError,
} from "../services/errors.js";
import { comparePasswords, hashPassword } from "../services/hash.js";
import { withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries.js";
import type { AuthLoginPayload, AuthRegisterPayload } from "../types/models.js";
import {
  assignAllMissionsToUser,
  getSchoolsByIds,
  getUserSchools,
} from "../utils/helpersDb.js";
import {
  parseUserBaseFromDb,
  parseMediaFromDb,
  parsePrivateUserFromBase,
} from "../utils/parseDb.js";
import { webGoogleClient } from "../services/googleOauth.js";

export class AuthModel {
  static registerUser = async ({
    firstName,
    lastName,
    password,
    schoolIds,
    email,
  }: AuthRegisterPayload) => {
    return withClient(
      async (client) => {
        await client.begin();

        const query = await client.query(queries.userExists, [email]);
        if (query[0]?.user_exists) {
          throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS, "USER_ALREADY_EXISTS");
        }

        const emailLower = email.toLowerCase();
        const isValidEmail = VALID_EMAIL_DOMAINS.some((domain) =>
          emailLower.endsWith(`@${domain}`),
        );
        if (!isValidEmail) {
          throw new InvalidInputError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED, "EMAIL_NOT_AUTHORIZED");
        }

        const schools = await getSchoolsByIds({ client, schoolIds });

        const hashedPassword = await hashPassword(password);

        const [newUser] = await client.query(queries.insertUser, [
          email,
          firstName,
          lastName,
          hashedPassword,
        ]);

        if (!newUser) {
          throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
        }

        await client.query(queries.insertUserSchools(schoolIds.length), [
          newUser.id,
          ...schoolIds,
        ]);

        await assignAllMissionsToUser({ client, userId: newUser.id });

        const user: PrivateUser = parsePrivateUserFromBase({
          user: {
            id: newUser.id,
            email,
            firstName,
            lastName,
            phone: null,
            profileMediaId: null,
            credits: { balance: INITIAL_CREDITS, locked: 0 },
            stats: { kgWaste: 0, kgCo2: 0, lH2o: 0 },
            notificationToken: null,
          },
          profileMedia: null,
          schools,
        });

        return { user };
      },
      { transaction: true },
    );
  };

  static loginUser = async ({ email, password }: AuthLoginPayload) => {
    return withClient(async (client) => {
      const [userDb] = await client.query(queries.userByEmail, [email]);
      if (!userDb) {
        throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND, "USER_NOT_FOUND");
      }

      if (!userDb.password) {
        throw new UnauthorizedError(ERROR_MESSAGES.INCORRECT_LOGIN_METHOD, "INCORRECT_LOGIN_METHOD");
      }

      const isPasswordCorrect = await comparePasswords(password, userDb.password);
      if (!isPasswordCorrect) {
        throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS, "INVALID_CREDENTIALS");
      }

      let profileMedia = null;
      if (userDb.profile_media_id) {
        const [profileMediaDb] = await client.query(queries.mediaById, [userDb.profile_media_id]);
        if (profileMediaDb) profileMedia = parseMediaFromDb(profileMediaDb);
      }

      const schools = await getUserSchools({ client, userId: userDb.id });

      const user: PrivateUser = parsePrivateUserFromBase({
        user: parseUserBaseFromDb(userDb),
        profileMedia,
        schools,
      });

      return { user };
    });
  };

  static googleLogin = async ({
    credential,
    schoolIds,
  }: {
    credential: string;
    schoolIds?: UUID[];
  }) => {
    const ticket = await webGoogleClient.verifyIdToken({
      idToken: credential,
      audience: WEB_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID, "GOOGLE_CREDENTIAL_INVALID");
    }

    const googleId = payload.sub;
    const email = payload.email;
    const emailVerified = payload.email_verified;
    const fullName = payload.name;
    const givenName = payload.given_name;
    const familyName = payload.family_name;

    if (!emailVerified) {
      throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_EMAIL_NOT_VERIFIED, "GOOGLE_EMAIL_NOT_VERIFIED");
    }

    const emailLower = email!.toLowerCase();
    const isValidEmail = VALID_EMAIL_DOMAINS.some((domain) => emailLower.endsWith(`@${domain}`));
    if (!isValidEmail) {
      throw new InvalidInputError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED, "EMAIL_NOT_AUTHORIZED");
    }

    // Buscar usuario existente primero (sin DB)
    return withClient(async (client) => {
      let userDb: DB_Users | undefined;
      [userDb] = await client.query(queries.userByGoogleId, [googleId]);

      if (!userDb) {
        [userDb] = await client.query(queries.userByEmail, [email]);
        if (userDb) {
          await client.query(queries.updateUserGoogleId, [googleId, userDb.id]);
          userDb.google_id = googleId;
        }
      }

      // Usuario existente — login normal
      if (userDb) {
        if (userDb.google_id !== googleId) {
          throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_ID_MISMATCH, "GOOGLE_ID_MISMATCH");
        }

        let profileMedia = null;
        if (userDb.profile_media_id) {
          const [profileMediaDb] = await client.query(queries.mediaById, [userDb.profile_media_id]);
          if (profileMediaDb) profileMedia = parseMediaFromDb(profileMediaDb);
        }

        const schools = await getUserSchools({ client, userId: userDb.id });

        const user = parsePrivateUserFromBase({
          user: parseUserBaseFromDb(userDb),
          profileMedia,
          schools,
        });

        return { user };
      }

      // Usuario nuevo — requiere schoolIds
      if (!schoolIds || schoolIds.length === 0) {
        throw new StepRequired(ERROR_MESSAGES.SCHOOL_IDS_REQUIRED_FOR_GOOGLE_SIGNUP);
      }

      // Crear usuario con transacción
      return withClient(
        async (txClient) => {
          const [newUserDb] = await txClient.query(queries.createUserWithGoogle, [
            email,
            givenName || fullName,
            familyName || "",
            googleId,
          ]);

          if (!newUserDb) {
            throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR, "DATABASE_QUERY_ERROR");
          }

          await txClient.query(queries.insertUserSchools(schoolIds.length), [
            newUserDb.id,
            ...schoolIds,
          ]);

          await assignAllMissionsToUser({ client: txClient, userId: newUserDb.id });

          const schools = await getSchoolsByIds({ client: txClient, schoolIds });

          return {
            user: parsePrivateUserFromBase({
              user: parseUserBaseFromDb(newUserDb),
              profileMedia: null,
              schools,
            }),
          };
        },
        { transaction: true },
      );
    });
  };
}
