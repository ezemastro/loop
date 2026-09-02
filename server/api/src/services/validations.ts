import z from "zod";
import {
  DONATION_MAX_CREDITS,
  DONATION_MIN_CREDITS,
  MAX_CREDITS,
  MAX_TRADE_LISTINGS,
  PAGE_SIZE,
} from "../config";
import { SORT_OPTIONS } from "../utils/sortOptions";
const LISTING_STATUS: ListingStatus[] = ["published", "offered", "accepted", "received"];
const NOTIFICATION_TYPES: NotificationType[] = ["mission", "loop", "donation", "admin"];
const TRANSACTION_TYPES: TransactionType[] = ["loop", "mission", "donation", "admin"];
const PRODUCT_STATUS: ProductStatus[] = ["like_new", "good", "fair"];

const firstNameSchema = z.string().min(2).max(100);
const lastNameSchema = z.string().min(2).max(100);
const emailSchema = z.email();
const phoneSchema = z.string().min(10).max(20);
/**
 * Mínimo de 8 caracteres para toda password **creada o cambiada** (SEC-03, D6). Nunca se usa en
 * un schema de *login*: un admin con una password de 6-7 caracteres, creada antes de este cambio,
 * tiene que poder seguir entrando. `adminLoginSchema` (más abajo) se queda deliberadamente en
 * `min(6)`.
 */
const passwordSchema = z.string().min(8).max(100);
const orderSchema = z.enum(["asc", "desc"]);
const sortSchema = z.enum(SORT_OPTIONS);

export const validateId = (data: unknown) => z.uuid().parseAsync(data);
export const safeValidateFirstName = (data: unknown) => firstNameSchema.safeParseAsync(data);
export const safeValidateLastName = (data: unknown) => lastNameSchema.safeParseAsync(data);
export const safeValidateEmail = (data: unknown) => emailSchema.safeParseAsync(data);
export const safeValidatePhone = (data: unknown) => phoneSchema.safeParseAsync(data);
export const safeValidatePassword = (data: unknown) => passwordSchema.safeParseAsync(data);
export const safeValidateUUID = (data: unknown) => z.uuid().safeParseAsync(data);

const mediaSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  mediaType: z.enum(["image", "video"]),
  mime: z.string().nullable().optional(),
});
const schoolSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(100),
  mediaId: z.uuid(),
  media: mediaSchema.optional(),
  meta: z.object({}).nullable().optional(),
});
export const validateSchool = (data: unknown) => schoolSchema.parseAsync(data);

const privateUserSchema = z.object({
  id: z.uuid(),
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  phone: phoneSchema.nullable(),
  profileMediaId: z.uuid().nullable(),
  profileMedia: mediaSchema.nullable(),
  credits: z.object({
    balance: z.number().nonnegative(),
    locked: z.number().nonnegative(),
  }),
  schools: z.array(schoolSchema),
});
export const validatePrivateUser = (data: unknown) => privateUserSchema.parseAsync(data);

const publicUserSchema = z.object({
  id: z.uuid(),
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  profileMediaId: z.uuid().nullable(),
  profileMedia: mediaSchema.nullable(),
  schools: z.array(schoolSchema),
});
export const validatePublicUser = (data: unknown) => publicUserSchema.parseAsync(data);
const categoryBaseSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(100),
  parentId: z.uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z
    .object({
      min: z.number().min(0).nullable().optional(),
      max: z.number().min(0).nullable().optional(),
    })
    .nullable(),
  icon: z.string().nullable().optional(),
  stats: z
    .object({
      kgWaste: z.number().min(0),
      kgCo2: z.number().min(0),
      lH2o: z.number().min(0),
    })
    .nullable(),
});
const categorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(100),
  parentId: z.uuid().nullable(),
  parents: z.array(categoryBaseSchema).nullable(),
  description: z.string().nullable(),
  price: z
    .object({
      min: z.number().min(0).nullable(),
      max: z.number().min(0).nullable(),
    })
    .nullable(),
  icon: z.string().nullable(),
  stats: z
    .object({
      kgWaste: z.number().min(0),
      kgCo2: z.number().min(0),
      lH2o: z.number().min(0),
    })
    .nullable(),
  children: z.array(z.lazy((): z.ZodTypeAny => categorySchema)).nullable(),
});
export const validateCategory = (data: unknown) => categorySchema.parseAsync(data);

