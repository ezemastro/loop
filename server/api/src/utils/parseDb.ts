import { PAGE_SIZE } from "../config";

const parseDateFromDb = (date: ISODateString): Date => {
  return new Date(date);
};
const parseDateToDb = (date: Date): ISODateString => {
  return date.toISOString() as ISODateString;
};
export const parsePagination = ({
  currentPage,
  totalRecords,
}: {
  currentPage: number;
  totalRecords: number;
}): PaginatedApiResponse<unknown>["pagination"] => {
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const previousPage = currentPage > 1 ? currentPage - 1 : null;

  return {
    currentPage,
    nextPage,
    totalPages,
    pageSize: PAGE_SIZE,
    totalRecords,
    previousPage,
  };
};

export const parseSchoolFromDb = (row: DB_Schools): SchoolBase => {
  return {
    id: row.id,
    name: row.name,
    mediaId: row.media_id,
    meta: row.meta,
  };
};
export const parseSchoolFromBase = ({
  school,
  media,
}: {
  school: SchoolBase;
  media: Media;
}): School => {
  return {
    ...school,
    media,
  };
};
export const parseMediaFromDb = (row: DB_Media): Media => {
  return {
    id: row.id,
    url: row.url,
    mediaType: row.media_type,
    mime: row.mime,
  };
};
export const parseMediaToDb = ({
  media,
  userId,
}: {
  media: Media;
  userId: UUID;
}): DB_Media => {
  return {
    id: media.id,
    url: media.url,
    media_type: media.mediaType,
    mime: media.mime,
    uploaded_by: userId,
  };
};
export const parseUserBaseFromDb = (row: DB_Users): UserBase => {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    profileMediaId: row.profile_media_id,
    credits: {
      balance: Number(row.credits_balance),
      locked: Number(row.credits_locked),
    },
    stats: {
      kgWaste: row.stat_kg_waste ? Number(row.stat_kg_waste) : null,
      kgCo2: row.stat_kg_co2 ? Number(row.stat_kg_co2) : null,
      lH2o: row.stat_l_h2o ? Number(row.stat_l_h2o) : null,
    },
  };
};
export const parsePrivateUserFromBase = ({
  user,
  profileMedia,
  schools,
}: {
  user: UserBase;
  profileMedia: Media | null;
  schools: School[];
}): PrivateUser => {
  return {
    ...user,
    profileMedia,
    schools,
  };
};

