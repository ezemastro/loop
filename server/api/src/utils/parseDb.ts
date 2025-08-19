export const parseUserFromDb = (row: DB_Users): User => {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
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
export const parseSchoolFromDb = (row: DB_Schools): School => {
  return {
    id: row.id,
    name: row.name,
    mediaId: row.media_id,
    meta: row.meta,
  };
};
export const parseRoleFromDb = (row: DB_Roles): Role => {
  return {
    id: row.id,
    name: row.name,
  };
};
