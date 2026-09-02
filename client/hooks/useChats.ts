import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchChats = async () => {
  try {
    const response = await api.get<GetSelfMessagesResponse>("/me/messages");
    return response.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useChats = () => {
  return useInfiniteQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination?.nextPage || null;
    },
    initialPageParam: 1,
  });
};
