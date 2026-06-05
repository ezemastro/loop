import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Params = PostMessageReadRequest["params"];
const fetchMessageRead = async (params: Params) => {
  try {
    const response = await api.post<PostMessageReadResponse>(`/messages/${params.userId}/read`);
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useMessageRead = (params: Params) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchMessageRead(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
    },
  });
};
