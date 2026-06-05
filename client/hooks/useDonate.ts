import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

type Params = PostUserDonateRequest["params"] & PostUserDonateRequest["body"];
const fetchDonate = async (params: Params) => {
  try {
    const response = await api.post<PostUserDonateResponse>(
      `/users/${params.userId}/donate`,
      params,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useUserDonate = () => {
  return useMutation({
    mutationFn: (params: Params) => fetchDonate(params),
  });
};