const listingSchema = z.object({
  id: z.uuid(),
  sellerId: z.uuid(),
  seller: publicUserSchema,
  title: z.string().min(2).max(100),
  description: z.string().nullable(),
  categoryId: z.uuid(),
  category: categorySchema,
  priceCredits: z.number().min(0),
  status: z.enum(LISTING_STATUS),
  disabled: z.boolean(),
  buyerId: z.uuid().nullable(),
  buyer: publicUserSchema,
  offeredCredits: z.number().min(0).nullable(),
  media: z.array(mediaSchema).nullable(),
});
export const validateListing = (data: unknown) => listingSchema.parseAsync(data);

const walletTransactionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  type: z.enum(TRANSACTION_TYPES),
  positive: z.boolean(),
  amount: z.number().min(0),
  balanceAfter: z.number().min(0).nullable().optional(),
  referenceId: z.uuid().nullable().optional(),
  meta: z.object({}).nullable().optional(),
  createdAt: z.date(),
});
export const validateWalletTransaction = (data: unknown) =>
  walletTransactionSchema.parseAsync(data);

const missionTemplateSchema = z.object({
  id: z.uuid(),
  key: z.string().min(2).max(100),
  title: z.string().min(2).max(100),
  description: z.string().nullable().optional(),
  rewardCredits: z.number().min(0),
  active: z.boolean(),
  createdAt: z.date(),
});
export const validateMissionTemplate = (data: unknown) => missionTemplateSchema.parseAsync(data);

const userMissionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  missionTemplateId: z.uuid(),
  missionTemplate: missionTemplateSchema,
  completed: z.boolean(),
  completedAt: z.date().nullable().optional(),
  progress: z.object({}).optional(),
});
export const validateUserMission = (data: unknown) => userMissionSchema.parseAsync(data);

const notificationSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  createdAt: z.date(),
  isRead: z.boolean(),
  readAt: z.date().nullable().optional(),
  payload: z.union([
    z.object({
      missionId: z.string(),
      mission: userMissionSchema,
      reward: z.number().min(0),
    }),
    z.object({
      listingId: z.string(),
      listing: listingSchema,
      buyerId: z.uuid().optional().nullable(),
      buyer: publicUserSchema.optional().nullable(),
      offeredCredits: z.number().min(0).nullable().optional(),
      status: z.enum(LISTING_STATUS),
    }),
    z.object({
      donorUserId: z.uuid(),
      donorUser: publicUserSchema,
      amount: z.number().min(0),
      message: z.string().optional(),
    }),
    z.object({
      message: z.string().optional(),
      action: z.enum(["delete", "update", "credits"] as AdminActions[]),
      target: z
        .object({
          type: z.enum(["listing", "unknown"]),
          listingId: z.string().optional(),
          listing: listingSchema.optional(),
          text: z.string().optional(),
        })
        .optional(),
      amount: z.number().optional(),
    }),
  ]),
});
export const validateNotification = (data: unknown) => notificationSchema.parseAsync(data);

const messageSchema = z.object({
  id: z.uuid(),
  senderId: z.uuid(),
  sender: publicUserSchema.optional(),
  recipientId: z.uuid(),
  recipient: publicUserSchema.optional(),
  text: z.string().min(1).max(1000),
  createdAt: z.date(),
  attachedListingId: z.uuid().nullable().optional(),
  attachedListing: listingSchema.optional(),
});
export const validateMessage = (data: unknown) => messageSchema.parseAsync(data);

const registerSchema = z.object({
  password: passwordSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  schoolIds: z.array(z.uuid()).min(1),
  email: emailSchema,
  // Quien tiene correo institucional se registra sin esto, exactamente como antes.
  invitationToken: z.string().min(1).max(200).optional(),
});
export const validateRegister = (data: unknown) => registerSchema.parseAsync(data);

const loginSchema = z.object({
  email: z.email(),
  password: z.string().max(100),
});
export const validateLogin = (data: unknown) => loginSchema.parseAsync(data);

const resendVerificationSchema = z.object({
  email: z.email(),
});
export const validateResendVerification = (data: unknown) =>
  resendVerificationSchema.parseAsync(data);

