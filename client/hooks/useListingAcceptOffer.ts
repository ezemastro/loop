import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

type Params = PostListingOfferAcceptRequest["params"] & PostListingOfferAcceptRequest["body"];
const fetchAcceptOffer = async (params: Params) => {
  try {
    const response = await api.post<PostListingOfferAcceptResponse>(
      `/listings/${params.listingId}/offer/accept`,
      params,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useListingAcceptOffer = (params: Params) => {
  return useMutation({
    mutationKey: ["listing", "offer", "accept", params],
    mutationFn: () => fetchAcceptOffer(params),
  });
};
