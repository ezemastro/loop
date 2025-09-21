import { useChats } from "@/hooks/useChats";
import { View, Text, FlatList, Image, Pressable } from "react-native";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import SearchBar from "../SearchBar";
import { getUrl } from "@/services/getUrl";
import CustomRefresh from "../CustomRefresh";
import Loader from "../Loader";
import Error from "../Error";
import { useRouter } from "expo-router";

export default function Messages() {
  const router = useRouter();
  const { data, isLoading, isError, fetchNextPage } = useChats();
  const chats = data?.pages.flatMap((page) => page!.data!.chats) || [];
  const lastMessageShortText = (text: string) => {
    const singleLineText = text.replace(/[\r\n]+/g, " ");
    return singleLineText.length > 30
      ? singleLineText.slice(0, 30) + "..."
      : singleLineText;
  };
  return (
    <MainView>
      <View className="p-4 gap-3">
        <TextTitle>Mensajes</TextTitle>
        <SearchBar placeholder="Buscar usuarios..." />
      </View>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.userId}
        onEndReached={() => fetchNextPage()}
        onEndReachedThreshold={0.2}
        refreshControl={<CustomRefresh />}
        contentContainerClassName="p-4 gap-2"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              router.push({
                pathname: "/messages/[userId]",
                params: { userId: item.userId },
              });
            }}
            className="flex-row p-3 gap-4 bg-white rounded-xl shadow items-center"
          >
            <Image
              source={{ uri: getUrl(item.user.profileMedia?.url || "") }}
              className="size-16 bg-secondary-text rounded-full"
            />
            <View>
              <Text className="text-secondary-text text-lg">
                <Text
                  className={
                    "text-main-text" +
                    (item.pendingMessages > 0 ? " font-bold" : "")
                  }
                >
                  {item.user.firstName} {item.user.lastName}
                </Text>
                {" - "}
                <Text>{item.user.school.name}</Text>
              </Text>
              <Text className="text-secondary-text">
                {lastMessageShortText(item.lastMessage.text)}
              </Text>
            </View>
            <View className="flex-1 items-end px-3">
              {item.pendingMessages > 0 && (
                <View className="bg-primary p-1 aspect-square rounded-full items-center justify-center">
                  <Text className="text-white font-bold text-center">
                    {item.pendingMessages}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={() =>
          isLoading ? (
            <Loader />
          ) : isError ? (
            <Error>Ocurrió un error</Error>
          ) : (
            <View>
              <Text className="text-center text-secondary-text">
                Todavía no has hablado con nadie, busca un usuario para comenzar
              </Text>
            </View>
          )
        }
      />
    </MainView>
  );
}
