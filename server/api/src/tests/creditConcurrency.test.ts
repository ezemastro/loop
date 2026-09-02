/**
 * Prueba que la economía de créditos sobreviva a dos requests concurrentes (credit-ledger,
 * listing-lifecycle). Sigue el patrón de `rls.test.ts`: abre una conexión cruda con el rol dueño
 * para sembrar y limpiar fixtures, y ejercita el código real de producción — los modelos, no una
 * reimplementación en SQL de las mismas queries — porque cada llamada a `withClient` abre su
 * propia conexión del pool, que es justo lo que hace falta para que dos llamadas concurrentes
 * corran en conexiones separadas y realmente compitan por el mismo lock de fila.
 *
 * Gateada detrás de `RUN_DB_TESTS=1` porque necesita una base con las migraciones aplicadas
 * (incluida `0014`), y contra el Postgres dockerizado de `docker-compose.dev.yml`, que publica el
 * puerto en el host — `docker-compose.e2e.yml` no publica ninguno.
 *
 *     cd server/api
 *     RUN_DB_TESTS=1 PGHOST=localhost npm test -- src/tests/creditConcurrency.test.ts
 *
 * `PGHOST=localhost` hace falta porque `config.ts` resuelve `DB_HOST` a `db` por default (el
 * hostname dentro de compose), que no resuelve desde un proceso corrido en el host.
 */
import { Client } from "pg";
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from "../config.js";
import { ListingsModel } from "../models/listings.js";
import { UsersModel } from "../models/users.js";
import { closePools } from "../services/postgresClient.js";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const describeDb = shouldRun ? describe : describe.skip;

const SUFFIX = `credits-${Date.now()}`;
const connect = (user?: string, password?: string) =>
  new Client({ user, password, database: DB_NAME, host: DB_HOST, port: DB_PORT });

