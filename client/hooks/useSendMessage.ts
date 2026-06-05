import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

type Params = PostMessageRequest["body"];
const fetchSendMessage = async ({
  params,
  userId,
}: {
  params: Params;
  userId: PostMessageRequest["params"]["userId"];
}) => {
  try {
    const response = await api.post<PostMessageResponse>(`/messages/${userId}`, params);

    if (!response.data.success) {
      throw { message: response.data.error || "Error desconocido", errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const useSendMessage = ({ userId }: { userId: PostMessageRequest["params"]["userId"] }) => {
  return useMutation({
    mutationFn: (params: Params) => fetchSendMessage({ params, userId }),
  });
};
