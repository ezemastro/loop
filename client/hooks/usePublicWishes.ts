import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchWishes = async (params: GetUserWishesRequest["params"]) => {
  try {
    const response = await api.get<GetUserWishesResponse>(`/users/${params.userId}/wishes`, {
      params,
    });
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const usePublicWishes = (params: GetUserWishesRequest["params"]) => {
  return useQuery({
    queryKey: ["wishes", params.userId],
    queryFn: () => fetchWishes(params),
  });
};
