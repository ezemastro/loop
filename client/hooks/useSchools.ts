import { api } from "@/api/loop";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchSchools = async (
  params: GetSchoolsRequest["query"],
): Promise<{ schools: School[]; pagination: Pagination }> => {
  const { page = 1, searchTerm = "" } = params || {};
  const response = await api.get<GetSchoolsResponse>("/api/schools", {
    params: { page, searchTerm },
  });
  return {
    schools: response.data.data!.schools,
    pagination: response.data.pagination,
  };
};

export const useSchools = (params?: GetSchoolsRequest["query"]) => {
  return useInfiniteQuery({
    queryKey: ["schools", params],
    queryFn: () => fetchSchools(params),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.nextPage;
    },
    initialPageParam: 1,
  });
};
