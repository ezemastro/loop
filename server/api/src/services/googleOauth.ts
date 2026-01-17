import { OAuth2Client } from "google-auth-library";
import {
  ADMIN_GOOGLE_CLIENT_ID,
  ANDROID_GOOGLE_CLIENT_ID,
  IOS_GOOGLE_CLIENT_ID,
} from "../config";

export const adminGoogleClient = new OAuth2Client(ADMIN_GOOGLE_CLIENT_ID);

export const androidGoogleClient = new OAuth2Client(ANDROID_GOOGLE_CLIENT_ID);

export const iosGoogleClient = new OAuth2Client(IOS_GOOGLE_CLIENT_ID);
