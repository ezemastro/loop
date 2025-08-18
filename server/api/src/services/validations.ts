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
const TRANSACTION_TYPES: TransactionKind[] = [
  "loop",
  "mission",
  "donation",
  "admin",
];

const mediaSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  type: z.enum(["image", "video"]),
  mime: z.string().nullable().optional(),
});
export const validateMedia = (data: unknown) => mediaSchema.parseAsync(data);

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

const userSchema = z.object({
  id: z.uuid(),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  email: z.email().optional(),
  phone: z.string().nullable().optional(),
  roleId: z.uuid(),
  role: roleSchema.optional(),
  schoolId: z.uuid(),
  school: schoolSchema.optional(),
  profileMediaId: z.uuid().nullable().optional(),
  profileMedia: mediaSchema.optional(),
  credits: z.object({
    balance: z.number().nonnegative(),
    locked: z.number().nonnegative(),
  }),
});
export const validateUser = (data: unknown) => userSchema.parseAsync(data);

const categorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(100),
  parentId: z.uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  priceRange: z
    .object({
      min: z.number().min(0).nullable().optional(),
      max: z.number().min(0).nullable().optional(),
    })
    .optional(),
  icon: z.string().nullable().optional(),
  stats: z.object({
    kgWaste: z.number().min(0),
    kgCo2: z.number().min(0),
    lH2o: z.number().min(0),
  }),
  children: z.array(z.lazy((): z.ZodTypeAny => categorySchema)).optional(),
});
export const validateCategory = (data: unknown) =>
  categorySchema.parseAsync(data);

const listingSchema = z.object({
  id: z.uuid(),
  sellerId: z.uuid(),
  seller: userSchema.optional(),
  title: z.string().min(2).max(100),
  description: z.string().nullable().optional(),
  categoryId: z.uuid(),
  category: categorySchema.optional(),
  priceCredits: z.number().min(0),
  status: z.enum(LISTING_STATUS),
  disabled: z.boolean(),
  buyerId: z.uuid().nullable().optional(),
  buyer: userSchema.optional(),
  offeredCredits: z.number().min(0).nullable().optional(),
  media: z.array(mediaSchema).optional(),
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
      buyer: userSchema.optional().nullable(),
      offeredCredits: z.number().min(0).nullable().optional(),
      status: z.enum(LISTING_STATUS),
    }),
    z.object({
      donorUserId: z.uuid(),
      donorUser: userSchema,
      amount: z.number().min(0),
      message: z.string().optional(),
    }),
    z.object({
      message: z.string().optional(),
      action: z.enum([
        "delete",
        "update",
        "credits",
      ] as AdminPayload["action"][]),
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
  sender: userSchema.optional(),
  recipientId: z.uuid(),
  recipient: userSchema.optional(),
  text: z.string().min(1).max(1000),
  createdAt: z.date(),
  attachedListingId: z.uuid().nullable().optional(),
  attachedListing: listingSchema.optional(),
});
export const validateMessage = (data: unknown) =>
  messageSchema.parseAsync(data);
