import { api } from "@/api/loop";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchRoles = async (
  params: GetRolesRequest["query"],
): Promise<{ roles: Role[]; pagination: Pagination }> => {
  const { page = 1, searchTerm = "" } = params || {};
  const response = await api.get<GetRolesResponse>("/roles", {
    params: { page, searchTerm },
  });
  return {
    roles: response.data.data!.roles,
    pagination: response.data.pagination,
  };
};

export const useRoles = (params?: GetRolesRequest["query"]) => {
  return useInfiniteQuery({
    queryKey: ["roles", params],
    queryFn: () => fetchRoles(params),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.nextPage;
    },
    initialPageParam: 1,
  });
};
