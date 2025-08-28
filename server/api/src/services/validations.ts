import z from "zod";
const LISTING_STATUS: ListingStatus[] = [
  "published",
  "offered",
  "accepted",
  "received",
];
const NOTIFICATION_TYPES: NotificationType[] = [
  "mission",
  "loop",
  "donation",
  "admin",
];
const TRANSACTION_TYPES: TransactionType[] = [
  "loop",
  "mission",
  "donation",
  "admin",
];
const PRODUCT_STATUS: ProductStatus[] = ["damaged", "new", "repaired", "used"];

const firstNameSchema = z.string().min(2).max(100);
const lastNameSchema = z.string().min(2).max(100);
const emailSchema = z.email();
const phoneSchema = z.string().min(10).max(20);
const passwordSchema = z.string().min(8).max(100);

export const validateId = (data: unknown) => z.uuid().parseAsync(data);
export const safeValidateFirstName = (data: unknown) =>
  firstNameSchema.safeParseAsync(data);
export const safeValidateLastName = (data: unknown) =>
  lastNameSchema.safeParseAsync(data);
export const safeValidateEmail = (data: unknown) =>
  emailSchema.safeParseAsync(data);
export const safeValidatePhone = (data: unknown) =>
  phoneSchema.safeParseAsync(data);
export const safeValidatePassword = (data: unknown) =>
  passwordSchema.safeParseAsync(data);
export const safeValidateUUID = (data: unknown) =>
  z.uuid().safeParseAsync(data);

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

const roleSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(50),
});
export const validateRole = (data: unknown) => roleSchema.parseAsync(data);

const privateUserSchema = z.object({
  id: z.uuid(),
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  phone: phoneSchema.nullable(),
  roleId: z.uuid(),
  role: roleSchema,
  schoolId: z.uuid(),
  school: schoolSchema,
  profileMediaId: z.uuid().nullable(),
  profileMedia: mediaSchema.nullable(),
  credits: z.object({
    balance: z.number().nonnegative(),
    locked: z.number().nonnegative(),
  }),
});
export const validatePrivateUser = (data: unknown) =>
  privateUserSchema.parseAsync(data);

const publicUserSchema = z.object({
  id: z.uuid(),
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  roleId: z.uuid(),
  role: roleSchema,
  schoolId: z.uuid(),
  school: schoolSchema,
  profileMediaId: z.uuid().nullable(),
  profileMedia: mediaSchema.nullable(),
});
export const validatePublicUser = (data: unknown) =>
  publicUserSchema.parseAsync(data);
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
export const validateCategory = (data: unknown) =>
  categorySchema.parseAsync(data);

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
export const validateListing = (data: unknown) =>
  listingSchema.parseAsync(data);

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
export const validateMissionTemplate = (data: unknown) =>
  missionTemplateSchema.parseAsync(data);

const userMissionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  missionTemplateId: z.uuid(),
  missionTemplate: missionTemplateSchema,
  completed: z.boolean(),
  completedAt: z.date().nullable().optional(),
  progress: z.object({}).optional(),
});
export const validateUserMission = (data: unknown) =>
  userMissionSchema.parseAsync(data);

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
export const validateNotification = (data: unknown) =>
  notificationSchema.parseAsync(data);

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
export const validateMessage = (data: unknown) =>
  messageSchema.parseAsync(data);

const registerSchema = z.object({
  password: passwordSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  schoolId: z.uuid(),
  roleId: z.uuid(),
  email: emailSchema,
});
export const validateRegister = (data: unknown) =>
  registerSchema.parseAsync(data);

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(100),
});
export const validateLogin = (data: unknown) => loginSchema.parseAsync(data);

const updateSelfSchema = z.object({
  email: emailSchema.optional(),
  firstName: firstNameSchema.optional(),
  lastName: lastNameSchema.optional(),
  phone: phoneSchema.optional(),
  profileMediaId: z.uuid().nullable().optional(),
  password: passwordSchema.optional(),
});
export const validateUpdateSelf = (data: unknown) =>
  updateSelfSchema.parseAsync(data);

const paginatedQuery = z.object({
  page: z.string().min(1).optional(),
  limit: z.string().min(1).optional(),
  sort: z.string().min(2).max(100).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});
export const validatePaginationParams = (data: unknown) =>
  paginatedQuery.parseAsync(data);

const getRolesRequestQuery = paginatedQuery.extend({
  searchTerm: z.string().min(1).max(100).optional(),
});
export const validateGetRolesRequest = (data: unknown) =>
  getRolesRequestQuery.parseAsync(data);
const getUsersRequestQuery = paginatedQuery.extend({
  searchTerm: z.string().min(1).max(100).optional(),
  roleId: z.uuid().optional(),
  schoolId: z.uuid().optional(),
});
export const validateGetUsersRequest = (data: unknown) =>
  getUsersRequestQuery.parseAsync(data);
const getSchoolsRequestQuery = paginatedQuery.extend({
  searchTerm: z.string().min(1).max(100).optional(),
});
export const validateGetSchoolsRequest = (data: unknown) =>
  getSchoolsRequestQuery.parseAsync(data);
const getListingsRequestQuery = paginatedQuery.extend({
  searchTerm: z.string().min(1).max(100).optional(),
  categoryId: z.uuid().optional(),
  userId: z.uuid().optional(),
});
export const validateGetListingsRequest = (data: unknown) =>
  getListingsRequestQuery.parseAsync(data);
const postListingsRequestBody = z.object({
  title: z.string().min(2).max(100),
  description: z.string().min(10).max(1000),
  price: z.number().min(0),
  categoryId: z.uuid(),
  productStatus: z.enum(PRODUCT_STATUS),
  mediaIds: z.array(z.uuid()).min(1).max(7),
});
export const validatePostListingsRequest = (data: unknown) =>
  postListingsRequestBody.parseAsync(data);
const patchListingsRequestBody = z.object({
  title: z.string().min(2).max(100).optional(),
  description: z.string().min(10).max(1000).optional(),
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
