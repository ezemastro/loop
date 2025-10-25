import { api } from "@/api/loop";
import { useMutation } from "@tanstack/react-query";

const fetchReadAllNotifications = async () => {
  const response =
    await api.get<PostSelfNotificationsReadAllResponse>("/me/notifications");
  return response.data;
};

export const useReadNotifications = () => {
  return useMutation({
    mutationFn: fetchReadAllNotifications,
  });
};
