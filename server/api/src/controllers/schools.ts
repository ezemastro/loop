import type { NextFunction, Request, Response } from "express";
import { safeValidateUUID, validateGetSchoolsRequest, validateId } from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { SchoolsModel } from "../models/schools";
import { successResponse } from "../utils/responses";
import { safeNumber } from "../utils/safeNumber";
import { parseQuery } from "../utils/parseQuery";
import { getCommunityById, resolveCommunityByDomain } from "../utils/communities.js";

/**
 * De qué comunidad son los colegios que se están pidiendo.
 *
 * `GET /schools` sigue siendo público porque lo usa la pantalla de registro, que todavía no tiene
 * sesión: ahí la comunidad llega como `communityId` o se deduce del dominio del correo que la
 * persona acaba de escribir. Pero la sesión SIEMPRE gana sobre lo que venga por query; si no,
 * alguien logueado podría listar los colegios de otra comunidad mandando `?communityId=`.
 */
const resolveCommunityId = async (req: Request): Promise<UUID | null> => {
  if (req.session?.communityId) return req.session.communityId;

  const communityIdParam = req.query.communityId;
  if (typeof communityIdParam === "string" && (await safeValidateUUID(communityIdParam)).success) {
    const community = await getCommunityById(communityIdParam);
    if (community?.active) return community.id;
  }

  const domainParam = req.query.domain;
  if (typeof domainParam === "string" && domainParam.length > 0) {
    const community = await resolveCommunityByDomain(domainParam);
    if (community) return community.id;
  }

  return null;
};

export class SchoolsController {
  static getSchools = async (req: Request, res: Response, next: NextFunction) => {
    const parsedQuery: GetSchoolsRequest["query"] = {
      ...parseQuery(req.query),
      page: safeNumber(req.query.page),
    };
    try {
      await validateGetSchoolsRequest(parsedQuery);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { page, sort, order, searchTerm } = parsedQuery;

    let communityId: UUID | null;
    try {
      communityId = await resolveCommunityId(req);
    } catch (err) {
      return next(err);
    }
    if (!communityId) {
      return next(new InvalidInputError(ERROR_MESSAGES.COMMUNITY_REQUIRED, "COMMUNITY_REQUIRED"));
    }

    let schools: School[];
    let pagination: Pagination;
    try {
      ({ schools, pagination } = await SchoolsModel.getSchools({
        communityId,
        page,
        sort,
        order,
        searchTerm,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { schools }, pagination }));
  };
  static getSchoolById = async (req: Request, res: Response, next: NextFunction) => {
    // A diferencia del listado, el detalle sí requiere sesión: se scopea a la comunidad del usuario.
    const { communityId } = req.session!;
    const schoolId = Array.isArray(req.params.schoolId)
      ? req.params.schoolId[0]
      : req.params.schoolId;
    try {
      await validateId(schoolId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    let school: School;
    try {
      ({ school } = await SchoolsModel.getSchoolById({
        schoolId: schoolId!,
        communityId: communityId!,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { school } }));
  };
}
