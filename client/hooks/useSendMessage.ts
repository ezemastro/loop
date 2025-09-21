import { api } from "@/api/loop";
import { ApiError, parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

type Params = PostMessageRequest["body"];
const fetchSendMessage = async ({
  params,
  userId,
}: {
  params: Params;
  userId: PostMessageRequest["params"]["userId"];
}) => {
  try {
    const response = await api.post<PostMessageResponse>(
      `/messages/${userId}`,
      params,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Error desconocido");
    }
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

export const useSendMessage = ({
  userId,
}: {
  userId: PostMessageRequest["params"]["userId"];
}) => {
  return useMutation({
    mutationFn: (params: Params) => fetchSendMessage({ params, userId }),
  });
};
