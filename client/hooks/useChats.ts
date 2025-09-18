import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchChats = async () => {
  try {
    const response = await api.get<GetSelfMessagesResponse>("/me/messages");
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

export const useChats = () => {
  return useQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
  });
};
