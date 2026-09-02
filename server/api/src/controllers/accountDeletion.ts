import type { NextFunction, Request, Response } from "express";
import { ERROR_MESSAGES } from "../config.js";
import { AccountDeletionModel } from "../models/accountDeletion.js";
import { InvalidInputError } from "../services/errors.js";
import { safeValidateEmail } from "../services/validations.js";
import { parseQuery } from "../utils/parseQuery.js";
import { safeNumber } from "../utils/safeNumber.js";
import { successResponse } from "../utils/responses.js";

export class AccountDeletionController {
  /**
   * Endpoint público que usa la landing para cumplir con el requisito de borrado de cuenta de las
   * tiendas.
   *
   * Responde 204 siempre, exista o no el correo: si distinguiera ambos casos se convertiría en un
   * oráculo para averiguar qué direcciones están registradas.
   */
  static requestDeletion = async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body as PostSelfDeleteRequest["body"];
    // `safeValidateEmail` uses `.safeParseAsync`, which never throws — it was wrapped in a
    // try/catch that could never fire, so a malformed address flowed straight into the model
    // (proposal C8). The result must be checked explicitly.
    const validation = await safeValidateEmail(email);
    if (!validation.success) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }

    try {
      await AccountDeletionModel.requestDeletion({ email });
    } catch (err) {
      return next(err);
    }
    return res.status(204).send(successResponse());
  };

  static listRequests = async (req: Request, res: Response, next: NextFunction) => {
    const query = parseQuery(req.query) as GetAdminDeletionRequestsRequest["query"];
    // Un admin de comunidad solo ve las suyas; un super admin las ve todas y puede filtrar.
    const communityId =
      req.session?.adminRole === "super_admin"
        ? (query?.communityId ?? null)
        : (req.session?.adminCommunityId ?? null);

    try {
      const result = await AccountDeletionModel.listRequests({
        ...(query?.status ? { status: query.status } : {}),
        communityId,
        page: safeNumber(query?.page),
      });
      return res.status(200).json(
        successResponse({
          data: { deletionRequests: result.deletionRequests },
          pagination: result.pagination,
        }),
      );
    } catch (err) {
      return next(err);
    }
  };

  static resolveRequest = async (req: Request, res: Response, next: NextFunction) => {
    const { requestId } = req.params as unknown as PostAdminResolveDeletionRequest["params"];
    const { action } = req.body as PostAdminResolveDeletionRequest["body"];

    if (action !== "completed" && action !== "rejected") {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }

    const communityId =
      req.session?.adminRole === "super_admin" ? null : (req.session?.adminCommunityId ?? null);

    try {
      await AccountDeletionModel.resolveRequest({
        requestId,
        action,
        adminId: req.session!.adminId!,
        communityId,
      });
      return res.status(200).json(successResponse());
    } catch (err) {
      return next(err);
    }
  };
}
