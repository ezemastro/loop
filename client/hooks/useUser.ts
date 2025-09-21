import { api } from "@/api/loop";
import { useQuery } from "@tanstack/react-query";

const fetchUser = async (params: GetUserByIdRequest["params"]) => {
  const response = await api.get<GetUserByIdResponse>(
    `/users/${params.userId}`,
  );
  return response.data.data;
};

export const useUser = (params: GetUserByIdRequest["params"]) => {
  return useQuery({
    queryKey: ["users", params.userId],
    queryFn: () => fetchUser(params),
  });
};
