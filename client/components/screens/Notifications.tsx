import { FlatList, Text, TouchableOpacity } from "react-native";
import { MainView } from "../bases/MainView";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationCard from "../cards/Notification";
import Loader from "../Loader";
import { useReadNotifications } from "@/hooks/useReadNotifications";
import { useQueryClient } from "@tanstack/react-query";
import CustomRefresh from "../CustomRefresh";

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetching } = useNotifications();
  const { mutateAsync: readAllNotifications, isPending: isReading } = useReadNotifications();
  const notifications = data?.pages.flatMap((page) => page.data!.notifications) || [];

  const handleMarkAllRead = async () => {
    await readAllNotifications();
    queryClient.invalidateQueries({ queryKey: ["unreadNotifications"] });
  };

  return (
    <MainView className="p-4">
      {notifications.length > 0 && (
        <TouchableOpacity
          className="mb-2 self-end rounded-lg bg-primary px-3 py-1.5 active:opacity-70"
          onPress={handleMarkAllRead}
          disabled={isReading}
        >
          <Text className="text-xs font-semibold text-white">
            {isReading ? "Marcando..." : "Marcar todo como leído"}
          </Text>
        </TouchableOpacity>
      )}
      <FlatList
        className="flex-1"
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
              <Text className="text-secondary-text text-center">No tienes notificaciones</Text>
            )}
            {isError && (
              <Text className="text-red-500 text-center">Error al cargar las notificaciones</Text>
            )}
          </>
        )}
      />
    </MainView>
  );
}
