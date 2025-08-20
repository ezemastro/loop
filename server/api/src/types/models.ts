import type { AuthModel as AuthModelType } from "../models/auth";

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
