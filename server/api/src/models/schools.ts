import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { getMediaById, getSchoolById } from "../utils/helpersDb";
import {
  parsePagination,
  parseSchoolFromBase,
  parseSchoolFromDb,
} from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";

export class SchoolsModel {
  static getSchools = async (query: GetSchoolsRequest["query"]) => {
    const {
      page = 1,
      sort = "created_at",
      order = "desc",
      searchTerm,
    } = query || {};

    // Obtener cliente
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      let searchSchoolsDb;
      try {
        searchSchoolsDb = await client.query(queries.searchSchools, [
          searchTerm ?? null,
          sort,
          order,
          PAGE_SIZE,
          page ? (page - 1) * PAGE_SIZE : 0,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
      }
      const totalRecords = searchSchoolsDb[0]?.total_records || 0;
      const schools = await Promise.all(
        searchSchoolsDb.map(async (schoolDb) => {
          return parseSchoolFromBase({
            school: parseSchoolFromDb(schoolDb),
            media: await getMediaById({ client, mediaId: schoolDb.media_id }),
          });
        }),
      );
      return {
        schools,
        pagination: parsePagination({
          currentPage: page,
          totalRecords: safeNumber(totalRecords) || 0,
        }),
      };
    } finally {
      client.release();
    }
  };

  static getSchoolById = async ({ schoolId }: { schoolId: UUID }) => {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const school = await getSchoolById({ client, schoolId });
      return { school };
    } finally {
      client.release();
    }
  };
}