describeDb("Credit economy concurrency", () => {
  /** Rol dueño: siembra y limpia. No sujeto a RLS ni a los guards de aplicación. */
  let owner: Client;

  const ids = {
    communityId: "",
    categoryId: "",
    sellerId: "",
    buyerAId: "",
    buyerBId: "",
    donorId: "",
    recipientId: "",
    listingRaceId: "",
    lockOrderSellerId: "",
    lockOrderBuyerId: "",
    lockOrderListingId: "",
    lockOrderTradeListingId: "",
  };

  // Sembrar un saldo inicial sin su fila de ledger dejaría la reconciliación rota desde el
  // arranque, por construcción (design D6): un usuario con `credits_balance = 100` y cero
  // movimientos nunca puede reconciliar. Igual que la migración `0014`, cada saldo inicial no-cero
  // sembrado a mano lleva su propia fila `genesis_opening_balance`.
  const user = async (email: string, balance: number) => {
    const { rows } = await owner.query<{ id: string }>(
      `INSERT INTO users (email, first_name, last_name, community_id, credits_balance)
       VALUES ($1, 'Credits', 'Test', $2, $3) RETURNING id`,
      [`${SUFFIX}-${email}`, ids.communityId, balance],
    );
    const userId = rows[0]!.id;
    if (balance !== 0) {
      await owner.query(
        `INSERT INTO wallet_transactions
           (user_id, community_id, type, positive, amount, balance_delta, locked_delta,
            balance_after, locked_after, reason)
         VALUES ($1, $2, 'admin', TRUE, $3, $3, 0, $3, 0, 'genesis_opening_balance')`,
        [userId, ids.communityId, balance],
      );
    }
    return userId;
  };

  const listing = async (sellerId: string, priceCredits: number) => {
    const { rows } = await owner.query<{ id: string }>(
      `INSERT INTO listings
         (title, description, price_credits, category_id, seller_id, product_status, listing_status, community_id)
       VALUES ('Credits test', NULL, $1, $2, $3, 'good', 'published', $4) RETURNING id`,
      [priceCredits, ids.categoryId, sellerId, ids.communityId],
    );
    return rows[0]!.id;
  };

  beforeAll(async () => {
    owner = connect(DB_USER, DB_PASSWORD);
    await owner.connect();

    const { rows: communityRows } = await owner.query<{ id: string }>(
      `INSERT INTO communities (slug, name) VALUES ($1, $2) RETURNING id`,
      [`${SUFFIX}-community`, `Credits ${SUFFIX}`],
    );
    ids.communityId = communityRows[0]!.id;

    const { rows: categoryRows } = await owner.query<{ id: string }>(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
      [`${SUFFIX}-cat`],
    );
    ids.categoryId = categoryRows[0]!.id;

    ids.sellerId = await user("seller", 0);
    ids.buyerAId = await user("buyer-a", 100);
    ids.buyerBId = await user("buyer-b", 100);
    ids.donorId = await user("donor", 100);
    ids.recipientId = await user("recipient", 0);

    ids.listingRaceId = await listing(ids.sellerId, 100);

    // Fixtures del test 4 (lock ordering): un `accept` con trade-in, para que el movimiento del
    // vendedor Y el del comprador no sean cero, concurrente con una donación en la dirección
    // opuesta — ver el test para el detalle de los montos.
    ids.lockOrderSellerId = await user("lock-order-seller", 100);
    ids.lockOrderBuyerId = await user("lock-order-buyer", 1000);
    ids.lockOrderListingId = await listing(ids.lockOrderSellerId, 50);
    ids.lockOrderTradeListingId = await listing(ids.lockOrderBuyerId, 100);
  });

  afterAll(async () => {
    if (owner) {
      await owner.query(`DELETE FROM wallet_transactions WHERE community_id = $1`, [
        ids.communityId,
      ]);
      // Las ofertas/aceptaciones/donaciones de los tests generan notificaciones reales; hay que
      // borrarlas antes que los usuarios o `notifications_user_community_fk` rechaza el DELETE.
      await owner.query(`DELETE FROM notifications WHERE community_id = $1`, [ids.communityId]);
      await owner.query(`DELETE FROM listing_trades WHERE community_id = $1`, [ids.communityId]);
      await owner.query(`DELETE FROM listings WHERE community_id = $1`, [ids.communityId]);
      await owner.query(`DELETE FROM users WHERE community_id = $1`, [ids.communityId]);
      await owner.query(`DELETE FROM communities WHERE id = $1`, [ids.communityId]);
      await owner.query(`DELETE FROM categories WHERE id = $1`, [ids.categoryId]);
      await owner.end();
    }
    await closePools();
  });

  it("dos ofertas simultáneas sobre el mismo listing: exactamente una gana (listing-lifecycle: A second buyer cannot overwrite the first)", async () => {
    const results = await Promise.allSettled([
      ListingsModel.newOffer({
        listingId: ids.listingRaceId,
        userId: ids.buyerAId,
        offeredCredits: 100,
        communityId: ids.communityId,
      }),
      ListingsModel.newOffer({
        listingId: ids.listingRaceId,
        userId: ids.buyerBId,
        offeredCredits: 100,
        communityId: ids.communityId,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const { rows: listingRows } = await owner.query<{
      listing_status: string;
      buyer_id: string;
    }>(`SELECT listing_status, buyer_id FROM listings WHERE id = $1`, [ids.listingRaceId]);
    expect(listingRows[0]!.listing_status).toBe("offered");
    const winnerId = listingRows[0]!.buyer_id;
    expect([ids.buyerAId, ids.buyerBId]).toContain(winnerId);
    const loserId = winnerId === ids.buyerAId ? ids.buyerBId : ids.buyerAId;

    const { rows: loserRows } = await owner.query<{
      credits_locked: string;
      credits_balance: string;
    }>(`SELECT credits_locked, credits_balance FROM users WHERE id = $1`, [loserId]);
    expect(Number(loserRows[0]!.credits_locked)).toBe(0);
    expect(Number(loserRows[0]!.credits_balance)).toBe(100);

    const { rows: winnerRows } = await owner.query<{
      credits_locked: string;
      credits_balance: string;
    }>(`SELECT credits_locked, credits_balance FROM users WHERE id = $1`, [winnerId]);
    expect(Number(winnerRows[0]!.credits_locked)).toBe(100);
    expect(Number(winnerRows[0]!.credits_balance)).toBe(0);

    const { rows: ledgerRows } = await owner.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM wallet_transactions
        WHERE reference_id = $1 AND reason = 'offer_lock'`,
      [ids.listingRaceId],
    );
    expect(Number(ledgerRows[0]!.n)).toBe(1);
  });

  it("dos donaciones simultáneas de todo el saldo: exactamente una gana, el saldo nunca es negativo (credit-ledger: Concurrent donations cannot overdraw)", async () => {
    const results = await Promise.allSettled([
      UsersModel.donate({
        fromUserId: ids.donorId,
        toUserId: ids.recipientId,
        amount: 100,
        communityId: ids.communityId,
      }),
      UsersModel.donate({
        fromUserId: ids.donorId,
        toUserId: ids.recipientId,
        amount: 100,
        communityId: ids.communityId,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);

    const { rows: donorRows } = await owner.query<{ credits_balance: string }>(
      `SELECT credits_balance FROM users WHERE id = $1`,
      [ids.donorId],
    );
    expect(Number(donorRows[0]!.credits_balance)).toBe(0);
    expect(Number(donorRows[0]!.credits_balance)).toBeGreaterThanOrEqual(0);

    const { rows: recipientRows } = await owner.query<{ credits_balance: string }>(
      `SELECT credits_balance FROM users WHERE id = $1`,
      [ids.recipientId],
    );
    expect(Number(recipientRows[0]!.credits_balance)).toBe(100);

    // Exactamente dos filas de ledger (una `donation_sent`, una `donation_received`), no cuatro.
    const { rows: ledgerRows } = await owner.query<{ reason: string; n: string }>(
      `SELECT reason, count(*)::int AS n FROM wallet_transactions
        WHERE (user_id = $1 OR user_id = $2) AND reason IN ('donation_sent', 'donation_received')
        GROUP BY reason ORDER BY reason`,
      [ids.donorId, ids.recipientId],
    );
    expect(ledgerRows).toEqual([
      { reason: "donation_received", n: 1 },
      { reason: "donation_sent", n: 1 },
    ]);
  });

  it("la reconciliación no reporta discrepancias después de las dos carreras (credit-ledger: Reconciliation Invariant)", async () => {
    const { rows } = await owner.query<{ id: string }>(
      `SELECT u.id
         FROM users u
         LEFT JOIN wallet_transactions w ON w.user_id = u.id
        WHERE u.community_id = $1
        GROUP BY u.id, u.credits_balance, u.credits_locked
       HAVING u.credits_balance <> COALESCE(SUM(w.balance_delta), 0)
           OR u.credits_locked  <> COALESCE(SUM(w.locked_delta),  0)`,
      [ids.communityId],
    );
    expect(rows).toEqual([]);
  });

  it("aceptar una oferta y donar en el sentido opuesto no producen deadlock (credit-ledger: Opposite-direction transactions do not deadlock)", async () => {
    // Deja el listing en `offered`, con trade-in de por medio para que tanto el vendedor como el
    // comprador tengan un movimiento real al aceptar (no cero) — es la única forma de que este
    // test toque de verdad las dos filas de `users` en la transacción de `acceptOffer`.
    await ListingsModel.newOffer({
      listingId: ids.lockOrderListingId,
      userId: ids.lockOrderBuyerId,
      offeredCredits: 20,
      communityId: ids.communityId,
    });

    const results = await Promise.allSettled([
      // Toca vendedor (-50 balance, +50 locked: el trade-in vale más que el precio) y comprador
      // (+20 balance, -20 locked).
      ListingsModel.acceptOffer({
        listingId: ids.lockOrderListingId,
        userId: ids.lockOrderSellerId,
        tradingListingIds: [ids.lockOrderTradeListingId],
        communityId: ids.communityId,
      }),
      // Dirección opuesta: comprador → vendedor.
      UsersModel.donate({
        fromUserId: ids.lockOrderBuyerId,
        toUserId: ids.lockOrderSellerId,
        amount: 100,
        communityId: ids.communityId,
      }),
    ]);

    const deadlocks = results.filter(
      (r) => r.status === "rejected" && (r.reason as { code?: string })?.code === "40P01",
    );
    expect(deadlocks).toHaveLength(0);
    // `applyCreditMovements` ordena por `userId` sin importar el orden con el que cada caller
    // arma su lote (design D3, regla 3): ninguna de las dos transacciones debería fallar.
    const rejected = results.filter((r) => r.status === "rejected");
    if (rejected.length > 0) {
      // Si algo falló que no sea el deadlock, se imprime para que quede en la evidencia — no
      // debería pasar con estos saldos, pero mejor un mensaje claro que un `toHaveLength` mudo.

      console.error("Fallo inesperado en el test de lock ordering:", rejected);
    }
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });
});
