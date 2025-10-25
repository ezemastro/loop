import { ERROR_MESSAGES } from "../config";
import { InternalServerError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { parseGlobalStatsFromDb } from "../utils/parseDb";

export class StatsModel {
  static async getGlobalStats() {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const globalStatsDb = await client.query(queries.getGlobalStats);
      const globalStats = parseGlobalStatsFromDb(globalStatsDb);
      return { globalStats };
    } finally {
      client.release();
    }
  }
}
