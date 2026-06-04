import { PAGE_SIZE } from "../config";
import { withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import { getMediaById, getSchoolById } from "../utils/helpersDb";
import { parsePagination, parseSchoolFromBase, parseSchoolFromDb } from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";

export class SchoolsModel {
  static getSchools = async (query: GetSchoolsRequest["query"]) => {
    const { page = 1, sort = "created_at", order = "desc", searchTerm } = query || {};

    return withClient(async (client) => {
      const searchSchoolsDb = await client.query(queries.searchSchools, [
        searchTerm ?? null,
        sort,
        order,
        PAGE_SIZE,
        page ? (page - 1) * PAGE_SIZE : 0,
      ]);
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
    });
  };

  static getSchoolById = async ({ schoolId }: { schoolId: UUID }) => {
    return withClient(async (client) => {
      const school = await getSchoolById({ client, schoolId });
      return { school };
    });
  };
}
