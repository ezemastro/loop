import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

type Params = PostListingOfferRequest["params"] & PostListingOfferRequest["body"];
const fetchNewOffer = async (params: Params) => {
  try {
    const response = await api.post<PostListingOfferResponse>(
      `/listings/${params.listingId}/offer`,
      params,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useListingNewOffer = (params: Params) => {
  return useMutation({
    mutationKey: ["listing", "offer", "new", params],
    mutationFn: () => fetchNewOffer(params),
  });
};
