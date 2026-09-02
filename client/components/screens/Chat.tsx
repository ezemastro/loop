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
  const messagesContentClassName = pageContentClassName("narrow", "flex-grow gap-1 max-w-xl");

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

  return (
    <AvoidingKeyboard>
      <MainView>
        <View className="flex-row items-center gap-2 px-2 py-2">
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
              style={{ width: 40, height: 40 }}
            />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-base font-medium text-main-text">
                {user?.firstName} {user?.lastName}
              </Text>
              {(user?.schools.length ?? 0) > 3 ? (
                <View className="flex-row gap-1">
                  {user?.schools.map((school) => (
                    <SchoolLogo key={school.id} school={school} size={16} />
                  ))}
                </View>
              ) : (
                <Text numberOfLines={1} className="text-secondary-text text-xs">
                  {user?.schools.map((school) => school.name).join(", ")}
                </Text>
              )}
            </View>
          </Pressable>
        </View>
        <DroppablePendingWithUser userId={userId!} />
        <FlatList
          data={messages}
          className="flex-1 mt-3 bg-background"
          contentContainerClassName={messagesContentClassName}
          contentContainerStyle={
            Platform.OS === "web" ? { transform: [{ scaleY: -1 }] } : undefined
          }
          renderItem={({ item, index }) => (
            <>
              {!messages[index - 1] ||
              item.senderId !== messages[index - 1]?.senderId ||
              minutesDifference(item.createdAt, messages[index - 1]?.createdAt) > 5 ? (
                <ChatHourLabel date={item.createdAt} senderId={item.senderId} />
              ) : null}
              <MessageItem message={item} />
              {!messages[index + 1] || !sameDay(item.createdAt, messages[index + 1]?.createdAt) ? (
                <ChatDayLabel date={item.createdAt} />
              ) : null}
            </>
          )}
          ListFooterComponent={
            messages.length && !hasNextPage ? (
              <Text className="text-secondary-text text-center p-4">No hay más mensajes</Text>
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
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        />
        <View className="bg-white p-2">
          <ChatInput onSubmit={handleSendMessage} />
        </View>
      </MainView>
    </AvoidingKeyboard>
  );
}
