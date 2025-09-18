import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchListing = async (params: GetListingByIdRequest["params"]) => {
  try {
    const response = await api.get<GetListingByIdResponse>(
      `/listings/${params.listingId}`,
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

export const useListing = (params: GetListingByIdRequest["params"]) => {
  return useQuery({
    queryKey: ["listing", params.listingId],
    queryFn: () => fetchListing(params),
  });
};
