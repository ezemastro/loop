import { useChats } from "@/hooks/useChats";
import { View, Text, FlatList, Pressable } from "react-native";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import SearchBar from "../SearchBar";
import CustomRefresh from "../CustomRefresh";
import Loader from "../Loader";
import Error from "../Error";
import { useRouter } from "expo-router";
import { useUsers } from "@/hooks/useUsers";
import { useState } from "react";
import ChatCard from "../cards/ChatCard";
import User from "../cards/User";
import { useAuth } from "@/hooks/useAuth";

export default function Messages() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const { data, isLoading, isError, fetchNextPage, hasNextPage } = useChats();
  const { data: usersData, hasNextPage: userHasNextPage } = useUsers({
    userId: currentUser?.id,
    searchTerm: debouncedSearchTerm,
  });
  const chats = data?.pages.flatMap((page) => page!.data!.chats) || [];

  const users = usersData?.pages.flatMap((page) => page!.data!.users) || [];
  const localFilteredUsers = users.filter(
    (user) =>
      `${user.firstName} ${user.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) && user.id !== currentUser?.id,
  );
  const localFilteredChats = chats.filter((chat) =>
    `${chat.user.firstName} ${chat.user.lastName}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );
  const chatsToShow = hasNextPage ? chats : localFilteredChats;
  const usersToShow =
    searchTerm && localFilteredChats.length < 5
      ? userHasNextPage
        ? users
        : localFilteredUsers
      : null;

  return (
    <MainView>
      <View className="p-4 gap-3">
        <TextTitle>Mensajes</TextTitle>
        <SearchBar
          className="bg-white"
          placeholder="Buscar usuarios..."
          onSubmit={hasNextPage ? setDebouncedSearchTerm : undefined}
          onDebounce={hasNextPage ? setDebouncedSearchTerm : undefined}
          onChange={setSearchTerm}
        />
      </View>

      <FlatList
        data={[
          ...chatsToShow.map((chat) => ({
            key: chat.userId + "-chat",
            component: () => <ChatCard chat={chat} />,
          })),
          ...(usersToShow
            ? [
                {
                  key: "usuarios-title",
                  component: () => (
                    <Text className="text-main-text text-center">Usuarios</Text>
                  ),
                },
                ...usersToShow.map((user) => ({
                  key: user.id + "-user",
                  component: () => (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/messages/[userId]",
                          params: { userId: user.id },
                        })
                      }
                    >
                      <User key={user.id} user={user} />
                    </Pressable>
                  ),
                })),
              ]
            : []),
        ]}
        onEndReached={() => fetchNextPage()}
        onEndReachedThreshold={0.2}
        refreshControl={<CustomRefresh />}
        contentContainerClassName="p-4 gap-2"
        renderItem={({ item }) => item.component()}
        ListEmptyComponent={() =>
          isLoading ? (
            <Loader />
          ) : isError ? (
            <Error>Ocurrió un error</Error>
          ) : !searchTerm ? (
            <View>
              <Text className="text-center text-secondary-text">
                Todavía no has hablado con nadie, busca un usuario para comenzar
              </Text>
            </View>
          ) : (
            <Text className="text-center text-secondary-text">
              No se encontraron usuarios
            </Text>
          )
        }
      />
    </MainView>
  );
}
