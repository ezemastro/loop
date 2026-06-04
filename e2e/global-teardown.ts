import { Pool } from "pg";

/**
 * Global teardown — cleans the database after all E2E tests finish.
 * Referenced in playwright.config.ts via `globalTeardown`.
 */

export default async function globalTeardown() {
  const pool = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "password",
    database: process.env.POSTGRES_DB || "db",
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM notifications`);
    await client.query(`DELETE FROM wallet_transactions`);
    await client.query(`DELETE FROM listing_trades`);
    await client.query(`DELETE FROM listing_media`);
    await client.query(`DELETE FROM listings`);
    await client.query(`DELETE FROM messages`);
    await client.query(`DELETE FROM user_missions`);
    await client.query(`DELETE FROM users_wishes`);
    await client.query(`DELETE FROM user_schools`);
    await client.query(`DELETE FROM users WHERE email LIKE 'e2e-%'`);
    await client.query(`DELETE FROM mission_templates WHERE key LIKE 'e2e-%'`);
    await client.query(`DELETE FROM categories WHERE name LIKE 'E2E%'`);
    await client.query(`DELETE FROM admin_valid_emails WHERE email LIKE 'e2e-%'`);
    await client.query(`DELETE FROM admins WHERE email LIKE 'e2e-%'`);
    await client.query(`DELETE FROM media WHERE url LIKE 'e2e-%'`);
    await client.query("COMMIT");
    console.log("✅ E2E database cleaned successfully");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to clean E2E database:", e);
  } finally {
    client.release();
    await pool.end();
  }
}
