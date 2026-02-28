import { OAuth2Client } from "google-auth-library";
import { ADMIN_GOOGLE_CLIENT_ID, WEB_GOOGLE_CLIENT_ID } from "../config";

export const adminGoogleClient = new OAuth2Client(ADMIN_GOOGLE_CLIENT_ID);

export const webGoogleClient = new OAuth2Client(WEB_GOOGLE_CLIENT_ID);
