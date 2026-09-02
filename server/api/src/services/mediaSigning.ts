import crypto from "node:crypto";
import {
  MEDIA_SIGNING_SECRET,
  MEDIA_SIGNING_SECRET_PREVIOUS,
  MEDIA_URL_BUCKET_SECONDS,
  MEDIA_URL_TTL_SECONDS,
} from "../config.js";

/**
 * HMAC-signed URLs for `GET /uploads/*` (SEC-08, design D7).
 *
 * `<Image>`/`<img>` cannot carry an `Authorization` header, so authorisation travels in the URL
 * itself: `"<filename>?exp=<unix>&sig=<hex>"`. The signature is `HMAC-SHA256(secret,
 * "<filename>|<exp>")`, so a leaked URL leaks exactly one file, bound to one expiry — never a
 * bearer capability for the whole community's media.
 *
 * `exp` is **bucketed**, not "now + TTL": every call inside the same `MEDIA_URL_BUCKET_SECONDS`
 * window produces the identical string, so browser/RN image caches keep hitting instead of
 * missing on every response (spec `media-access-control`, "Signed URLs Remain Cacheable").
 */
const computeExpiry = (now: number = Date.now()): number => {
  const nowSeconds = Math.floor(now / 1000);
  const bucketStart = Math.ceil(nowSeconds / MEDIA_URL_BUCKET_SECONDS) * MEDIA_URL_BUCKET_SECONDS;
  return bucketStart + MEDIA_URL_TTL_SECONDS;
};

const sign = (payload: string, secret: string): string =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

/** `crypto.timingSafeEqual` requires equal-length buffers; a length mismatch is just "not equal". */
const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const signMediaUrl = (filename: string): string => {
  const exp = computeExpiry();
  const sig = sign(`${filename}|${exp}`, MEDIA_SIGNING_SECRET);
  return `${filename}?exp=${exp}&sig=${sig}`;
};

/**
 * Verifies a signature against the current secret, and — when configured — the previous one, so
 * rotating `MEDIA_SIGNING_SECRET` does not instantly break every URL already handed out (spec
 * `media-access-control`, "Secret rotation does not break live URLs").
 */
export const verifyMediaSignature = ({
  filename,
  exp,
  sig,
}: {
  filename: string;
  exp: number;
  sig: string;
}): boolean => {
  if (!Number.isFinite(exp) || !sig) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;

  const payload = `${filename}|${exp}`;
  if (MEDIA_SIGNING_SECRET && safeEqual(sign(payload, MEDIA_SIGNING_SECRET), sig)) return true;
  if (
    MEDIA_SIGNING_SECRET_PREVIOUS &&
    safeEqual(sign(payload, MEDIA_SIGNING_SECRET_PREVIOUS), sig)
  ) {
    return true;
  }
  return false;
};
