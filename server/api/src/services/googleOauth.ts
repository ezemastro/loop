import { OAuth2Client } from "google-auth-library";
import { ADMIN_GOOGLE_CLIENT_ID } from "../config";

export const adminGoogleClient = new OAuth2Client(ADMIN_GOOGLE_CLIENT_ID);

// TODO - Implementar google client para android y otr para iOS
