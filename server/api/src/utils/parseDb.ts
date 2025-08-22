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
export const parseRoleFromDb = (row: DB_Roles): Role => {
  return {
    id: row.id,
    name: row.name,
  };
};
export const parseUserFromDb = (row: DB_Users): UserBase => {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    schoolId: row.school_id,
    roleId: row.role_id,
    profileMediaId: row.profile_media_id,
    credits: {
      balance: row.credits_balance,
      locked: row.credits_locked,
    },
  };
};
export const parsePrivateUserFromBase = ({
  user,
  profileMedia,
  school,
  role,
}: {
  user: UserBase;
  profileMedia: Media | null;
  school: School;
  role: Role;
}): PrivateUser => {
  return {
    ...user,
    profileMedia,
    school,
    role,
  };
};
