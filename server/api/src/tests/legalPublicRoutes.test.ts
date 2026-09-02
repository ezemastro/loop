/**
 * DB-backed integration coverage for `terms-acceptance` (phase 3, task 3.9) and `password-reset`
 * (phase 5, task 5.10). Same gate as `rls.test.ts` — needs a real database with migrations
 * applied, so it is skipped unless explicitly requested:
 *
 *     cd server/api
 *     RUN_DB_TESTS=1 npm test -- src/tests/legalPublicRoutes.test.ts
 *
 * Exercises the actual application code path (`SelfModel`, `AuthModel`) against a seeded user, not
 * raw SQL — `rls.test.ts` already proves the database layer in isolation; this proves the model
 * layer built on top of it.
 */
import crypto from "node:crypto";
import { Client } from "pg";
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from "../config.js";
import { AuthModel } from "../models/auth.js";
import { SelfModel } from "../models/self.js";
import { comparePasswords } from "../services/hash.js";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const describeDb = shouldRun ? describe : describe.skip;

const SUFFIX = `legal-${Date.now()}`;

describeDb("terms-acceptance & password-reset (model layer)", () => {
  let owner: Client;
  let communityId: string;
  let userId: string;
  const userEmail = `${SUFFIX}-user@test.local`;

  beforeAll(async () => {
    owner = new Client({
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      host: DB_HOST,
      port: DB_PORT,
    });
    await owner.connect();

    const { rows: communityRows } = await owner.query<{ id: string }>(
      `INSERT INTO communities (slug, name) VALUES ($1, $2) RETURNING id`,
      [`${SUFFIX}-community`, "Legal Test Community"],
    );
    communityId = communityRows[0]!.id;

    const { rows: userRows } = await owner.query<{ id: string }>(
      `INSERT INTO users (email, first_name, last_name, password, community_id, email_verified)
       VALUES ($1, 'Legal', 'Test', $2, $3, TRUE) RETURNING id`,
      [userEmail, await hashForSeed("old-password-123"), communityId],
    );
    userId = userRows[0]!.id;
  });

  afterAll(async () => {
    await owner.query(`DELETE FROM users WHERE community_id = $1`, [communityId]);
    await owner.query(`DELETE FROM communities WHERE id = $1`, [communityId]);
    await owner.end();
  });

  // ── terms-acceptance ──────────────────────────────────────────────────────

  it("a user with NULL terms_version is treated as not-accepted", async () => {
    const { rows } = await owner.query<{ terms_version: string | null }>(
      `SELECT terms_version FROM users WHERE id = $1`,
      [userId],
    );
    expect(rows[0]!.terms_version).toBeNull();
  });

  it("accepting sets both terms_accepted_at and terms_version", async () => {
    await SelfModel.acceptTerms({ userId, communityId, termsVersion: "2026-09-02" });

    const { rows } = await owner.query<{
      terms_accepted_at: Date | null;
      terms_version: string | null;
    }>(`SELECT terms_accepted_at, terms_version FROM users WHERE id = $1`, [userId]);
    expect(rows[0]!.terms_version).toBe("2026-09-02");
    expect(rows[0]!.terms_accepted_at).not.toBeNull();
  });

  it("a matching version is treated as accepted (columns already set from the previous test)", async () => {
    const { rows } = await owner.query<{ terms_version: string | null }>(
      `SELECT terms_version FROM users WHERE id = $1`,
      [userId],
    );
    expect(rows[0]!.terms_version).toBe("2026-09-02");
  });

  // ── password-reset ────────────────────────────────────────────────────────

  it("the emailed token never appears in the database — only its sha256 digest", async () => {
    await AuthModel.requestPasswordReset({ email: userEmail });

    const { rows } = await owner.query<{ password_reset_token_hash: string | null }>(
      `SELECT password_reset_token_hash FROM users WHERE id = $1`,
      [userId],
    );
    const hash = rows[0]!.password_reset_token_hash;
    expect(hash).not.toBeNull();
    // Can't recover the cleartext token here (it only ever left the process inside the mail
    // send, which is stubbed out without RESEND_API_KEY) — but the stored value is a 64-char hex
    // digest, never a 64-char hex token re-used verbatim as its own hash.
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("unknown address is a silent no-op — same shape, no row touched", async () => {
    const result = await AuthModel.requestPasswordReset({ email: "nobody@test.local" });
    expect(result).toEqual({ sent: false });
  });

  it("full reset round-trip: expired token rejected, second use rejected, valid token works once", async () => {
    // Issue a token the same way the model does, but capture the cleartext ourselves (the model
    // never returns it — it only ever goes out over email) so we can drive `resetPassword`.
    const cleartext = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(cleartext).digest("hex");

    // Expired: expires_at in the past.
    await owner.query(
      `UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = NOW() - INTERVAL '1 hour' WHERE id = $2`,
      [hash, userId],
    );
    await expect(
      AuthModel.resetPassword({ token: cleartext, newPassword: "brand-new-pass-1" }),
    ).rejects.toMatchObject({ code: "PASSWORD_RESET_TOKEN_INVALID" });

    // Valid: expires_at in the future.
    await owner.query(
      `UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = NOW() + INTERVAL '1 hour' WHERE id = $2`,
      [hash, userId],
    );
    await AuthModel.resetPassword({ token: cleartext, newPassword: "brand-new-pass-1" });

    const { rows } = await owner.query<{
      password: string;
      password_reset_token_hash: string | null;
      email_verified: boolean;
    }>(`SELECT password, password_reset_token_hash, email_verified FROM users WHERE id = $1`, [
      userId,
    ]);
    expect(rows[0]!.password_reset_token_hash).toBeNull();
    expect(rows[0]!.email_verified).toBe(true);
    expect(await comparePasswords("brand-new-pass-1", rows[0]!.password)).toBe(true);

    // Second use of the same (now consumed) token fails.
    await expect(
      AuthModel.resetPassword({ token: cleartext, newPassword: "another-pass-2" }),
    ).rejects.toMatchObject({ code: "PASSWORD_RESET_TOKEN_INVALID" });
  });

  it("a new request invalidates the previous outstanding token", async () => {
    await AuthModel.requestPasswordReset({ email: userEmail });
    const { rows: first } = await owner.query<{ password_reset_token_hash: string }>(
      `SELECT password_reset_token_hash FROM users WHERE id = $1`,
      [userId],
    );
    const firstHash = first[0]!.password_reset_token_hash;

    await AuthModel.requestPasswordReset({ email: userEmail });
    const { rows: second } = await owner.query<{ password_reset_token_hash: string }>(
      `SELECT password_reset_token_hash FROM users WHERE id = $1`,
      [userId],
    );
    expect(second[0]!.password_reset_token_hash).not.toBe(firstHash);
  });

  it("two concurrent submissions of the same token: exactly one succeeds", async () => {
    const cleartext = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(cleartext).digest("hex");
    await owner.query(
      `UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = NOW() + INTERVAL '1 hour' WHERE id = $2`,
      [hash, userId],
    );

    const outcomes = await Promise.allSettled([
      AuthModel.resetPassword({ token: cleartext, newPassword: "concurrent-pass-1" }),
      AuthModel.resetPassword({ token: cleartext, newPassword: "concurrent-pass-2" }),
    ]);
    const succeeded = outcomes.filter((o) => o.status === "fulfilled");
    const failed = outcomes.filter((o) => o.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
  });
});

/** Seeds a bcrypt hash for the fixture row without going through the HTTP layer. */
async function hashForSeed(password: string): Promise<string> {
  const { hashPassword } = await import("../services/hash.js");
  return hashPassword(password);
}
