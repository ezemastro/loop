import type { AuthModel as AuthModelType } from "../models/auth";
import type { SelfModel as SelfModelType } from "../models/self";

export interface AuthRegisterPayload {
  firstName: string;
  lastName: string;
  password: string;
  schoolIds: string[];
  email: string;
}
export interface AuthLoginPayload {
  email: string;
  password: string;
}

export type AuthModel = AuthModelType;

export type SelfModel = SelfModelType;
