import { ERROR_MESSAGES, INITIAL_CREDITS, REQUIRE_EMAIL_VERIFICATION } from "../config.js";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  StepRequired,
  UnauthorizedError,
} from "../services/errors.js";
import { comparePasswords, hashPassword } from "../services/hash.js";
import { inCommunity, unscoped, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries.js";
import type { DatabaseClient } from "../types/dbClient.js";
import type { AuthLoginPayload, AuthRegisterPayload } from "../types/models.js";
import {
  areSchoolsInCommunity,
  emailBelongsToCommunity,
  getCommunityByIdWithClient,
  resolveCommunityByEmail,
} from "../utils/communities.js";
import { assignAllMissionsToUser, getUserSchools } from "../utils/helpersDb.js";
import { consumeInvitation, lockInvitation } from "../utils/invitations.js";
import {
  parseMediaFromDb,
  parsePrivateUserFromBase,
  parseUserBaseFromDb,
} from "../utils/parseDb.js";
import { END_USER_AUDIENCES, webGoogleClient } from "../services/googleOauth.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.js";
import { isUniqueViolation } from "../services/pgErrors.js";
import crypto from "crypto";

/**
 * El link de verificación lleva el token en cleartext (es lo que el usuario clickea); la base solo
 * guarda su digest SHA-256 (migración 0012, SEC-10). Nunca se persiste ni se loguea el cleartext.
 */
const hashVerificationToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * Arma el `PrivateUser` de la respuesta: perfil, colegios y comunidad.
 *
 * La comunidad viaja hidratada porque es de donde el cliente saca la paleta y el logo con los que
 * se pinta la app; es el único usuario del que se manda ese objeto completo.
 */
const buildPrivateUser = async ({
  client,
  userDb,
}: {
  client: DatabaseClient;
  userDb: DB_Users;
}): Promise<PrivateUser> => {
  let profileMedia: Media | null = null;
  if (userDb.profile_media_id) {
    const [profileMediaDb] = await client.query(queries.mediaById, [
      userDb.profile_media_id,
      client.communityId,
    ]);
    if (profileMediaDb) profileMedia = parseMediaFromDb(profileMediaDb);
  }

  const schools = await getUserSchools({ client, userId: userDb.id });

  const community = await getCommunityByIdWithClient({
    client,
    communityId: userDb.community_id,
  });
  if (!community) {
    throw new InternalServerError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND, "COMMUNITY_NOT_FOUND");
  }

  return parsePrivateUserFromBase({
    user: parseUserBaseFromDb(userDb),
    profileMedia,
    schools,
    community,
  });
};

/**
 * Regla de dominio en el login.
 *
 * Hasta ahora el login **no validaba el dominio en absoluto** (era un TODO pendiente): alcanzaba con
 * haberse registrado alguna vez. Ahora se valida contra los dominios de la comunidad del usuario,
 * salvo que haya entrado por invitación (`domain_exempt`), que es precisamente el caso para el que
 * existen las invitaciones.
 */
const assertUserMayLogIn = async ({
  client,
  userDb,
}: {
  client: DatabaseClient;
  userDb: DB_Users;
}) => {
  if (userDb.domain_exempt) return;

  const belongs = await emailBelongsToCommunity({
    client,
    email: userDb.email,
    communityId: userDb.community_id,
  });
  if (!belongs) {
    throw new UnauthorizedError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED, "EMAIL_NOT_AUTHORIZED");
  }
};

/**
 * Decide a qué comunidad entra alguien que se está registrando.
 *
 * Con invitación manda la comunidad del admin que la generó; sin invitación, el dominio del correo.
 * Devuelve también el id de la invitación, que se guarda en el usuario para auditoría.
 */
