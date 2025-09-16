import { api } from "@/api/loop";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchUsers = async (
  params: GetUsersRequest["query"],
): Promise<{ users: User[]; pagination: Pagination }> => {
  const { page = 1, searchTerm = "" } = params || {};
  const response = await api.get<GetUsersResponse>("/users", {
    params: { page, searchTerm },
  });
  return {
    users: response.data.data!.users,
    pagination: response.data.pagination,
  };
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
