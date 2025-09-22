import { api } from "@/api/loop";
import { ApiError, parseErrorName } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchUser = async (params: GetUserByIdRequest["params"]) => {
  try {
    const response = await api.get<GetUserByIdResponse>(
      `/users/${params.userId}`,
    );
    return response.data.data;
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

export const useUser = (params: GetUserByIdRequest["params"]) => {
  return useQuery({
    queryKey: ["users", params.userId],
    queryFn: () => fetchUser(params),
  });
};
