import { Router } from "express";
import { ListingsController } from "../controllers/listings";
import { tokenMiddleware } from "../middlewares/parseToken";

export const listingsRouter = Router();

listingsRouter.get("/", ListingsController.getListings);
listingsRouter.post("/", tokenMiddleware, ListingsController.createListing);
listingsRouter.patch(
  "/:listingId",
  tokenMiddleware,
  ListingsController.updateListing,
);
listingsRouter.post(
  "/:listingId/offer",
  tokenMiddleware,
  ListingsController.makeOffer,
);
listingsRouter.delete(
  "/:listingId/offer",
  tokenMiddleware,
  ListingsController.deleteOffer,
);
listingsRouter.post(
  "/:listingId/offer/reject",
  tokenMiddleware,
  ListingsController.rejectOffer,
);
listingsRouter.post(
  "/:listingId/offer/accept",
  tokenMiddleware,
  ListingsController.acceptOffer,
);
listingsRouter.post(
  "/:listingId/receive",
  tokenMiddleware,
  ListingsController.receiveListing,
);
