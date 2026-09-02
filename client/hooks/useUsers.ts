import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchUsers = async (params: GetUsersRequest["query"]) => {
  try {
    const { page = 1, searchTerm = "" } = params || {};
    const response = await api.get<GetUsersResponse>("/users", {
      params: { page, searchTerm },
    });
    return response.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const useUsers = (params?: GetUsersRequest["query"]) => {
  return useInfiniteQuery({
    queryKey: ["users", params],
    queryFn: ({ pageParam }) => fetchUsers({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.nextPage;
    },
    initialPageParam: 1,
  });
};
