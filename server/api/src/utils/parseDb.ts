const parseDateFromDb = (date: ISODateString): Date => {
  return new Date(date);
};
const parseDateToDb = (date: Date): ISODateString => {
  return date.toISOString() as ISODateString;
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
export const parseUserMissionBaseFromDb = (
  row: DB_UserMissions,
): UserMissionBase => {
  return {
    id: row.id,
    userId: row.user_id,
    missionTemplateId: row.mission_template_id,
    completed: row.completed,
    completedAt: row.completed_at ? parseDateFromDb(row.completed_at) : null,
    progress: row.progress,
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
    rewardCredits: row.reward_credits,
  };
};
