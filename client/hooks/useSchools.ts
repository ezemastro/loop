import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchSchools = async (
  params: GetSchoolsRequest["query"],
): Promise<{ schools: School[]; pagination: Pagination }> => {
  const { page = 1, searchTerm = "", communityId, domain } = params || {};
  try {
    // El servidor exige saber la comunidad (si hay sesión, la de la sesión gana igual).
    const response = await api.get<GetSchoolsResponse>("/schools", {
      params: {
        page,
        searchTerm,
        ...(communityId ? { communityId } : {}),
        ...(domain ? { domain } : {}),
      },
    });
    return {
      schools: response.data.data!.schools,
      pagination: response.data.pagination,
    };
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useSchools = (
  params?: GetSchoolsRequest["query"],
  options?: { enabled?: boolean },
) => {
  return useInfiniteQuery({
    queryKey: ["schools", params],
    queryFn: ({ pageParam }) => fetchSchools({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.nextPage;
    },
    initialPageParam: 1,
    enabled: options?.enabled ?? true,
  });
};
