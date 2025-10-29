import { FlatList, Text } from "react-native";
import { MainView } from "../bases/MainView";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationCard from "../cards/Notification";
import Loader from "../Loader";
import { useReadNotifications } from "@/hooks/useReadNotifications";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import CustomRefresh from "../CustomRefresh";

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetching } =
    useNotifications();
  const { mutateAsync: readAllNotifications } = useReadNotifications();
  const notifications =
    data?.pages.flatMap((page) => page.data!.notifications) || [];

  useEffect(() => {
    if (!isLoading && notifications.length > 0) {
      readAllNotifications().then(() => {
        queryClient.invalidateQueries({ queryKey: ["unreadNotifications"] });
      });
    }
  }, [isLoading, notifications.length, readAllNotifications, queryClient]);

  return (
    <MainView className="p-4">
      <FlatList
        data={notifications}
        contentContainerClassName="gap-2"
        renderItem={({ item }) => <NotificationCard notification={item} />}
        refreshControl={<CustomRefresh refreshing={isFetching} />}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={() => (
          <>
            {isLoading && <Loader />}
            {!isLoading && !isError && !notifications.length && (
              <Text className="text-secondary-text text-center">
                No tienes notificaciones
              </Text>
            )}
            {isError && (
              <Text className="text-red-500 text-center">
                Error al cargar las notificaciones
              </Text>
            )}
          </>
        )}
      />
    </MainView>
  );
}
