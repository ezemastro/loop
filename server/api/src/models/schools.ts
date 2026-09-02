import { PAGE_SIZE } from "../config";
import { inCommunity, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import type { GetSchoolByIdPayload, GetSchoolsPayload } from "../types/models";
import { getMediaById, getSchoolById } from "../utils/helpersDb";
import { parsePagination, parseSchoolFromBase, parseSchoolFromDb } from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";
import { escapeLike } from "../utils/escapeLike";

export class SchoolsModel {
  static getSchools = async ({
    communityId,
    page = 1,
    sort,
    order = "desc",
    searchTerm,
  }: GetSchoolsPayload) => {
    return withClient(
      async (client) => {
        const searchSchoolsDb = await client.query(queries.searchSchools, [
          searchTerm ? escapeLike(searchTerm) : null,
          // La query solo ordena cuando `sort` es 'name'; con cualquier otro valor deja el orden
          // natural, que es lo que hacía el default histórico.
          sort ?? "created_at",
          order,
          PAGE_SIZE,
          page ? (page - 1) * PAGE_SIZE : 0,
          client.communityId,
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
      },
      { scope: inCommunity(communityId) },
    );
  };

  static getSchoolById = async ({ schoolId, communityId }: GetSchoolByIdPayload) => {
    return withClient(
      async (client) => {
        const school = await getSchoolById({ client, schoolId });
        return { school };
      },
      { scope: inCommunity(communityId) },
    );
  };
}
