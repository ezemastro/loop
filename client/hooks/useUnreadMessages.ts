import { api } from "@/api/loop";
import { useQuery } from "@tanstack/react-query";

const fetchUnreadMessages = async () => {
  const response = await api.get<GetSelfMessagesUnreadResponse>(
    "/me/messages/unread",
  );
  return response.data.data;
};

export const useUnreadMessages = () => {
  return useQuery({
    queryKey: ["unreadMessages"],
    queryFn: fetchUnreadMessages,
    refetchInterval: 30 * 1000,
  });
};