const resolveSignupCommunity = async ({
  email,
  invitationToken,
}: {
  email: string;
  invitationToken?: string | undefined;
}): Promise<{ communityId: UUID; invitationId: UUID | null }> => {
  if (invitationToken) {
    // Lectura preliminar, solo para saber con qué comunidad abrir la transacción. La verificación
    // que cuenta —la que bloquea la fila y garantiza el uso único— se hace adentro, con FOR UPDATE.
    const invitation = await withClient(
      async (client) => {
        const [row] = await client.query(queries.invitationByToken, [invitationToken]);
        return row ?? null;
      },
      { scope: unscoped("token-lookup") },
    );
    if (!invitation) {
      throw new InvalidInputError(ERROR_MESSAGES.INVITATION_INVALID, "INVITATION_INVALID");
    }
    if (invitation.used_by_user_id) {
      throw new ConflictError(ERROR_MESSAGES.INVITATION_ALREADY_USED, "INVITATION_ALREADY_USED");
    }
    return { communityId: invitation.community_id, invitationId: invitation.id };
  }

  const community = await resolveCommunityByEmail(email);
  if (!community) {
    throw new InvalidInputError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED, "EMAIL_NOT_AUTHORIZED");
  }
  return { communityId: community.id, invitationId: null };
};

export class AuthModel {
  static registerUser = async ({
    firstName,
    lastName,
    password,
    schoolIds,
    email,
    invitationToken,
  }: AuthRegisterPayload) => {
    // El email es único a nivel global: como los dominios son disjuntos entre comunidades, no
    // existe el caso legítimo de la misma dirección en dos comunidades distintas.
    const exists = await withClient(
      async (client) => {
        const [row] = await client.query(queries.userExists, [email]);
        return !!row?.user_exists;
      },
      { scope: unscoped("auth:lookup-user") },
    );
    if (exists) {
      throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS, "USER_ALREADY_EXISTS");
    }

    const { communityId } = await resolveSignupCommunity({ email, invitationToken });

    // Sin proveedor de mail el paso no se podría cumplir, así que por defecto la cuenta nace
    // verificada. `REQUIRE_EMAIL_VERIFICATION` permite exigirlo igual (dev y tests: el link queda
    // en el log del api en vez de salir por mail).
    const requireEmailVerification = REQUIRE_EMAIL_VERIFICATION;

    // Token que viaja en el link del mail de verificación. Solo la persona que controla la casilla
    // puede confirmar la cuenta; el login queda bloqueado hasta entonces.
    const verificationToken = requireEmailVerification
      ? crypto.randomBytes(32).toString("hex")
      : null;

    return withClient(
      async (client) => {
        // Reserva definitiva de la invitación: bloquea la fila hasta el commit.
        const invitation = await lockInvitation({ client, token: invitationToken });

        const schoolsOk = await areSchoolsInCommunity({ client, schoolIds, communityId });
        if (!schoolsOk) {
          throw new InvalidInputError(
            ERROR_MESSAGES.SCHOOLS_NOT_IN_COMMUNITY,
            "SCHOOLS_NOT_IN_COMMUNITY",
          );
        }

        const hashedPassword = await hashPassword(password);

        let newUser: { id: UUID } | undefined;
        try {
          [newUser] = await client.query(queries.insertUser, [
            email,
            firstName,
            lastName,
            hashedPassword,
            communityId,
            invitation?.id ?? null,
            !!invitation,
            verificationToken ? hashVerificationToken(verificationToken) : null,
            !requireEmailVerification,
          ]);
        } catch (err) {
          // El pre-chequeo de arriba (`queries.userExists`) es TOCTOU por naturaleza: no bloquea
          // dos registros concurrentes para el mismo email. `idx_users_email_lower_uq` (0009) es la
          // enforcement real; acá se traduce su violación al mismo 409 que el pre-chequeo ya da.
          // Se discrimina por nombre de constraint: `users_google_id_key` es un choque distinto y
          // no debe reportarse como "el email ya existe".
          if (isUniqueViolation(err, "idx_users_email_lower_uq")) {
            throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS, "USER_ALREADY_EXISTS");
          }
          throw err;
        }
        if (!newUser) {
          throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
        }

        if (invitation) {
          await consumeInvitation({ client, invitationId: invitation.id, userId: newUser.id });
        }

        await client.query(queries.insertUserSchools(schoolIds.length), [
          newUser.id,
          ...schoolIds,
          communityId,
        ]);

        await assignAllMissionsToUser({ client, userId: newUser.id });

        const community = await getCommunityByIdWithClient({ client, communityId });
        if (!community) {
          throw new InternalServerError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND, "COMMUNITY_NOT_FOUND");
        }

        const schools = await getUserSchools({ client, userId: newUser.id });

