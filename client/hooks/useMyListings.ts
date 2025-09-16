import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchMyListings = async (params: GetSelfListingsRequest["query"]) => {
  try {
    const response = await api.get<GetSelfListingsResponse>("/me/listings", {
      params,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw {
        name: parseErrorName({ status: error.response?.status || 500 }),
        message: error.message,
      };
    }
  }
};

export const useMyListings = (params: GetSelfListingsRequest["query"]) => {
  return useInfiniteQuery({
    queryKey: ["listings", "owner", params],
    queryFn: () => fetchMyListings(params),
    getNextPageParam: (lastPage) => lastPage?.pagination.nextPage || undefined,
    initialPageParam: 1,
  });
};
