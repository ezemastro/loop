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

export class ListingsController {
  static getListings = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await validateGetListingsRequest(req.query);
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
    } = (req.query as GetListingsRequest["query"]) || {};

    const { listings, pagination } = await ListingsModel.getListings({
      page,
      order,
      sort,
      searchTerm,
      categoryId,
      userId,
      productStatus,
      schoolId,
    });
    res.status(200).json(successResponse({ data: { listings }, pagination }));
  };

  static createListing = async (req: Request, res: Response) => {
    try {
      await validatePostListingsRequest(req.body);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { title, description, price, categoryId, productStatus, mediaIds } =
      req.body as PostListingsRequest["body"];

    const listing = await ListingsModel.createListing({
      title,
      description,
      price,
      categoryId,
      userId: req.session!.userId,
      productStatus,
      mediaIds,
    });
    res.status(201).json(successResponse({ data: { listing } }));
  };

  static updateListing = async (req: Request, res: Response) => {
    try {
      await validatePatchListingsRequest(req.body);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as PatchListingsRequest["params"];
    const { title, description, price, categoryId, productStatus, mediaIds } =
      req.body as PatchListingsRequest["body"];

    const listing = await ListingsModel.updateListing({
      listingId,
      title,
      description,
      price,
      categoryId,
      userId: req.session!.userId,
      productStatus,
      mediaIds,
    });
    res.status(200).json(successResponse({ data: { listing } }));
  };

  static getListingById = async (req: Request, res: Response) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as GetListingByIdRequest["params"];

    const { listing } = await ListingsModel.getListingById({ listingId });
    res.status(200).json(successResponse({ data: { listing } }));
  };

  static makeOffer = async (req: Request, res: Response) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as PostListingOfferRequest["params"];
    const { price } = req.body as PostListingOfferRequest["body"];

    const { listing } = await ListingsModel.newOffer({
      listingId,
      userId: req.session!.userId,
      price,
    });
    res.status(201).json(successResponse({ data: { listing } }));
  };

  static deleteOffer = async (req: Request, res: Response) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as DeleteListingOfferRequest["params"];

    await ListingsModel.deleteOffer({
      listingId,
      userId: req.session!.userId,
    });
    res.status(204).json(successResponse());
  };

  static rejectOffer = async (req: Request, res: Response) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as PostListingOfferRejectRequest["params"];

    await ListingsModel.rejectOffer({
      listingId,
      userId: req.session!.userId,
    });
    res.status(204).json(successResponse());
  };

  static acceptOffer = async (req: Request, res: Response) => {
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

    await ListingsModel.acceptOffer({
      listingId,
      tradingListingIds: tradingListingIds || [],
      userId: req.session!.userId,
    });
    res.status(204).json(successResponse());
  };

  static receiveListing = async (req: Request, res: Response) => {
    try {
      await validateId(req.params.listingId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { listingId } = req.params as PostListingOfferRequest["params"];

    await ListingsModel.receiveListing({
      listingId,
      userId: req.session!.userId,
    });
    res.status(204).json(successResponse());
  };
}
