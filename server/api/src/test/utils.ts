import { randomUUID } from "node:crypto";
import { INITIAL_CREDITS } from "../config";

export const MOCK_SCHOOL: School = {
  id: randomUUID(),
  name: "Test School",
  mediaId: randomUUID(),
};
export const MOCK_ROLE: Role = {
  id: randomUUID(),
  name: "Test Role",
};
export const MOCK_USER: User & { password: string } = {
  id: randomUUID(),
  email: "test@example.com",
  firstName: "firstName",
  lastName: "lastName",
  schoolId: MOCK_SCHOOL.id,
  roleId: MOCK_ROLE.id,
  password: "validPassword",
  credits: {
    balance: INITIAL_CREDITS,
    locked: 0,
  },
  phone: null,
  profileMediaId: null,
  profileMedia: null,
};
export const MOCK_USER_DB: DB_Users = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  first_name: MOCK_USER.firstName,
  last_name: MOCK_USER.lastName,
  school_id: MOCK_USER.schoolId,
  role_id: MOCK_USER.roleId,
  password: "hashedPassword",
  created_at: new Date().toISOString(),
  credits_balance: INITIAL_CREDITS,
  credits_locked: 0,
  phone: null,
  profile_media_id: null,
  updated_at: null,
};
export const MOCK_SCHOOL_DB: DB_Schools = {
  id: MOCK_SCHOOL.id,
  name: MOCK_SCHOOL.name,
  media_id: MOCK_SCHOOL.mediaId,
  meta: null,
};
export const MOCK_ROLE_DB: DB_Roles = {
  id: MOCK_ROLE.id,
  name: MOCK_ROLE.name,
};
