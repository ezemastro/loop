import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

type Params = PostListingOfferAcceptRequest["params"] &
  PostListingOfferAcceptRequest["body"];
const fetchAcceptOffer = async (params: Params) => {
  try {
    const response = await api.post<PostListingOfferAcceptResponse>(
      `/listings/${params.listingId}/offer/accept`,
      params,
    );
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw {
        name: parseErrorName({ status: error.response?.status || 500 }),
        message: error.message,
      };
    }
  }
};

export const useListingAcceptOffer = (params: Params) => {
  return useMutation({
    mutationKey: ["listing", "offer", "accept", params],
    mutationFn: () => fetchAcceptOffer(params),
  });
};
