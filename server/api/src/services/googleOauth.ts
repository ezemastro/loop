import { OAuth2Client } from "google-auth-library";
import {
  ADMIN_GOOGLE_CLIENT_ID,
  ANDROID_GOOGLE_CLIENT_ID,
  IOS_GOOGLE_CLIENT_ID,
  WEB_GOOGLE_CLIENT_ID,
} from "../config";

export const adminGoogleClient = new OAuth2Client(ADMIN_GOOGLE_CLIENT_ID);

export const webGoogleClient = new OAuth2Client(WEB_GOOGLE_CLIENT_ID);

/**
 * Audiencias aceptadas por el login de usuario final: web, Android e iOS (SEC-04, D4).
 *
 * `google-auth-library` 10.5.0 salta el chequeo de `aud` por completo cuando el argumento
 * `audience` es `undefined` o `null` (confirmado en
 * `node_modules/google-auth-library/build/src/auth/oauth2client.js:775`); una lista vacía en
 * cambio hace que el `indexOf` interno falle siempre, así que rechaza todo en vez de aceptar
 * cualquier cosa. Por eso se afirma explícitamente que la lista no quede vacía: `env.ts` exige
 * `WEB_GOOGLE_CLIENT_ID` en producción, así que al menos ese elemento siempre está.
 */
export const END_USER_AUDIENCES: string[] = [
  WEB_GOOGLE_CLIENT_ID,
  ANDROID_GOOGLE_CLIENT_ID,
  IOS_GOOGLE_CLIENT_ID,
].filter((value): value is string => !!value);

if (END_USER_AUDIENCES.length === 0) {
  throw new Error(
    "[googleOauth] END_USER_AUDIENCES está vacía: ningún login de usuario por Google verificaría.",
  );
}

/**
 * Audiencia del panel de admin, deliberadamente **disjunta** de `END_USER_AUDIENCES` (proposal
 * C3): si se aceptaran los client ids de usuario final, un id token emitido para la app de Expo
 * podría autenticar contra el panel de admin, dejando solo el allowlist de emails como barrera.
 */
export const ADMIN_AUDIENCES: string[] = [ADMIN_GOOGLE_CLIENT_ID];
