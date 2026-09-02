import fs from "fs";
import path from "path";

import { fetchCancelListing } from "../hooks/useListingCancel";
import { ERROR_NAMES } from "../services/errors";

/**
 * `api/loop.ts` transitively imports `@/demo` -> `../../shared/demo-data`, which fails to resolve
 * `@babel/runtime` under jest (the same pre-existing gap `api-client.test.ts` documents). The whole
 * client module is stubbed here because this suite is testing the cancel request's own error
 * contract, not the interceptor wiring.
 */
jest.mock("@/api/loop", () => ({
  api: { post: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require("@/api/loop") as { api: { post: jest.Mock } };

const PARAMS = { listingId: "11111111-1111-1111-1111-111111111111" } as const;

beforeEach(() => {
  api.post.mockReset();
});

describe("fetchCancelListing", () => {
  it("posts to the cancel endpoint of the given listing", async () => {
    api.post.mockResolvedValue({ data: { data: undefined } });
    await fetchCancelListing(PARAMS);
    expect(api.post).toHaveBeenCalledWith(`/listings/${PARAMS.listingId}/cancel`);
  });

  /**
   * The error path that matters in the UI: the counterparty changed the listing first, so the
   * server answers 409 `INVALID_LISTING_STATUS_TO_CANCEL`. The hook must surface a `parseApiError`
   * shape, never the raw Axios error and never a swallowed `undefined` — `ListingButtons` reads
   * `message`/`errorCode` off it to tell the user what happened.
   */
  it("turns a 409 from a stale listing into a parsed ApiError instead of the raw Axios error", async () => {
    api.post.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 409",
      response: {
        status: 409,
        data: {
          error: "La publicación no está en un estado que se pueda cancelar",
          errorCode: "INVALID_LISTING_STATUS_TO_CANCEL",
        },
      },
    });

    await expect(fetchCancelListing(PARAMS)).rejects.toMatchObject({
      name: ERROR_NAMES.CONFLICT,
      errorCode: "INVALID_LISTING_STATUS_TO_CANCEL",
      message: "La publicación no está en un estado que se pueda cancelar",
    });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("turns a 401 from a non-party caller into an UnauthorizedError", async () => {
    api.post.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 401",
      response: {
        status: 401,
        data: { error: "No sos parte de esta publicación", errorCode: "NOT_LISTING_PARTY" },
      },
    });

    await expect(fetchCancelListing(PARAMS)).rejects.toMatchObject({
      name: ERROR_NAMES.UNAUTHORIZED,
      errorCode: "NOT_LISTING_PARTY",
    });
  });

  it("never rejects with a bare Axios error object", async () => {
    api.post.mockRejectedValue({ isAxiosError: true, message: "Network Error" });
    const error = await fetchCancelListing(PARAMS).catch((e) => e);
    expect(error).not.toHaveProperty("isAxiosError");
    expect(error.name).toBe(ERROR_NAMES.INTERNAL_SERVER);
  });
});

/**
 * Source guards. The cancel button and its invalidation are the two places where drifting away
 * from the server's rules is silent: a wrong query key leaves a stale balance on screen, and a
 * looser render condition just buys the user a 409.
 */
describe("cancel wiring guards", () => {
  const hookSource = fs.readFileSync(
    path.join(__dirname, "..", "hooks", "useListingCancel.ts"),
    "utf8",
  );
  const buttonsSource = fs.readFileSync(
    path.join(__dirname, "..", "components", "ListingButtons.tsx"),
    "utf8",
  );

  it("invalidates the unified listing key, not the legacy object-argument variant", () => {
    expect(hookSource).toContain('queryKey: ["listing", params.listingId]');
    // Comment lines are stripped first: the docblock names the legacy shape in order to warn
    // against it, and matching that would fail the guard for the exact reason it exists.
    const hookCode = hookSource
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join("\n");
    expect(hookCode).not.toMatch(/\["listing",\s*\{/);
  });

  it("invalidates the lists and the caller's own balance too", () => {
    expect(hookSource).toContain('queryKey: ["listings"], exact: false');
    expect(hookSource).toContain('queryKey: ["self"]');
  });

  it("only offers cancel for an accepted listing and only to the seller or the buyer", () => {
    expect(buttonsSource).toContain('listing.listingStatus === "accepted"');
    expect(buttonsSource).toContain(
      "user.id === listing.seller.id || user.id === listing.buyer?.id",
    );
  });

  it("confirms through showAlert rather than Alert.alert", () => {
    expect(buttonsSource).toContain("showAlert(");
    expect(buttonsSource).not.toContain("Alert.alert");
  });
});
