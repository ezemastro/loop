import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchReadAllNotifications = async () => {
  try {
    const response = await api.post<PostSelfNotificationsReadAllRequest>(
      "/me/notifications/read-all",
    );
    return response.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useReadNotifications = () => {
  return useMutation({
    mutationFn: fetchReadAllNotifications,
  });
};
