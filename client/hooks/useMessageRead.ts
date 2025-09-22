import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

type Params = PostMessageReadRequest["params"];
const fetchMessageRead = async (params: Params) => {
  try {
    const response = await api.post<PostMessageReadResponse>(
      `/messages/${params.userId}/read`,
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

export const useMessageRead = (params: Params) => {
  return useMutation({
    mutationFn: () => fetchMessageRead(params),
  });
};
