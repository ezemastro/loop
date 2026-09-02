import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchNotifications = async () => {
  try {
    const response = await api.get<GetSelfNotificationsResponse>("/me/notifications");
    return response.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useNotifications = () => {
  return useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    getNextPageParam: (lastPage) => lastPage.pagination.nextPage || null,
    initialPageParam: 1,
  });
};
