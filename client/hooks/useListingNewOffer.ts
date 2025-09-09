import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

type Params = PostListingOfferRequest["params"] &
  PostListingOfferRequest["body"];
const fetchNewOffer = async (params: Params) => {
  try {
    const response = await api.post<PostListingOfferResponse>(
      `/listings/${params.listingId}/offer`,
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

export const useListingNewOffer = (params: Params) => {
  return useMutation({
    mutationKey: ["listing", "offer", "new", params],
    mutationFn: () => fetchNewOffer(params),
  });
};
