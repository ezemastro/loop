import { api } from "@/api/loop";
import { useQuery } from "@tanstack/react-query";

const fetchUnreadNotifications = async () => {
  const response = await api.get<GetSelfNotificationsUnreadResponse>(
    "/me/notifications/unread",
  );
  return response.data.data;
};

export const useUnreadNotifications = () => {
  return useQuery({
    queryKey: ["unreadNotifications"],
    queryFn: fetchUnreadNotifications,
    refetchInterval: 30 * 1000,
  });
};
