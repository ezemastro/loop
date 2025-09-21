import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchChats = async () => {
  try {
    const response = await api.get<GetSelfMessagesResponse>("/me/messages");
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw {
        name: parseErrorName({ status: error.response?.status || 500 }),
        message: error.message,
      };
    }
  }
};

export const useChats = () => {
  return useInfiniteQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
    getNextPageParam: (lastPage) => {
      return lastPage?.pagination?.nextPage || null;
    },
    initialPageParam: 1,
  });
};
