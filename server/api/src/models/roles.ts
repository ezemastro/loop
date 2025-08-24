import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { parsePagination, parseRoleFromDb } from "../utils/parseDb";

export class RolesModel {
  static getRoles = async (query: NonNullable<GetRolesRequest["query"]>) => {
    // Desestructuración y asignación de valores por defecto
    const { page = 1, sort = "name", order = "asc", searchTerm = "" } = query;
    // Obtener cliente
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch (err) {
      console.error("Error connecting to the database:", err);
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const rolesSearchDb = await client.query(queries.searchRoles, [
        searchTerm,
        sort,
        order,
        PAGE_SIZE,
        page ? (page - 1) * PAGE_SIZE : 0,
      ]);
      const totalRecords = rolesSearchDb[0]?.total_records || 0;

      return {
        roles: rolesSearchDb.map(parseRoleFromDb),
        pagination: parsePagination({
          currentPage: page || 1,
          totalRecords,
        }),
      };
    } finally {
      client.release();
    }
  };
}
