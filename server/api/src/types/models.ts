import type { AuthModel as AuthModelType } from "../models/auth";
import type { ProfileModel as ProfileModelType } from "../models/profile";

export interface AuthRegisterPayload {
  firstName: string;
  lastName: string;
  password: string;
  schoolId: string;
  roleId: string;
  email: string;
}
export interface AuthLoginPayload {
  email: string;
  password: string;
}

export type AuthModel = AuthModelType;

export type ProfileModel = ProfileModelType;