export const parsePublicUserFromBase = ({
  user,
  profileMedia,
  schools,
}: {
  user: UserBase;
  profileMedia: Media | null;
  schools: School[];
}): PublicUser => {
  return {
    ...user,
    profileMedia,
    schools,
  };
};
export const parseUserMissionBaseFromDb = (
  row: DB_UserMissions,
): UserMissionBase => {
  return {
    id: row.id,
    userId: row.user_id,
    missionTemplateId: row.mission_template_id,
    completed: row.completed,
    completedAt: row.completed_at ? parseDateFromDb(row.completed_at) : null,
    progress: {
      current: Number(row.progress.current),
      total: Number(row.progress.total),
    },
  };
};
export const parseUserMissionFromBase = ({
  userMission,
  missionTemplate,
}: {
  userMission: UserMissionBase;
  missionTemplate: MissionTemplate;
}): UserMission => {
  return {
    ...userMission,
    missionTemplate,
  };
};
export const parseMissionTemplateFromDb = (
  row: DB_MissionTemplates,
): MissionTemplate => {
  return {
    id: row.id,
    title: row.title,
    key: row.key,
    description: row.description,
    active: row.active,
    rewardCredits: Number(row.reward_credits),
  };
};
export const parseNotificationBaseFromDb = (
  row: DB_Notifications,
): NotificationBase => {
  return {
    id: row.id,
    userId: row.user_id,
    isRead: row.is_read,
    type: row.type,
    payload: row.payload,
    readAt: row.read_at ? parseDateFromDb(row.read_at) : null,
    createdAt: parseDateFromDb(row.created_at),
  };
};
export const parseListingBaseFromDb = (row: DB_Listings): ListingBase => {
  return {
    buyerId: row.buyer_id,
    categoryId: row.category_id,
    description: row.description,
    disabled: row.disabled,
    id: row.id,
    listingStatus: row.listing_status,
    offeredCredits: Number(row.offered_credits),
    price: Number(row.price_credits),
    productStatus: row.product_status,
    sellerId: row.seller_id,
    title: row.title,
    createdAt: parseDateFromDb(row.created_at),
  };
};
export const parseListingFromBase = ({
  listing,
  seller,
  buyer,
  media,
  category,
}: {
  listing: ListingBase;
  seller: PublicUser;
  buyer: PublicUser | null;
  media: Media[];
  category: Category;
}): Listing => {
  return {
    ...listing,
    seller,
    buyer,
    media,
    category,
  };
};
export const parseCategoryBaseFromDb = (row: DB_Categories): CategoryBase => {
  return {
    description: row.description,
    icon: row.icon,
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    price:
      row.min_price_credits !== null && row.max_price_credits !== null
        ? {
            max: Number(row.max_price_credits),
            min: Number(row.min_price_credits),
          }
        : null,
    stats:
      row.stat_kg_co2 && row.stat_kg_waste && row.stat_l_h2o
        ? {
            kgCo2: Number(row.stat_kg_co2),
            kgWaste: Number(row.stat_kg_waste),
            lH2o: Number(row.stat_l_h2o),
          }
        : null,
  };
};
export const parseCategoryFromBase = ({
  category,
  children,
  parents,
}: {
  category: CategoryBase;
  children: Category[];
  parents: CategoryBase[];
}): Category => {
  return {
    ...category,
    children,
    parents,
  };
};
export const parseNotificationFromBase = ({
  notification,
  listing,
  donorUser,
  buyer,
  userMission,
}: {
  notification: NotificationBase;
  listing?: Listing | undefined;
  donorUser?: PublicUser | undefined;
  buyer?: PublicUser | null | undefined;
  userMission?: UserMission | undefined;
}): Notification => {
  let newPayload: Notification["payload"];
  switch (notification.type) {
    case "admin": {
      const payload = notification.payload as AdminNotificationPayloadBase;
      newPayload = {
        action: payload.action,
        amount: payload.amount,
        message: payload.message,
        referenceId: payload.referenceId,
        target: payload.target,
        reference:
          payload.referenceId && payload.target === "listing" ? listing! : null,
      } as AdminNotificationPayload;
      break;
    }
    case "donation": {
      const payload = notification.payload as DonationNotificationPayloadBase;
      newPayload = {
        amount: payload.amount,
        donorUserId: payload.donorUserId,
        donorUser: donorUser!,
        message: payload.message,
      } as DonationNotificationPayload;
      break;
    }
    case "loop": {
      const payload = notification.payload as LoopNotificationPayloadBase;
      newPayload = {
        listingId: payload.listingId,
        buyerId: payload.buyerId,
        buyer: payload.buyerId ? buyer! : null,
        listing: payload.listingId ? listing! : null,
        toListingStatus: payload.toListingStatus,
        toOfferedCredits: payload.toOfferedCredits,
      } as LoopNotificationPayload;
      break;
    }
    case "mission": {
      const payload = notification.payload as MissionNotificationPayloadBase;
      newPayload = {
        userMissionId: payload.userMissionId,
        userMission: userMission!,
      } as MissionNotificationPayload;
      break;
    }
  }
  return {
    ...notification,
    payload: newPayload,
  };
};

export const parseListingToDb = (listing: Listing): DB_Listings => {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price_credits: listing.price.toString() as DbNumber,
    seller_id: listing.sellerId,
    created_at: listing.createdAt.toISOString(),
    buyer_id: listing.buyerId,
    category_id: listing.categoryId,
    disabled: listing.disabled,
    listing_status: listing.listingStatus,
    offered_credits: listing.offeredCredits
      ? (listing.offeredCredits.toString() as DbNumber)
      : null,
    product_status: listing.productStatus,
    updated_at: parseDateToDb(new Date()),
  };
};
export const parseChatFromDb = (row: {
  other_user_id: UUID;
  last_message_id: UUID;
  unread_count: number;
}): UserMessageBase => {
  return {
    userId: row.other_user_id,
    lastMessageId: row.last_message_id,
    pendingMessages: row.unread_count,
  };
};
export const parseMessageBaseFromDb = (row: DB_Messages): MessageBase => {
  return {
    id: row.id,
    createdAt: parseDateFromDb(row.created_at),
    recipientId: row.recipient_id,
    senderId: row.sender_id,
    text: row.text,
    attachedListingId: row.attached_listing_id,
  };
};
export const parseMessageFromBase = ({
  message,
  listing,
}: {
  message: MessageBase;
  listing?: Listing | null;
}): Message => {
  return {
    ...message,
    attachedListing: listing ? listing : null,
  };
};

export const parseAdminFromDb = (row: DB_Admin): Admin => {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
  };
};
