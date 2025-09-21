import {
  addNewMessageToCache,
  replaceMessageInCache,
  useMessages,
} from "@/hooks/useMessages";
import { useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
} from "react-native";
import { MainView } from "../bases/MainView";
import BackButton from "../BackButton";
import { getUrl } from "@/services/getUrl";
import { useUser } from "@/hooks/useUser";
import MessageItem from "../MessageItem";
import { sameDay } from "@/utils/sameDay";
import ChatDayLabel from "../ChatDayLabel";
import ChatHourLabel from "../ChatHourLabel";
import { SendIcon } from "../Icons";
import { useSendMessage } from "@/hooks/useSendMessage";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import Error from "../Error";
import Loader from "../Loader";

export default function Chat() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { userId: unparsedUserId } = useLocalSearchParams();
  const userId = Array.isArray(unparsedUserId)
    ? unparsedUserId[0]
    : unparsedUserId;
  const { data: userData } = useUser({ userId: userId });
  const { data, isLoading, isError, fetchNextPage, refetch, hasNextPage } =
    useMessages({
      userId: userId,
    });
  const { mutate: sendMessage } = useSendMessage({ userId: userId });
  const [messageText, setMessageText] = useState("");

  const user = userData?.user;
  const messages = data?.pages.flatMap((page) => page!.data!.messages) ?? [];

  const handleSendMessage = () => {
    const parsedMessage = messageText.trim();
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
      { text: messageText },
      {
        onSuccess: (data) => {
          replaceMessageInCache({
            queryClient,
            newMessage: data?.message!,
            userId: userId,
            targetId: optimisticMessage.id,
          });
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: ["messages", userId] });
        },
      },
    );
    setMessageText("");
  };

  return (
    <MainView>
      <View className="flex-row items-center p-4">
        <BackButton />
      </View>
      <View className="flex-row items-center gap-4 px-4">
        <Image
          source={{ uri: getUrl(user?.profileMedia?.url ?? "") }}
          className="size-20 rounded-full bg-secondary-text"
        />
        <View>
          <Text className="text-2xl text-main-text">
            {user?.firstName} {user?.lastName}
          </Text>
          <Text className="text-secondary-text">{user?.school.name}</Text>
        </View>
      </View>
      <FlatList
        data={messages}
        contentContainerClassName="bg-white flex-grow gap-1"
        renderItem={({ item, index }) => (
          <>
            {!messages[index - 1] ||
            item.senderId !== messages[index - 1]?.senderId ? (
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
          !hasNextPage ? (
            <Text className="text-secondary-text text-center p-4">
              No hay más mensajes
            </Text>
          ) : null
        }
        ListEmptyComponent={
          isError ? (
            <Error>Ocurrió un error</Error>
          ) : isLoading ? (
            <Loader />
          ) : (
            <Text className="text-secondary-text text-center p-4">
              No hay mensajes aún, envía el primer mensaje
            </Text>
          )
        }
        onEndReached={() => {
          fetchNextPage();
        }}
        inverted
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      />
      <View className="bg-white p-2">
        <View className="flex-row items-center gap-2">
          <TextInput
            placeholder="Mensaje..."
            className="border border-stroke rounded-2xl px-4 py-2 text-main-text flex-grow text-lg"
            multiline
            numberOfLines={4}
            value={messageText}
            onChangeText={setMessageText}
          />
          <Pressable
            className="p-3 bg-tertiary rounded-full"
            onPress={handleSendMessage}
          >
            <SendIcon className="text-white" size={20} />
          </Pressable>
        </View>
      </View>
    </MainView>
  );
}
