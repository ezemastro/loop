import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

type Params = PostUserDonateRequest["params"] & PostUserDonateRequest["body"];
const fetchDonate = async (params: Params) => {
  try {
    const response = await api.post<PostUserDonateResponse>(
      `/users/${params.userId}/donate`,
      params,
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

export const useUserDonate = () => {
  return useMutation({
    mutationFn: (params: Params) => fetchDonate(params),
  });
};
