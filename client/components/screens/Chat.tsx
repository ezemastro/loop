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
import { ArrowDownIcon, ArrowUpIcon, SendIcon } from "../Icons";
import { useSendMessage } from "@/hooks/useSendMessage";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import Error from "../Error";
import Loader from "../Loader";
import AvoidingKeyboard from "../AvoidingKeyboard";
import MyPendingList from "../MyPendingList";
import { useMessageRead } from "@/hooks/useMessageRead";

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
  } = useMessages({
    userId: userId,
  });
  const { mutate: sendMessage } = useSendMessage({ userId: userId });
  const { mutate: markMessagesAsRead } = useMessageRead({ userId: userId });
  const [messageText, setMessageText] = useState("");

  const user = userData?.user;
  const messages = data?.pages.flatMap((page) => page!.data!.messages) ?? [];

  useEffect(() => {
    if (isSuccess) {
      markMessagesAsRead();
    }
  }, [isSuccess, markMessagesAsRead]);

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
          queryClient.invalidateQueries({ queryKey: ["chats"] });
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: ["messages", userId] });
        },
      },
    );
    setMessageText("");
  };

  const pendingSections = [
    {
      key: "to-receive",
      title: "Debes recibir",
      component: () => (
        <MyPendingList
          type="to-receive"
          filterUserId={userId}
          resultsCount={(count) =>
            pendingCount["to-receive"] !== count
              ? setPendingCount({ ...pendingCount, ["to-receive"]: count })
              : null
          }
        />
      ),
    },
    {
      key: "to-deliver",
      title: "Debes entregar",
      component: () => (
        <MyPendingList
          type="to-deliver"
          filterUserId={userId}
          resultsCount={(count) =>
            pendingCount["to-deliver"] !== count
              ? setPendingCount({ ...pendingCount, ["to-deliver"]: count })
              : null
          }
        />
      ),
    },
    {
      key: "to-accept",
      title: "Debes aceptar",
      component: () => (
        <MyPendingList
          type="to-accept"
          filterUserId={userId}
          resultsCount={(count) =>
            pendingCount["to-accept"] !== count
              ? setPendingCount({ ...pendingCount, ["to-accept"]: count })
              : null
          }
        />
      ),
    },
    {
      key: "waiting-acceptance",
      title: "Debe aceptarte",
      component: () => (
        <MyPendingList
          type="waiting-acceptance"
          filterUserId={userId}
          resultsCount={(count) =>
            pendingCount["waiting-acceptance"] !== count
              ? setPendingCount({
                  ...pendingCount,
                  ["waiting-acceptance"]: count,
                })
              : null
          }
        />
      ),
    },
  ];
  const [pendingCount, setPendingCount] = useState(
    Object.fromEntries(pendingSections.map((section) => [section.key, 0])),
  );
  const [isPendingListVisible, setIsPendingListVisible] = useState(false);

  return (
    <AvoidingKeyboard>
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
        <View
          className={
            "mt-2 " +
            (!Object.values(pendingCount).some((v) => !!v) ? "hidden" : "")
          }
        >
          <Pressable
            className="flex-row items-center px-3"
            onPress={() => setIsPendingListVisible(!isPendingListVisible)}
          >
            <Text className="text-center text-main-text flex-grow">
              Loops pendientes{" "}
              <Text>
                ({Object.values(pendingCount).reduce((a, b) => a + b, 0)})
              </Text>
            </Text>
            {isPendingListVisible ? (
              <ArrowUpIcon className="text-main-text" />
            ) : (
              <ArrowDownIcon className="text-main-text" />
            )}
          </Pressable>
        </View>
        <FlatList
          data={pendingSections}
          className={
            "flex-grow bg-background shadow-2xl z-10 mt-2 " +
            (isPendingListVisible ? "" : "hidden")
          }
          contentContainerClassName="gap-2"
          renderItem={({ item }) => (
            <View
              className={"px-4 " + (!pendingCount[item.key] ? "hidden" : "")}
            >
              <Text className="text-secondary-text text-lg font-bold">
                {item.title}
              </Text>
              {item.component()}
            </View>
          )}
        />
        <FlatList
          data={messages}
          className="mt-3 bg-white"
          contentContainerClassName="flex-grow gap-1"
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
    </AvoidingKeyboard>
  );
}
