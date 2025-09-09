import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

type Params = DeleteListingOfferRequest["params"];
const fetchDeleteOffer = async (params: Params) => {
  try {
    const response = await api.delete<DeleteListingOfferResponse>(
      `/listings/${params.listingId}/offer`,
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

export const useListingDeleteOffer = (params: Params) => {
  return useMutation({
    mutationKey: ["listing", "offer", "delete", params],
    mutationFn: () => fetchDeleteOffer(params),
  });
};
