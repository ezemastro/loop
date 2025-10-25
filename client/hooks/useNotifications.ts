import { api } from "@/api/loop";
import { useInfiniteQuery } from "@tanstack/react-query";

const fetchNotifications = async () => {
  const response =
    await api.get<GetSelfNotificationsResponse>("/me/notifications");
  return response.data;
};

export const useNotifications = () => {
  return useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    getNextPageParam: (lastPage) => lastPage.pagination.nextPage || null,
    initialPageParam: 1,
  });
};
