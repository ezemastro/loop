import { api } from "@/api/loop";
import { ApiError, parseErrorName } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchUsers = async (params: GetUsersRequest["query"]) => {
  try {
    const { page = 1, searchTerm = "" } = params || {};
    const response = await api.get<GetUsersResponse>("/users", {
      params: { page, searchTerm },
    });
    return response.data;
  } catch (err) {
    if (err instanceof AxiosError) {
      const errName = parseErrorName({ status: err.response?.status || 500 });
      throw {
        name: errName,
        message: err.message,
      } as ApiError;
    }
    throw err;
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
