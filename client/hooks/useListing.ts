import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchListing = async (params: GetListingByIdRequest["params"]) => {
  try {
    const response = await api.get<GetListingByIdResponse>(`/listings/${params.listingId}`);
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useListing = (params: GetListingByIdRequest["params"]) => {
  return useQuery({
    queryKey: ["listing", params.listingId],
    queryFn: () => fetchListing(params),
  });
};
