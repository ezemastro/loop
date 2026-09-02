import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchListings = async (params: GetListingsRequest["query"]) => {
  try {
    const response = await api.get<GetListingsResponse>("/listings", {
      params,
    });
    return response.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useListings = (params: GetListingsRequest["query"]) => {
  return useInfiniteQuery({
    queryKey: ["listings", params],
    queryFn: ({ pageParam }) => fetchListings({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => lastPage.pagination.nextPage || null,
    initialPageParam: 1,
  });
};
