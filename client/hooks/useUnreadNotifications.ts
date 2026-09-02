import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchUnreadNotifications = async () => {
  try {
    const response = await api.get<GetSelfNotificationsUnreadResponse>("/me/notifications/unread");
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useUnreadNotifications = () => {
  return useQuery({
    queryKey: ["unreadNotifications"],
    queryFn: fetchUnreadNotifications,
    refetchInterval: 30 * 1000,
  });
};
