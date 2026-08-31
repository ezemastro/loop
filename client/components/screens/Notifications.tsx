import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { MainView, pageContentClassName } from "../bases/MainView";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationCard from "../cards/Notification";
import Loader from "../Loader";
import { useReadNotifications } from "@/hooks/useReadNotifications";
import { useQueryClient } from "@tanstack/react-query";
import CustomRefresh from "../CustomRefresh";
import { useToast } from "@/components/ToastProvider";
import { getUserFriendlyErrorMessage } from "@/services/errorMapping";

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetching } = useNotifications();
  const { mutateAsync: readAllNotifications, isPending: isReading } = useReadNotifications();
  const { showToast } = useToast();
  const notifications = data?.pages.flatMap((page) => page.data!.notifications) || [];
  const headerClassName = pageContentClassName("narrow", "mb-2 items-end");
  const listContentClassName = pageContentClassName("narrow", "gap-2");

  const handleMarkAllRead = async () => {
    try {
      await readAllNotifications();
      queryClient.invalidateQueries({ queryKey: ["unreadNotifications"] });
    } catch (error) {
      showToast(getUserFriendlyErrorMessage(error), "error");
    }
  };

  return (
    <MainView className="p-4">
      {notifications.length > 0 && (
        <View className={headerClassName}>
          <TouchableOpacity
            className="rounded-lg bg-primary px-3 py-1.5 active:opacity-70"
            onPress={handleMarkAllRead}
            disabled={isReading}
          >
            <Text className="text-xs font-semibold text-white">
              {isReading ? "Marcando..." : "Marcar todo como leído"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        className="flex-1"
        data={notifications}
        contentContainerClassName={listContentClassName}
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
