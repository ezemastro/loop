import { FlatList, Text, View } from "react-native";
import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { MainView, pageContentClassName } from "../bases/MainView";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationCard from "../cards/Notification";
import Loader from "../Loader";
import Error from "../Error";
import TextTitle from "../bases/TextTitle";
import { useReadNotifications } from "@/hooks/useReadNotifications";
import { useQueryClient } from "@tanstack/react-query";
import CustomRefresh from "../CustomRefresh";

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetching } = useNotifications();
  const { mutateAsync: readAllNotifications } = useReadNotifications();
  const notifications = data?.pages.flatMap((page) => page.data!.notifications) || [];
  const hasUnread = notifications.some((notification) => !notification.isRead);
  const headerClassName = pageContentClassName("narrow", "mb-3");
  const listContentClassName = pageContentClassName("narrow", "gap-2");

  /**
   * Marking happens when the screen is LEFT, not when it is entered.
   *
   * Marking on entry would clear the unread state before the first paint, so the unread styling
   * (accent bar, tint, bold title) could never actually be seen -- the signal would exist in the
   * code and never on screen. Marking on exit keeps the highlight for the whole visit and still
   * costs the user nothing: no button to find, no button to tap. It is what GitHub, Slack and
   * Gmail all do.
   *
   * The ref carries the latest unread state into the cleanup closure, which is created once per
   * focus while `notifications` keeps changing as pages load.
   */
  const hasUnreadRef = useRef(hasUnread);
  hasUnreadRef.current = hasUnread;

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!hasUnreadRef.current) return;
        readAllNotifications()
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["unreadNotifications"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          })
          .catch(() => {
            // The user has already navigated away, so a toast here would surface on an unrelated
            // screen. The badge simply stays until the next visit retries.
          });
      };
    }, [readAllNotifications, queryClient]),
  );

  return (
    <MainView className="p-4">
      <View className={headerClassName}>
        <TextTitle className="text-left text-xl">Notificaciones</TextTitle>
      </View>
      <FlatList
        className="flex-1"
        data={notifications}
        contentContainerClassName={listContentClassName}
        renderItem={({ item }) => <NotificationCard notification={item} />}
        refreshControl={<CustomRefresh refreshing={isFetching} />}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={() => (
          <View className="items-center gap-2 py-10">
            {isLoading && <Loader />}
            {!isLoading && !isError && !notifications.length && (
              <Text className="text-secondary-text text-center">
                No tienes notificaciones todavía
              </Text>
            )}
            {isError && (
              <Error textClassName="text-alert">Error al cargar las notificaciones</Error>
            )}
          </View>
        )}
      />
    </MainView>
  );
}
