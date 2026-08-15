import { inCommunity, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import type { GetGlobalStatsPayload } from "../types/models";
import { parseGlobalStatsFromDb } from "../utils/parseDb";

export class StatsModel {
  /** `global_stats` pasó a tener una fila por estadística **y por comunidad**. */
  static async getGlobalStats({ communityId }: GetGlobalStatsPayload) {
    return withClient(
      async (client) => {
        const globalStatsDb = await client.query(queries.getGlobalStats, [client.communityId]);
        const globalStats = parseGlobalStatsFromDb(globalStatsDb);
        return { globalStats };
      },
      { scope: inCommunity(communityId) },
    );
  }
}
