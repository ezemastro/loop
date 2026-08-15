import type { NextFunction, Request, Response } from "express";
import { ERROR_MESSAGES } from "../config.js";
import { InvalidInputError, NotFoundError } from "../services/errors.js";
import {
  extractDomain,
  getCommunityBySlug,
  resolveCommunityByDomain,
} from "../utils/communities.js";
import { parseQuery } from "../utils/parseQuery.js";
import { successResponse } from "../utils/responses.js";

/**
 * Catálogo público de comunidades.
 *
 * Es lo que le permite a la pantalla de registro saber, a partir del correo que el usuario está
 * tipeando, a qué comunidad pertenece: con eso filtra la lista de colegios y se pinta con los
 * colores de esa comunidad.
 *
 * Solo devuelve datos de presentación (`id`, `slug`, `name`, `theme`, `media`, `active`). Nunca la
 * lista de dominios ni ningún conteo.
 */
export class CommunitiesController {
  static resolve = async (req: Request, res: Response, next: NextFunction) => {
    const query = parseQuery(req.query) as GetCommunityResolveRequest["query"];

    // Se acepta `email` por comodidad del cliente, pero solo se usa lo que está después de la
    // arroba: así el correo completo no termina en los logs de acceso del servidor.
    const domain = query.domain ? query.domain.trim().toLowerCase() : extractDomain(query.email ?? "");

    if (!domain) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT, "INVALID_INPUT"));
    }

    try {
      const community = await resolveCommunityByDomain(domain);
      // Un dominio desconocido no es un error: la pantalla de registro lo muestra como
      // "no reconocemos ese dominio" y sigue funcionando.
      return res.status(200).json(successResponse({ data: { community } }));
    } catch (err) {
      return next(err);
    }
  };

  static getBySlug = async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params as unknown as GetCommunityBySlugRequest["params"];
    try {
      const community = await getCommunityBySlug(slug);
      if (!community) {
        return next(new NotFoundError(ERROR_MESSAGES.COMMUNITY_NOT_FOUND, "COMMUNITY_NOT_FOUND"));
      }
      return res.status(200).json(successResponse({ data: { community } }));
    } catch (err) {
      return next(err);
    }
  };
}
