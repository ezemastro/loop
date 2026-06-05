import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

type Params = PostListingOfferRejectRequest["params"];
const fetchRejectOffer = async (params: Params) => {
  try {
    const response = await api.post<PostListingOfferRejectResponse>(
      `/listings/${params.listingId}/offer/reject`,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useListingRejectOffer = (params: Params) => {
  return useMutation({
    mutationKey: ["listing", "offer", "reject", params],
    mutationFn: () => fetchRejectOffer(params),
  });
};
