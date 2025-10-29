import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchWishes = async (params: GetUserWishesRequest["params"]) => {
  try {
    const response = await api.get<GetUserWishesResponse>(
      `/users/${params.userId}/wishes`,
      {
        params,
      },
    );
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw {
        name: parseErrorName({ status: error.response?.status || 500 }),
        message: error.message,
      };
    }
  }
};

export const usePublicWishes = (params: GetUserWishesRequest["params"]) => {
  return useQuery({
    queryKey: ["wishes", params.userId],
    queryFn: () => fetchWishes(params),
  });
};
