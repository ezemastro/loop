import { ERROR_MESSAGES } from "../config";
import { InternalServerError, InvalidInputError } from "../services/errors";
import type {
  DatabaseClient,
  DatabaseConnection,
  Queries,
} from "../types/dbClient";

export class ProfileModel {
  private dbConnection: DatabaseConnection;
  private queries: Queries;

  constructor({
    dbConnection,
    queries,
  }: {
    dbConnection: DatabaseConnection;
    queries: Queries;
  }) {
    this.dbConnection = dbConnection;
    this.queries = queries;
  }

  getProfile = async ({ userId }: { userId: string }) => {
    let client: DatabaseClient;
    try {
      client = await this.dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      let userDb;
      try {
        userDb = (await client.query(this.queries.userById, [userId]))[0];
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (!userDb) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      //aca
    } catch (error) {
      if (error instanceof InvalidInputError) {
        throw error;
      }
      throw new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      client.release();
    }
  };
}
