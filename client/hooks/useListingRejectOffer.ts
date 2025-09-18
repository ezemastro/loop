import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

type Params = PostListingOfferRejectRequest["params"];
const fetchRejectOffer = async (params: Params) => {
  try {
    const response = await api.post<PostListingOfferRejectResponse>(
      `/listings/${params.listingId}/offer/reject`,
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

export const useListingRejectOffer = (params: Params) => {
  return useMutation({
    mutationKey: ["listing", "offer", "reject", params],
    mutationFn: () => fetchRejectOffer(params),
  });
};
