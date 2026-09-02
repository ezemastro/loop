/**
 * Reconciliación del ledger de créditos (credit-ledger: "Reconciliation Invariant", design D6).
 *
 * Cruza, para cada usuario, `credits_balance`/`credits_locked` contra la suma de
 * `balance_delta`/`locked_delta` de sus filas en `wallet_transactions`. Es lo único que puede
 * demostrar que el invariante `balance == Σ balance_delta` realmente se sostiene — todo lo demás
 * en este cambio es "debería" hasta que esto corre limpio.
 *
 * Read-only por diseño. **Nunca repara nada**: una reparación automática escondería el bug que
 * causó la discrepancia, y una reparación mal hecha es peor que una alarma ruidosa (proposal.md,
 * "Rejected Alternatives").
 *
 *     npm run reconcile-credits
 *
 * Sale con código 0 si no hay discrepancias, 1 si las hay o si falla.
 */
import { unscoped, withClient, closePools } from "../services/postgresClient.js";
import { queries } from "../services/queries.js";

const main = async () => {
  const discrepancies = await withClient(
    async (client) => client.query(queries.reconciliationDiscrepancies),
    { scope: unscoped("admin") },
  );
  const orphaned = await withClient(
    async (client) => client.query(queries.reconciliationOrphanedLedgerTotals),
    { scope: unscoped("admin") },
  );

  if (orphaned.length > 0) {
    console.log("Historial retenido de cuentas borradas (esperado, no es una discrepancia):");
    for (const row of orphaned) {
      console.log(
        `  comunidad ${row.community_id}: ${row.rows} filas, ` +
          `Σ balance_delta=${row.balance_delta_total}, Σ locked_delta=${row.locked_delta_total}`,
      );
    }
    console.log("");
  }

  if (discrepancies.length === 0) {
    console.log("OK: 0 discrepancias. El invariante balance == Σ balance_delta se sostiene.");
    return;
  }

  console.log(`!! ${discrepancies.length} USUARIOS CON DISCREPANCIA:\n`);
  for (const row of discrepancies) {
    console.log(
      `  usuario ${row.id} (comunidad ${row.community_id}): ` +
        `credits_balance=${row.credits_balance} vs Σ balance_delta=${row.ledger_balance}, ` +
        `credits_locked=${row.credits_locked} vs Σ locked_delta=${row.ledger_locked}`,
    );
  }
  process.exitCode = 1;
};

main()
  .catch((err) => {
    console.error("Error al reconciliar:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePools();
  });