/**
 * `.strict()` es deliberado: rechaza cualquier campo inesperado en vez de ignorarlo en silencio.
 * En particular deja afuera a `communityId`, que nunca se puede actualizar — la comunidad de una
 * cuenta la fija el dominio de su correo al registrarse.
 *
 * `email` tampoco está: si se pudiera cambiar libremente, el correo y la comunidad quedarían en
 * desacuerdo para siempre. No hay UI que lo use.
 */
const updateSelfSchema = z
  .object({
    firstName: firstNameSchema.optional(),
    lastName: lastNameSchema.optional(),
    phone: phoneSchema.optional(),
    profileMediaId: z.uuid().nullable().optional(),
    // `password` fue removido a propósito (SEC-06, D7): un perfil no puede cambiar su password por
    // esta vía. Como el schema es `.strict()`, mandarlo ahora **rechaza** el request entero en vez
    // de aceptarlo o ignorarlo en silencio — la falla queda visible, que es el punto. El cambio de
    // password real es `POST /me/change-password`, más abajo.
    schoolIds: z.array(z.uuid()).min(1).optional(),
  })
  .strict();
export const validateUpdateSelf = (data: unknown) => updateSelfSchema.parseAsync(data);

/**
 * Password actual + nueva, para `POST /me/change-password` (D7). `oldPassword` no usa
 * `passwordSchema`: la cuenta puede tener una password anterior a este cambio, más corta que el
 * mínimo nuevo, y sigue siendo la que hay que probar. `newPassword` sí usa `passwordSchema`, y por
 * lo tanto rechaza vacío y —después de que `trimBody` la recorta— también rechaza
 * "solo espacios".
 */
const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(100),
  newPassword: passwordSchema,
});
export const validateChangePassword = (data: unknown) => changePasswordSchema.parseAsync(data);

/**
 * Página y tamaño de página acotados (SEC-16, D9). El defecto real que cita el audit está
 * invertido: `page` ya estaba acotado abajo, `limit` era un `z.string()` sin cota que ningún
 * modelo consumía (el tamaño de página real era la constante `PAGE_SIZE`). `z.coerce.number()`
 * también es lo que hace que `page=Infinity` se rechace: hoy sobrevive a `safeNumber` y llega tal
 * cual a `(page - 1) * PAGE_SIZE`.
 */
const paginatedQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
    sort: sortSchema.optional(),
    order: orderSchema.optional(),
  })
  .strict();
export const validatePaginationParams = (data: unknown) => paginatedQuery.parseAsync(data);

const getRolesRequestQuery = paginatedQuery.extend({
  searchTerm: z.string().max(100).optional(),
});
export const validateGetRolesRequest = (data: unknown) => getRolesRequestQuery.parseAsync(data);
const getUsersRequestQuery = paginatedQuery.extend({
  searchTerm: z.string().max(100).optional(),
  schoolId: z.uuid().optional(),
  userId: z.uuid().optional(),
});
export const validateGetUsersRequest = (data: unknown) => getUsersRequestQuery.parseAsync(data);

/**
 * `controllers/admin.ts` parseaba `page` a mano (`page ? Number(page) : 1`), sin pasar por Zod
 * (SEC-16, D9). Nombres de query distintos de `getUsersRequestQuery` (`search` en vez de
 * `searchTerm`) porque así los manda hoy `adminClient`.
 */
const getAdminUsersRequestQuery = paginatedQuery.extend({
  search: z.string().max(100).optional(),
  communityId: z.uuid().optional(),
});
export const validateGetAdminUsersRequest = (data: unknown) =>
  getAdminUsersRequestQuery.parseAsync(data);
const getSchoolsRequestQuery = paginatedQuery.extend({
  searchTerm: z.string().max(100).optional(),
  // Para la pantalla de registro, que todavía no tiene sesión. Si hay sesión, se ignoran: la
  // comunidad del usuario siempre gana.
  communityId: z.uuid().optional(),
  domain: z.string().max(255).optional(),
});
export const validateGetSchoolsRequest = (data: unknown) => getSchoolsRequestQuery.parseAsync(data);
const getListingsRequestQuery = paginatedQuery.extend({
  searchTerm: z.string().max(100).optional(),
  categoryId: z.uuid().optional(),
  userId: z.uuid().optional(),
  sellerId: z.uuid().optional(),
  productStatus: z.enum(PRODUCT_STATUS).optional(),
  schoolId: z.uuid().optional(),
});
export const validateGetListingsRequest = (data: unknown) =>
  getListingsRequestQuery.parseAsync(data);
