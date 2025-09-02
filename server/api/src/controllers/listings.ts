import type { NextFunction, Request, Response } from "express";
import { ListingsModel } from "../models/listings";
import {
  validateGetListingsRequest,
  validateId,
  validatePatchListingsRequest,
  validatePostListingsRequest,
} from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { successResponse } from "../utils/responses";
import { safeNumber } from "../utils/safeNumber";
import { parseQuery } from "../utils/parseQuery";

export class ListingsController {
  static getListings = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const parsedQuery: GetListingsRequest["query"] = {
      page: safeNumber(req.query.page),
      ...parseQuery(req.query),
    };
    try {
      await validateGetListingsRequest(parsedQuery);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const {
      page,
      order,
      sort,
      searchTerm,
      categoryId,
      userId,
      productStatus,
      schoolId,
    } = parsedQuery || {};

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
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { listings }, pagination }));
  };

  static createListing = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const parsedBody = {
      price: safeNumber(req.body.price) as number,
      ...parseQuery(req.body),
    } as PostListingsRequest["body"];
    try {
      await validatePostListingsRequest(parsedBody);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { title, description, price, categoryId, productStatus, mediaIds } =
      parsedBody;

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
      }));
    } catch (err) {
      return next(err);
    }
    res.status(201).json(successResponse({ data: { listing } }));
  };

  static updateListing = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const parsedBody = {
      price: safeNumber(req.body.price) as number,
      ...parseQuery(req.body),
    } as PatchListingsRequest["body"];
    try {
      await validatePatchListingsRequest(parsedBody);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as PatchListingsRequest["params"];
    const { title, description, price, categoryId, productStatus, mediaIds } =
      parsedBody;

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
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { listing } }));
  };

  static getListingById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as GetListingByIdRequest["params"];

    let listing: Listing;
    try {
      ({ listing } = await ListingsModel.getListingById({ listingId }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { listing } }));
  };

  static makeOffer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const parsedBody: PostListingOfferRequest["body"] = {
      price: safeNumber(req.body.price),
      ...req.body,
    };
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as PostListingOfferRequest["params"];
    const { price } = parsedBody;

    let listing: Listing;
    try {
      ({ listing } = await ListingsModel.newOffer({
        listingId,
        userId: req.session!.userId,
        price,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(201).json(successResponse({ data: { listing } }));
  };

  static deleteOffer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as DeleteListingOfferRequest["params"];

    try {
      await ListingsModel.deleteOffer({
        listingId,
        userId: req.session!.userId,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };

  static rejectOffer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as PostListingOfferRejectRequest["params"];

    try {
      await ListingsModel.rejectOffer({
        listingId,
        userId: req.session!.userId,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };

  static acceptOffer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await validateId(req.params.listingId);
      if (req.body.tradingListingIds) {
        await Promise.all(req.body.tradingListingIds.map(validateId));
      }
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as PostListingOfferAcceptRequest["params"];
    const { tradingListingIds } =
      (req.body as PostListingOfferAcceptRequest["body"]) || {};

    try {
      await ListingsModel.acceptOffer({
        listingId,
        tradingListingIds: tradingListingIds || [],
        userId: req.session!.userId,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };

  static receiveListing = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as PostListingOfferRequest["params"];

    try {
      await ListingsModel.receiveListing({
        listingId,
        userId: req.session!.userId,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).json(successResponse());
  };
}
