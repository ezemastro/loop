import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchMyListings = async (params: GetSelfListingsRequest["query"]) => {
  try {
    const response = await api.get<GetSelfListingsResponse>("/me/listings", {
      params,
    });
    return response.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useMyListings = (params: GetSelfListingsRequest["query"]) => {
  return useInfiniteQuery({
    queryKey: ["listings", "owner", params],
    queryFn: ({ pageParam }) => fetchMyListings({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => lastPage.pagination.nextPage || null,
    initialPageParam: 1,
  });
};