const postListingsRequestBody = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(1000).nullable(),
  price: z.number().min(0),
  categoryId: z.uuid(),
  productStatus: z.enum(PRODUCT_STATUS),
  mediaIds: z.array(z.uuid()).min(1).max(7),
});
export const validatePostListingsRequest = (data: unknown) =>
  postListingsRequestBody.parseAsync(data);
const patchListingsRequestBody = z.object({
  title: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).nullable(),
  price: z.number().min(0).optional(),
  categoryId: z.uuid().optional(),
  productStatus: z.enum(PRODUCT_STATUS).optional(),
  mediaIds: z.array(z.uuid()).min(1).max(7).optional(),
});
export const validatePatchListingsRequest = (data: unknown) =>
  patchListingsRequestBody.parseAsync(data);
const postMessageRequestBody = z.object({
  text: z.string().min(1).max(1000),
  attachedListingId: z.uuid().nullable().optional(),
});
export const validatePostMessageRequest = (data: unknown) =>
  postMessageRequestBody.parseAsync(data);
const getSelfListingsRequestQuery = paginatedQuery.extend({
  searchTerm: z.string().max(100).optional(),
  categoryId: z.uuid().optional(),
  productStatus: z.enum(PRODUCT_STATUS).optional(),
  listingStatus: z.enum(LISTING_STATUS).optional(),
  sellerId: z.uuid().optional(),
  buyerId: z.uuid().optional(),
});
export const validateGetSelfListingsRequest = (data: unknown) =>
  getSelfListingsRequestQuery.parseAsync(data);
const getSelfNotificationsRequestQuery = paginatedQuery;
export const validateGetSelfNotificationsRequest = (data: unknown) =>
  getSelfNotificationsRequestQuery.parseAsync(data);
const getSelfMessagesRequestQuery = paginatedQuery;
export const validateGetSelfMessagesRequest = (data: unknown) =>
  getSelfMessagesRequestQuery.parseAsync(data);
const updateTokenRequestBody = z.object({
  notificationToken: z.string().min(1).max(500),
});
export const validateUpdateTokenRequest = (data: unknown) =>
  updateTokenRequestBody.parseAsync(data);

const putSelfWishRequest = z.object({
  wishId: z.uuid(),
  comment: z.string().max(300).nullable().optional(),
  categoryId: z.uuid().optional(),
});
export const validatePutSelfWishRequest = (data: unknown) => putSelfWishRequest.parseAsync(data);
const postSelfWishRequest = z.object({
  categoryId: z.uuid(),
  comment: z.string().max(300).nullable().optional(),
});
export const validatePostSelfWishRequest = (data: unknown) => postSelfWishRequest.parseAsync(data);

// ADMIN
// El login de admin se queda deliberadamente en `min(6)` (D6, C13): subir el mínimo acá negaría
// el login a cualquier admin cuya password —creada antes de este cambio— tenga 6 o 7 caracteres.
// Nunca usar `passwordSchema` en un schema de login.
const adminLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(100),
});
export const validateAdminLogin = (data: unknown) => adminLoginSchema.parseAsync(data);
const adminGoogleLoginSchema = z.object({
  credential: z.string().min(1),
});
export const validateAdminGoogleLogin = (data: unknown) => adminGoogleLoginSchema.parseAsync(data);
const adminRegisterSchema = z.object({
  email: z.email(),
  fullName: z.string().min(2).max(100),
  // Alta de cuenta: usa el mínimo de 8 (D6), a diferencia del login de arriba.
  password: passwordSchema,
});
export const validateAdminRegister = (data: unknown) => adminRegisterSchema.parseAsync(data);

// Validación para Google Login de usuarios
const userGoogleLoginSchema = z.object({
  credential: z.string().min(1),
  schoolIds: z.array(z.uuid()).min(1).optional(),
  invitationToken: z.string().min(1).max(200).optional(),
});
export const validateUserGoogleLogin = (data: unknown) => userGoogleLoginSchema.parseAsync(data);

// ─── Admin: endpoints sin validar (SEC-07, D8) ─────────────────────────────
// Cinco endpoints de admin aceptaban `req.body` sin ningún schema
// (`controllers/admin.ts` tenía el comentario literal "No hay validaciones porque es
// administrador"). `amount` en particular era `any`: un valor negativo con `positive: true`
// llegaba a `increaseUserBalance` y restaba — manipulación de saldo arbitraria.

