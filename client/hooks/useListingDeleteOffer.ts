import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

type Params = DeleteListingOfferRequest["params"];
const fetchDeleteOffer = async (params: Params) => {
  try {
    const response = await api.delete<DeleteListingOfferResponse>(
      `/listings/${params.listingId}/offer`,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useListingDeleteOffer = (params: Params) => {
  return useMutation({
    mutationKey: ["listing", "offer", "delete", params],
    mutationFn: () => fetchDeleteOffer(params),
  });
};
