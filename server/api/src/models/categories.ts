import { ERROR_MESSAGES } from "../config";
import { InternalServerError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import type { DatabaseClient } from "../types/dbClient";
import { getAllCategories } from "../utils/helpersDb";

export class CategoriesModel {
  static getCategories = async () => {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const categories = await getAllCategories({ client });
      return { categories };
    } finally {
      client.release();
    }
  };
}
