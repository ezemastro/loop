import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchUnreadMessages = async () => {
  try {
    const response = await api.get<GetSelfMessagesUnreadResponse>("/me/messages/unread");
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useUnreadMessages = () => {
  return useQuery({
    queryKey: ["unreadMessages"],
    queryFn: fetchUnreadMessages,
    refetchInterval: 30 * 1000,
  });
};
