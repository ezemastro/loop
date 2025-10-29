import { api } from "@/api/loop";
import { useMutation } from "@tanstack/react-query";

const fetchReadAllNotifications = async () => {
  const response = await api.post<PostSelfNotificationsReadAllRequest>(
    "/me/notifications/read-all",
  );
  return response.data;
};

export const useReadNotifications = () => {
  return useMutation({
    mutationFn: fetchReadAllNotifications,
  });
};