const modifyCreditsSchema = z
  .object({
    amount: z.number().int().positive().max(1_000_000),
    positive: z.boolean(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const validateModifyCredits = (data: unknown) => modifyCreditsSchema.parseAsync(data);

const resetUserPasswordSchema = z
  .object({
    newPassword: passwordSchema,
  })
  .strict();
export const validateResetUserPassword = (data: unknown) =>
  resetUserPasswordSchema.parseAsync(data);

/**
 * Union por `type`, siguiendo la forma real de `shared/types/app.d.ts:208-249`
 * (`MissionNotificationPayloadBase` / `LoopNotificationPayloadBase` /
 * `DonationNotificationPayloadBase` / `AdminNotificationPayloadBase`) — **no** la del union de
 * `notificationSchema` más arriba (`:169-210` en el original), que es un validador de
 * *respuesta* y ya está en desacuerdo con `app.d.ts` (espera `missionId`/`mission`/`reward` donde
 * el tipo dice `userMissionId`, y un `target` anidado donde el tipo lo tiene plano). Esa
 * discrepancia queda registrada como seguimiento, no resuelta acá.
 */
const loopNotificationTypeSchema = z.enum([
  "new_offer",
  "offer_accepted",
  "offer_rejected",
  "offer_deleted",
  "listing_sold",
  "listing_received",
  "listing_cancelled",
]);
const sendNotificationSchema = z
  .object({
    userId: z.uuid(),
  })
  .and(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("mission"),
        payload: z.object({ userMissionId: z.uuid() }).strict(),
      }),
      z.object({
        type: z.literal("loop"),
        payload: z
          .object({
            listingId: z.uuid(),
            buyerId: z.uuid().nullable(),
            toListingStatus: z.enum(LISTING_STATUS),
            toOfferedCredits: z.number().min(0).nullable(),
            type: loopNotificationTypeSchema,
          })
          .strict(),
      }),
      z.object({
        type: z.literal("donation"),
        payload: z
          .object({
            donorUserId: z.uuid(),
            amount: z.number().min(0),
            message: z.string().nullable(),
          })
          .strict(),
      }),
      z.object({
        type: z.literal("admin"),
        payload: z
          .object({
            message: z.string().nullable(),
            action: z.enum(["delete", "update", "credits"] as AdminActions[]),
            target: z.string().nullable(),
            referenceId: z.uuid().nullable(),
            amount: z.number().nullable(),
          })
          .strict(),
      }),
    ]),
  );
export const validateSendNotification = (data: unknown) => sendNotificationSchema.parseAsync(data);

const createSchoolSchema = z
  .object({
    name: z.string().min(1).max(200),
    mediaId: z.uuid(),
  })
  .strict();
export const validateCreateSchool = (data: unknown) => createSchoolSchema.parseAsync(data);

const updateSchoolSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    mediaId: z.uuid().optional(),
  })
  .strict();
export const validateUpdateSchool = (data: unknown) => updateSchoolSchema.parseAsync(data);

// ─── Comunidades ────────────────────────────────────────────────────────────

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color hexadecimal #RRGGBB");

/**
 * El tema se valida al escribirlo y nunca al leerlo: una comunidad guardada con una versión vieja
 * del esquema tiene que seguir renderizando, y el cliente ya cae a la paleta por defecto para las
 * claves que falten.
 */
const communityThemeSchema = z.object({
  colors: z.object({
    primary: hexColorSchema,
    secondary: hexColorSchema,
    tertiary: hexColorSchema,
    mainText: hexColorSchema,
    secondaryText: hexColorSchema,
    credits: hexColorSchema,
    creditsLight: hexColorSchema,
    stroke: hexColorSchema,
    background: hexColorSchema,
    alert: hexColorSchema,
  }),
});

const domainSchema = z
  .string()
  .min(3)
  .max(255)
  .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i, "Dominio inválido")
  .transform((value) => value.toLowerCase());

const createCommunitySchema = z.object({
  // El slug es inmutable después de crearse: se usa en URLs.
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Solo minúsculas, números y guiones"),
  name: z.string().min(2).max(100),
  mediaId: z.uuid().nullable().optional(),
  theme: communityThemeSchema.optional(),
  domains: z.array(domainSchema).optional(),
});
export const validateCreateCommunity = (data: unknown) => createCommunitySchema.parseAsync(data);

const updateCommunitySchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    mediaId: z.uuid().nullable().optional(),
    theme: communityThemeSchema.optional(),
    active: z.boolean().optional(),
  })
  .strict();
export const validateUpdateCommunity = (data: unknown) => updateCommunitySchema.parseAsync(data);

const communityDomainSchema = z.object({ domain: domainSchema });
export const validateCommunityDomain = (data: unknown) => communityDomainSchema.parseAsync(data);

const createInvitationSchema = z.object({
  communityId: z.uuid().optional(),
  note: z.string().max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export const validateCreateInvitation = (data: unknown) => createInvitationSchema.parseAsync(data);

const moveUserCommunitySchema = z.object({
  communityId: z.uuid(),
  schoolIds: z.array(z.uuid()).min(1),
});
export const validateMoveUserCommunity = (data: unknown) =>
  moveUserCommunitySchema.parseAsync(data);

const createMissionTemplateSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  rewardCredits: z.number().int().positive(),
  active: z.boolean(),
});
export const validateCreateMissionTemplate = (data: unknown) =>
  createMissionTemplateSchema.parseAsync(data);

const updateMissionTemplateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  rewardCredits: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});
export const validateUpdateMissionTemplate = (data: unknown) =>
  updateMissionTemplateSchema.parseAsync(data);

// ─── Legal / public routes (`legal-public-routes`) ─────────────────────────

const termsAcceptanceSchema = z.object({
  termsVersion: z.string().min(1).max(20),
});
export const validateTermsAcceptance = (data: unknown) => termsAcceptanceSchema.parseAsync(data);

const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export const validateForgotPassword = (data: unknown) => forgotPasswordSchema.parseAsync(data);

/**
 * `token` follows the opaque-token precedent already used for `invitationToken` above (`:226`):
 * a bound-length string, not a UUID — the reset token is 64 hex chars (32 random bytes).
 */
const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  newPassword: passwordSchema,
});
export const validateResetPassword = (data: unknown) => resetPasswordSchema.parseAsync(data);

// ─── credit-economy-integrity (ECO-04/ECO-08/ECO-10) ─────────────────────────
// Agregados al final a propósito: este archivo lo comparten varios bloques del audit y cada uno
// solo agrega sus propios schemas nuevos, sin reordenar ni tocar los existentes.

/**
 * `makeOffer` no tenía NINGÚN schema (design D12, "defectos que el audit no registra"):
 * `offeredCredits: undefined` pasaba las tres comparaciones en `models/listings.ts` porque todas
 * son `false` contra `undefined`. `.int()` es lo que cierra ECO-08 para este endpoint en particular
 * — `offered_credits` es `INTEGER` en la base, y un decimal llegaba a Postgres y tiraba un 500.
 */
const makeOfferRequestBody = z.object({
  price: z.number().int().min(0).max(MAX_CREDITS),
});
export const validateMakeOfferRequest = (data: unknown) => makeOfferRequestBody.parseAsync(data);

/**
 * Cada elemento ya se validaba como UUID uno por uno (`validateId` en el controller), pero no había
 * ningún schema de **array**: sin tope de cardinalidad y sin rechazo de duplicados, la misma
 * publicación tradeada dos veces se contaba dos veces (`models/listings.ts:564` en el código
 * anterior a esta reescritura).
 */
const tradingListingIdsSchema = z
  .array(z.uuid())
  .max(MAX_TRADE_LISTINGS)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "No se puede tradear la misma publicación dos veces",
  });
export const validateTradingListingIds = (data: unknown) =>
  tradingListingIdsSchema.parseAsync(data);

/**
 * Reemplaza el chequeo ad-hoc de `controllers/users.ts` (`typeof amount !== "number" || amount <=
 * 0`), que aceptaba decimales sobre una columna entera. Los límites salen de `config.ts`
 * (`DONATION_MIN_CREDITS`/`DONATION_MAX_CREDITS`); el tope diario se aplica aparte, contra el
 * ledger, porque depende de lo ya donado hoy y no de este único request.
 */
const donateRequestBody = z.object({
  amount: z.number().int().min(DONATION_MIN_CREDITS).max(DONATION_MAX_CREDITS),
});
export const validateDonateRequest = (data: unknown) => donateRequestBody.parseAsync(data);