        const user: PrivateUser = parsePrivateUserFromBase({
          user: {
            id: newUser.id,
            email,
            firstName,
            lastName,
            phone: null,
            profileMediaId: null,
            communityId,
            credits: { balance: INITIAL_CREDITS, locked: 0 },
            stats: { kgWaste: 0, kgCo2: 0, lH2o: 0 },
            notificationToken: null,
          },
          profileMedia: null,
          schools,
          community,
        });

        return { user };
      },
      { scope: inCommunity(communityId), transaction: true },
    ).then((result) => {
      // El mail se manda después del commit y sin bloquear la respuesta: si Resend falla, la
      // cuenta queda creada igual y el reenvío (POST /auth/resend-verification) cubre el caso.
      if (requireEmailVerification && verificationToken) {
        sendVerificationEmail({ to: email, token: verificationToken }).catch((err) =>
          console.error("[EMAIL] Error al enviar email de verificación:", err),
        );
      }
      return { ...result, requireEmailVerification };
    });
  };

  static loginUser = async ({ email, password }: AuthLoginPayload) => {
    // Búsqueda sin scope: todavía no sabemos de qué comunidad es.
    const userDb = await withClient(
      async (client) => {
        const [row] = await client.query(queries.userByEmail, [email]);
        return row ?? null;
      },
      { scope: unscoped("auth:lookup-user") },
    );

    // La comparación corre siempre, exista o no la cuenta y tenga o no password: así el tiempo de
    // respuesta y el código de error no distinguen "no existe", "es cuenta de Google sin
    // password" e "password incorrecta" (SEC-03, D5) — las tres colapsan en la misma respuesta.
    const isPasswordCorrect = await comparePasswords(password, userDb?.password ?? null);
    if (!userDb || !userDb.password || !isPasswordCorrect) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS, "INVALID_CREDENTIALS");
    }

    // Recién acá (después de validar la password) se avisa que falta verificar: quien no tiene la
    // password no puede distinguir EMAIL_NOT_VERIFIED de INVALID_CREDENTIALS, y así no se filtra
    // qué direcciones están registradas.
    if (!userDb.email_verified) {
      throw new UnauthorizedError(ERROR_MESSAGES.EMAIL_NOT_VERIFIED, "EMAIL_NOT_VERIFIED");
    }

    // A partir de acá ya sabemos la comunidad, así que se trabaja scopeado.
    return withClient(
      async (client) => {
        await assertUserMayLogIn({ client, userDb });
        return { user: await buildPrivateUser({ client, userDb }) };
      },
      { scope: inCommunity(userDb.community_id) },
    );
  };

  /**
   * Confirma la cuenta cuando el usuario hace clic en el enlace del mail.
   *
   * Se ejecuta sin scope: el token de 32 bytes aleatorios ES la credencial, igual que el jwt en
   * login o el token de invitación. Sin el token no hay fila que matchear, así que no hay forma de
   * tocar la fila de otro usuario.
   */
  static verifyEmail = async (token: string) => {
    return withClient(
      async (client) => {
        const [row] = await client.query(queries.verifyUserEmail, [hashVerificationToken(token)]);
        if (!row) {
          throw new InvalidInputError(
            ERROR_MESSAGES.EMAIL_VERIFICATION_TOKEN_INVALID,
            "EMAIL_VERIFICATION_TOKEN_INVALID",
          );
        }
        return { verified: true };
      },
      { scope: unscoped("token-lookup") },
    );
  };

  /**
   * Reenvío del mail de verificación (por ejemplo cuando el primero no llegó).
   *
   * La respuesta es la misma exista o no la cuenta, o esté o no verificada: así el endpoint no se
   * puede usar para enumerar qué direcciones están registradas.
   */
  static resendVerificationEmail = async ({ email }: { email: string }) => {
    const userDb = await withClient(
      async (client) => {
        const [row] = await client.query(queries.userEmailVerifiedAndTokenByEmail, [email]);
        return row ?? null;
      },
      { scope: unscoped("auth:lookup-user") },
    );

    if (!userDb || userDb.email_verified) {
      return { sent: false };
    }

    // Se rota el token para invalidar cualquier enlace anterior que haya quedado fuera de banda.
    const verificationToken = crypto.randomBytes(32).toString("hex");
    await withClient(
      async (client) => {
        await client.query(queries.updateUserVerificationToken, [
          hashVerificationToken(verificationToken),
          userDb.id,
        ]);
      },
      { scope: unscoped("token-lookup") },
    );

    sendVerificationEmail({ to: email, token: verificationToken }).catch((err) =>
      console.error("[EMAIL] Error al reenviar email de verificación:", err),
    );

    return { sent: true };
  };

  static googleLogin = async ({
    credential,
    schoolIds,
    invitationToken,
  }: {
    credential: string;
    schoolIds?: UUID[];
    invitationToken?: string;
  }) => {
    const ticket = await webGoogleClient.verifyIdToken({
      idToken: credential,
      audience: END_USER_AUDIENCES,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new InvalidInputError(
        ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID,
        "GOOGLE_CREDENTIAL_INVALID",
      );
    }

    const googleId = payload.sub;
    const email = payload.email;
    const emailVerified = payload.email_verified;
    const fullName = payload.name;
    const givenName = payload.given_name;
    const familyName = payload.family_name;

    if (!emailVerified || !email) {
      throw new InvalidInputError(
        ERROR_MESSAGES.GOOGLE_EMAIL_NOT_VERIFIED,
        "GOOGLE_EMAIL_NOT_VERIFIED",
      );
    }

    // Antes la validación de dominio estaba acá arriba, antes de tocar la base. Eso hacía imposible
    // que entrara un usuario exento (invitado), así que ahora se valida más abajo, una vez que
    // sabemos si el usuario ya existe y si está exento.
    const existingUserDb = await withClient(
      async (client) => {
        const [byGoogleId] = await client.query(queries.userByGoogleId, [googleId]);
        if (byGoogleId) return byGoogleId;

        const [byEmail] = await client.query(queries.userByEmail, [email]);
        if (byEmail) {
          await client.query(queries.updateUserGoogleId, [googleId, byEmail.id]);
          return { ...byEmail, google_id: googleId };
        }
        return null;
      },
      { scope: unscoped("auth:lookup-user") },
    );

    // ── Usuario existente: login normal ──────────────────────────────────────
    if (existingUserDb) {
      if (existingUserDb.google_id !== googleId) {
        throw new InvalidInputError(ERROR_MESSAGES.GOOGLE_ID_MISMATCH, "GOOGLE_ID_MISMATCH");
      }
      // La comunidad de un usuario existente es la que tiene guardada, no la que diga su dominio
      // ahora: si un dominio se reasigna a otra comunidad, los usuarios ya creados no se mueven.
      return withClient(
        async (client) => {
          await assertUserMayLogIn({ client, userDb: existingUserDb });
          return { user: await buildPrivateUser({ client, userDb: existingUserDb }) };
        },
        { scope: inCommunity(existingUserDb.community_id) },
      );
    }

    // ── Usuario nuevo ────────────────────────────────────────────────────────
    const { communityId } = await resolveSignupCommunity({ email, invitationToken });

    if (!schoolIds || schoolIds.length === 0) {
      // Falta elegir colegios. Se devuelve la comunidad ya resuelta para que el cliente pueda
      // filtrar la lista y previsualizar sus colores sin pedirla de nuevo.
      const community = await withClient(
        async (client) => getCommunityByIdWithClient({ client, communityId }),
        { scope: unscoped("public:communities") },
      );
      throw new StepRequired(
        ERROR_MESSAGES.SCHOOL_IDS_REQUIRED_FOR_GOOGLE_SIGNUP,
        "SCHOOL_IDS_REQUIRED",
        community ? ({ community } as unknown as JsonObject) : undefined,
      );
    }

    return withClient(
      async (client) => {
        const invitation = await lockInvitation({ client, token: invitationToken });

        const schoolsOk = await areSchoolsInCommunity({ client, schoolIds, communityId });
        if (!schoolsOk) {
          throw new InvalidInputError(
            ERROR_MESSAGES.SCHOOLS_NOT_IN_COMMUNITY,
            "SCHOOLS_NOT_IN_COMMUNITY",
          );
        }

        let newUserDb: DB_Users | undefined;
        try {
          [newUserDb] = await client.query(queries.createUserWithGoogle, [
            email,
            givenName || fullName,
            familyName || "",
            googleId,
            communityId,
            invitation?.id ?? null,
            !!invitation,
          ]);
        } catch (err) {
          // Misma carrera que en el registro por password: dos altas por Google para el mismo
          // email en simultáneo pasan ambas el lookup previo (`userByEmail`), y `0009` es lo único
          // que realmente lo impide.
          if (isUniqueViolation(err, "idx_users_email_lower_uq")) {
            throw new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS, "USER_ALREADY_EXISTS");
          }
          throw err;
        }
        if (!newUserDb) {
          throw new InternalServerError(
            ERROR_MESSAGES.DATABASE_QUERY_ERROR,
            "DATABASE_QUERY_ERROR",
          );
        }

        if (invitation) {
          await consumeInvitation({ client, invitationId: invitation.id, userId: newUserDb.id });
        }

        await client.query(queries.insertUserSchools(schoolIds.length), [
          newUserDb.id,
          ...schoolIds,
          communityId,
        ]);

        await assignAllMissionsToUser({ client, userId: newUserDb.id });

        return { user: await buildPrivateUser({ client, userDb: newUserDb }) };
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  /**
   * Reseteo de contraseña por email (SEC-11). Mirror de `resendVerificationEmail`: la respuesta
   * nunca revela si la cuenta existe, y el mail se manda fire-and-forget para no bloquear ni
   * fallar la respuesta si Resend está caído.
   */
  static requestPasswordReset = async ({ email }: { email: string }) => {
    const userDb = await withClient(
      async (client) => {
        const [row] = await client.query(queries.userByEmail, [email]);
        return row ?? null;
      },
      { scope: unscoped("auth:lookup-user") },
    );

    if (!userDb) return { sent: false };

    // Token de 32 bytes aleatorios, igual generación que el de verificación de email; se guarda
    // solo su digest SHA-256 (migración 0016, mismo patrón que 0012/SEC-10).
    const resetToken = crypto.randomBytes(32).toString("hex");
    await withClient(
      async (client) => {
        await client.query(queries.setPasswordResetToken, [
          hashVerificationToken(resetToken),
          userDb.id,
        ]);
      },
      { scope: unscoped("token-lookup") },
    );

    sendPasswordResetEmail({ to: email, token: resetToken }).catch((err) =>
      console.error("[EMAIL] Error al enviar email de reseteo de contraseña:", err),
    );

    return { sent: true };
  };

  /**
   * Consume el token y fija la contraseña nueva. Sin scope: el token de 32 bytes ES la
   * credencial, igual que `verifyEmail`. `queries.consumePasswordResetToken` es un único
   * `UPDATE ... RETURNING` atómico — matchea, valida vencimiento y limpia el token en la misma
   * sentencia, así dos envíos concurrentes con el mismo token no pueden ganar los dos.
   */
  static resetPassword = async ({ token, newPassword }: { token: string; newPassword: string }) => {
    const hashedPassword = await hashPassword(newPassword);
    return withClient(
      async (client) => {
        const [row] = await client.query(queries.consumePasswordResetToken, [
          hashedPassword,
          hashVerificationToken(token),
        ]);
        if (!row) {
          throw new InvalidInputError(
            ERROR_MESSAGES.PASSWORD_RESET_TOKEN_INVALID,
            "PASSWORD_RESET_TOKEN_INVALID",
          );
        }
        return { reset: true };
      },
      { scope: unscoped("token-lookup") },
    );
  };

  /** Datos públicos de una invitación: solo confirma que el link sirve. */
  static getInvitation = async ({ token }: { token: string }) => {
    return withClient(
      async (client) => {
        const [invitation] = await client.query(queries.invitationByToken, [token]);
        if (!invitation) {
          throw new InvalidInputError(ERROR_MESSAGES.INVITATION_INVALID, "INVITATION_INVALID");
        }
        if (invitation.used_by_user_id) {
          throw new ConflictError(
            ERROR_MESSAGES.INVITATION_ALREADY_USED,
            "INVITATION_ALREADY_USED",
          );
        }
        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
          throw new InvalidInputError(ERROR_MESSAGES.INVITATION_INVALID, "INVITATION_INVALID");
        }

        const community = await getCommunityByIdWithClient({
          client,
          communityId: invitation.community_id,
        });
        if (!community) {
          throw new InvalidInputError(ERROR_MESSAGES.INVITATION_INVALID, "INVITATION_INVALID");
        }

        // Se devuelve el id y la comunidad, nunca quién la creó ni el resto de los datos.
        return { invitation: { id: invitation.id, community } };
      },
      { scope: unscoped("token-lookup") },
    );
  };
}
