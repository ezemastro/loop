import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchUser = async (params: GetUserByIdRequest["params"]) => {
  try {
    const response = await api.get<GetUserByIdResponse>(`/users/${params.userId}`);
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const useUser = (params: GetUserByIdRequest["params"]) => {
  return useQuery({
    queryKey: ["users", params.userId],
    queryFn: () => fetchUser(params),
  });
};
