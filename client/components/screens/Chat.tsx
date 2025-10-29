import {
  addNewMessageToCache,
  replaceMessageInCache,
  useMessages,
} from "@/hooks/useMessages";
import { useLocalSearchParams } from "expo-router";
import { View, Text, Image, FlatList, RefreshControl } from "react-native";
import { MainView } from "../bases/MainView";
import BackButton from "../BackButton";
import { getUrl } from "@/services/getUrl";
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

export default function Chat() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { userId: unparsedUserId } = useLocalSearchParams();
  const userId = Array.isArray(unparsedUserId)
    ? unparsedUserId[0]
    : unparsedUserId;
  const { data: userData } = useUser({ userId: userId });
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    refetch,
    hasNextPage,
    isSuccess,
    isFetching,
  } = useMessages({
    userId: userId,
  });
  const { mutate: sendMessage } = useSendMessage({ userId: userId });
  const { mutate: markMessagesAsRead } = useMessageRead({ userId: userId });

  const user = userData?.user;
  const messages = data?.pages.flatMap((page) => page!.data!.messages) ?? [];

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
      createdAt: new Date(),
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
        onError: () => {
          queryClient.invalidateQueries({ queryKey: ["messages", userId] });
        },
      },
    );
  };

  return (
    <AvoidingKeyboard>
      <MainView>
        <View className="flex-row items-center p-4">
          <BackButton />
        </View>
        <View className="flex-row items-center gap-4 px-4 pb-2">
          <Image
            source={{ uri: getUrl(user?.profileMedia?.url ?? "") }}
            className="size-20 rounded-full bg-secondary-text"
          />
          <View>
            <Text className="text-2xl text-main-text">
              {user?.firstName} {user?.lastName}
            </Text>
            {(user?.schools.length ?? 0) > 3 ? (
              <View className="flex-row gap-2">
                {user?.schools.map((school) => (
                  <Image
                    key={school.id}
                    source={{ uri: getUrl(school.media.url) }}
                    className="size-6 mb-1"
                  />
                ))}
              </View>
            ) : (
              <>
                {user?.schools.map((school) => (
                  <Text className="text-secondary-text" key={school.id}>
                    {school.name}
                  </Text>
                ))}
              </>
            )}
          </View>
        </View>
        <DroppablePendingWithUser userId={userId!} />
        <FlatList
          data={messages}
          className="mt-3 bg-white"
          contentContainerClassName="flex-grow gap-1"
          renderItem={({ item, index }) => (
            <>
              {!messages[index - 1] ||
              item.senderId !== messages[index - 1]?.senderId ||
              minutesDifference(
                item.createdAt,
                messages[index - 1]?.createdAt,
              ) > 5 ? (
                <ChatHourLabel date={item.createdAt} senderId={item.senderId} />
              ) : null}
              <MessageItem message={item} />
              {!messages[index + 1] ||
              !sameDay(item.createdAt, messages[index + 1]?.createdAt) ? (
                <ChatDayLabel date={item.createdAt} />
              ) : null}
            </>
          )}
          ListFooterComponent={
            messages.length && !hasNextPage ? (
              <Text className="text-secondary-text text-center p-4">
                No hay más mensajes
              </Text>
            ) : null
          }
          ListHeaderComponent={
            !messages.length ? (
              isError ? (
                <Error>Ocurrió un error</Error>
              ) : isLoading ? (
                <Loader />
              ) : (
                <Text className="text-secondary-text text-center p-4">
                  No hay mensajes aún, envía el primer mensaje
                </Text>
              )
            ) : null
          }
          onEndReached={() => {
            fetchNextPage();
          }}
          inverted
          onEndReachedThreshold={0.1}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} />
          }
        />
        <View className="bg-white p-2">
          <ChatInput onSubmit={handleSendMessage} />
        </View>
      </MainView>
    </AvoidingKeyboard>
  );
}
