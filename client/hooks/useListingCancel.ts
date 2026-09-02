import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Params = PostListingCancelRequest["params"];

/**
 * Exported for the unit test: every other hook in this folder keeps its request function private,
 * but the cancel path is the only one that moves credits in both directions, so its error contract
 * (a raw Axios rejection never escapes — `parseApiError` shapes it first) is worth pinning down
 * directly rather than only through the source guard in `__tests__/api-errors.test.ts`.
 */
export const fetchCancelListing = async (params: Params) => {
  try {
    const response = await api.post<PostListingCancelResponse>(
      `/listings/${params.listingId}/cancel`,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

/**
 * ECO-05. Cancels an `accepted` loop; the server refunds each party exactly what this listing had
 * locked for them, so three things go stale at once: the listing itself, both lists that can show
 * it, and the caller's own credit balance.
 *
 * The listing key is the unified `["listing", id]` shape from `useListing.ts` — the older
 * `["listing", { listingId }]` variant would silently miss. `["listings"]` runs with `exact: false`
 * so it also reaches `["listings", "owner", params]` from `useMyListings.ts`.
 */
export const useListingCancel = (params: Params) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["listing", "cancel", params],
    mutationFn: () => fetchCancelListing(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing", params.listingId] });
      queryClient.invalidateQueries({ queryKey: ["listings"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["self"] });
    },
  });
};
