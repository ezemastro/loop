import type { NextFunction, Request, Response } from "express";
import { ListingsModel } from "../models/listings";
import {
  validateGetListingsRequest,
  validateId,
  validateMakeOfferRequest,
  validatePatchListingsRequest,
  validatePostListingsRequest,
  validateTradingListingIds,
} from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { successResponse } from "../utils/responses";
import { safeNumber } from "../utils/safeNumber";
import { parseQuery } from "../utils/parseQuery";

export class ListingsController {
  static getListings = async (req: Request, res: Response, next: NextFunction) => {
    const parsedQuery: GetListingsRequest["query"] = {
      ...parseQuery(req.query),
      page: safeNumber(req.query.page),
    };
    try {
      await validateGetListingsRequest(parsedQuery);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { page, order, sort, searchTerm, categoryId, userId, productStatus, schoolId, sellerId } =
      parsedQuery || {};

    let listings: Listing[];
    let pagination: Pagination;
    try {
      ({ listings, pagination } = await ListingsModel.getListings({
        page,
        order,
        sort,
        searchTerm,
        categoryId,
        userId,
        productStatus,
        schoolId,
        sellerId,
        communityId: req.session!.communityId!,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { listings }, pagination }));
  };

  static createListing = async (req: Request, res: Response, next: NextFunction) => {
    const parsedBody = {
      ...parseQuery(req.body),
      price: safeNumber(req.body.price) as number,
    } as PostListingsRequest["body"];
    try {
      await validatePostListingsRequest(parsedBody);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { title, description, price, categoryId, productStatus, mediaIds } = parsedBody;

    let listing: Listing;
    try {
      ({ listing } = await ListingsModel.createListing({
        title,
        description,
        price,
        categoryId,
        userId: req.session!.userId,
        productStatus,
        mediaIds,
        communityId: req.session!.communityId!,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(201).json(successResponse({ data: { listing } }));
  };

  static updateListing = async (req: Request, res: Response, next: NextFunction) => {
    const parsedBody = {
      ...req.body,
      price: safeNumber(req.body.price) as number | undefined,
    } as PatchListingsRequest["body"];
    const { listingId } = req.params as PatchListingsRequest["params"];
    try {
      await validatePatchListingsRequest(parsedBody);
      await validateId(listingId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { title, description, price, categoryId, productStatus, mediaIds } = parsedBody;

    let listing: Listing;
    try {
      ({ listing } = await ListingsModel.updateListing({
        listingId,
        title,
        description,
        price,
        categoryId,
        userId: req.session!.userId,
        productStatus,
        mediaIds,
        communityId: req.session!.communityId!,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { listing } }));
  };

  static deleteListing = async (req: Request, res: Response, next: NextFunction) => {
    const { listingId } = req.params as DeleteListingRequest["params"];
    try {
      await validateId(listingId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }

    try {
      await ListingsModel.deleteListing({
        listingId,
        userId: req.session!.userId,
        communityId: req.session!.communityId!,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };

  static getListingById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { listingId } = req.params as GetListingByIdRequest["params"];

    let listing: Listing;
    try {
      ({ listing } = await ListingsModel.getListingById({
        listingId,
        communityId: req.session!.communityId!,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { listing } }));
  };

  static makeOffer = async (req: Request, res: Response, next: NextFunction) => {
    let price: number;
    try {
      await validateId(req.params.listingId);
      // `makeOffer` no tenía NINGÚN schema antes de esto (design D12, "defectos que el audit no
      // registra"): `offeredCredits: undefined` pasaba las tres comparaciones porque todas son
      // `false` contra `undefined`.
      ({ price } = await validateMakeOfferRequest(req.body));
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { listingId } = req.params as PostListingOfferRequest["params"];

    let listing: Listing;
    try {
      ({ listing } = await ListingsModel.newOffer({
        listingId,
        userId: req.session!.userId,
        offeredCredits: price,
        communityId: req.session!.communityId!,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(201).json(successResponse({ data: { listing } }));
  };

  static deleteOffer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { listingId } = req.params as DeleteListingOfferRequest["params"];

    try {
      await ListingsModel.deleteOffer({
        listingId,
        userId: req.session!.userId,
        communityId: req.session!.communityId!,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };

  static rejectOffer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { listingId } = req.params as PostListingOfferRejectRequest["params"];

    try {
      await ListingsModel.rejectOffer({
        listingId,
        userId: req.session!.userId,
        communityId: req.session!.communityId!,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };

  static acceptOffer = async (req: Request, res: Response, next: NextFunction) => {
    let tradingListingIds: UUID[] = [];
    try {
      await validateId(req.params.listingId);
      // Array con tope y sin duplicados (listing-lifecycle: "Duplicate traded identifiers are
      // rejected") — antes cada elemento se validaba como UUID suelto, sin cardinalidad ni dedup,
      // y un id repetido se contaba dos veces al sumar precio.
      if (req.body.tradingListingIds !== undefined) {
        tradingListingIds = await validateTradingListingIds(req.body.tradingListingIds);
      }
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { listingId } = req.params as PostListingOfferAcceptRequest["params"];

    try {
      await ListingsModel.acceptOffer({
        listingId,
        tradingListingIds,
        userId: req.session!.userId,
        communityId: req.session!.communityId!,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };

  static cancelListing = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { listingId } = req.params as PostListingCancelRequest["params"];

    try {
      await ListingsModel.cancelListing({
        listingId,
        userId: req.session!.userId,
        communityId: req.session!.communityId!,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };

  static receiveListing = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { listingId } = req.params as PostListingOfferRequest["params"];

    try {
      await ListingsModel.receiveListing({
        listingId,
        userId: req.session!.userId,
        communityId: req.session!.communityId!,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };
}
