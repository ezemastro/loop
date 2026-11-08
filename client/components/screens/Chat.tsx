import { addNewMessageToCache, replaceMessageInCache, useMessages } from "@/hooks/useMessages";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Image, FlatList, Platform, Pressable, RefreshControl } from "react-native";
import { MainView, pageContentClassName } from "../bases/MainView";
import BackButton from "../BackButton";
import { getProfileImageSource } from "@/services/getUrl";
import SchoolLogo from "../SchoolLogo";
import { useUser } from "@/hooks/useUser";
import MessageItem from "../MessageItem";
import { sameDay } from "@/utils/sameDay";
import ChatDayLabel from "../ChatDayLabel";
import ChatHourLabel from "../ChatHourLabel";
import { useSendMessage } from "@/hooks/useSendMessage";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import Error from "../Error";
import Loader from "../Loader";
import AvoidingKeyboard from "../AvoidingKeyboard";
import { useMessageRead } from "@/hooks/useMessageRead";
import DroppablePendingWithUser from "../DroppablePendingWithUser";
import ChatInput from "../ChatInput";
import { minutesDifference } from "@/utils/minutesDifference";
import { useToast } from "@/components/ToastProvider";
import { getUserFriendlyErrorMessage } from "@/services/errorMapping";

export default function Chat() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { userId: unparsedUserId } = useLocalSearchParams();
  const userId = Array.isArray(unparsedUserId) ? unparsedUserId[0] : unparsedUserId;
  const { data: userData } = useUser({ userId: userId });
  const { data, isLoading, isError, fetchNextPage, refetch, hasNextPage, isSuccess, isFetching } =
    useMessages({
      userId: userId,
    });
  const { mutate: sendMessage } = useSendMessage({ userId: userId });
  const { mutate: markMessagesAsRead } = useMessageRead({ userId: userId });
  const { showToast } = useToast();

  const user = userData?.user;
  const messages = data?.pages.flatMap((page) => page.data?.messages ?? []) ?? [];

  useEffect(() => {
    if (isSuccess) {
      markMessagesAsRead();
    }
  }, [isSuccess, markMessagesAsRead]);
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
  }, [messages.length, queryClient]);

  const handleSendMessage = (text: string) => {
    const parsedMessage = text.trim();
    if (!parsedMessage) return;

    const optimisticMessage: Message & { isOptimistic: boolean } = {
      id: `optimistic-${Date.now()}`,
      text: parsedMessage,
      createdAt: new Date().toISOString(),
      senderId: currentUser!.id,
      attachedListingId: null,
      attachedListing: null,
      recipientId: user?.id!,
      isOptimistic: true,
    };
    addNewMessageToCache({
      queryClient,
      newMessage: optimisticMessage,
      userId: userId,
    });

    sendMessage(
      { text: text },
      {
        onSuccess: (data) => {
          replaceMessageInCache({
            queryClient,
            newMessage: data?.message!,
            userId: userId,
            targetId: optimisticMessage.id,
          });
          queryClient.invalidateQueries({ queryKey: ["chats"] });
        },
        onError: (error) => {
          queryClient.invalidateQueries({ queryKey: ["messages", userId] });
          showToast(getUserFriendlyErrorMessage(error), "error");
        },
      },
    );
  };

  const hasMessages = messages.length > 0;
  const showCentered = !hasMessages;

  return (
    <AvoidingKeyboard>
      <MainView>
        {/* Header, pending panel, list and input share one centered column. */}
        <View className={pageContentClassName("narrow", "flex-1")}>
          <View className="h-14 flex-row items-center gap-2 border-b border-stroke bg-white px-2">
            <BackButton />
            <Pressable
              className="flex-1 flex-row items-center gap-3"
              onPress={() =>
                router.push({
                  pathname: "/(main)/user/[userId]",
                  params: { userId: userId! },
                })
              }
            >
              <Image
                source={getProfileImageSource(user?.profileMedia?.url)}
                className="rounded-full bg-secondary-text"
                style={{ width: 36, height: 36 }}
              />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-base font-semibold text-main-text">
                  {user?.firstName} {user?.lastName}
                </Text>
                {(user?.schools.length ?? 0) > 3 ? (
                  <View className="flex-row gap-1">
                    {user?.schools.map((school) => (
                      <SchoolLogo key={school.id} school={school} size={16} />
                    ))}
                  </View>
                ) : (
                  <Text numberOfLines={1} className="text-xs text-secondary-text">
                    {user?.schools.map((school) => school.name).join(", ")}
                  </Text>
                )}
              </View>
            </Pressable>
          </View>
          <DroppablePendingWithUser userId={userId!} />
          {showCentered ? (
            <View className="flex-1 items-center justify-center px-6">
              {isError ? (
                <Error>Algo salió mal</Error>
              ) : isLoading ? (
                <Loader />
              ) : (
                <Text className="text-center text-base text-secondary-text">
                  Todavía no hay mensajes. Escribí el primero.
                </Text>
              )}
            </View>
          ) : (
            <FlatList
              data={messages}
              className="flex-1"
              contentContainerClassName="flex-grow py-3"
              contentContainerStyle={
                Platform.OS === "web" ? { transform: [{ scaleY: -1 }] } : undefined
              }
              renderItem={({ item, index }) => {
                // The list is inverted: index 0 is the newest, so `index - 1` is the next bubble
                // down the screen and `index + 1` the one above it.
                const below = messages[index - 1];
                const above = messages[index + 1];
                const endsGroup =
                  !below ||
                  item.senderId !== below.senderId ||
                  minutesDifference(item.createdAt, below.createdAt) > 5;
                const startsGroup =
                  !!above &&
                  (item.senderId !== above.senderId ||
                    minutesDifference(above.createdAt, item.createdAt) > 5);
                return (
                  <>
                    {endsGroup ? (
                      <ChatHourLabel date={item.createdAt} senderId={item.senderId} />
                    ) : null}
                    <MessageItem message={item} startsGroup={startsGroup} />
                    {!above || !sameDay(item.createdAt, above.createdAt) ? (
                      <ChatDayLabel date={item.createdAt} />
                    ) : null}
                  </>
                );
              }}
              onEndReached={() => {
                fetchNextPage();
              }}
              inverted
              onEndReachedThreshold={0.1}
              refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
            />
          )}
          <View className="border-t border-stroke bg-white px-4 py-2">
            <ChatInput onSubmit={handleSendMessage} />
          </View>
        </View>
      </MainView>
    </AvoidingKeyboard>
  );
}
