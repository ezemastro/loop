import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchListings = async (params: GetListingsRequest["query"]) => {
  try {
    const response = await api.get<GetListingsResponse>("/listings", {
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

export const useListings = (params: GetListingsRequest["query"]) => {
  return useInfiniteQuery({
    queryKey: ["listings", params],
    queryFn: () => fetchListings(params),
    getNextPageParam: (lastPage) => lastPage?.pagination.nextPage || undefined,
    initialPageParam: 1,
  });
};
