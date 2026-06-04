import { withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import { parseGlobalStatsFromDb } from "../utils/parseDb";

export class StatsModel {
  static async getGlobalStats() {
    return withClient(async (client) => {
      const globalStatsDb = await client.query(queries.getGlobalStats);
      const globalStats = parseGlobalStatsFromDb(globalStatsDb);
      return { globalStats };
    });
  }
}
