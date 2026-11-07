import { useChats } from "@/hooks/useChats";
import { View, Text, FlatList, Pressable } from "react-native";
import { MainView, pageContentClassName } from "../bases/MainView";
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
import EmptyState from "../bases/EmptyState";
import { MessageIcon, SearchIcon } from "../Icons";
import { listRowClassName, rowPosition } from "../bases/listRow";

export default function Messages() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const headerClassName = pageContentClassName("narrow", "p-4 gap-3 flex-shrink-0");
  const listContentClassName = pageContentClassName("narrow", "p-4");
  const { data, isLoading, isError, fetchNextPage, hasNextPage } = useChats();
  const { data: usersData, hasNextPage: userHasNextPage } = useUsers({
    userId: currentUser?.id,
    searchTerm: debouncedSearchTerm,
  });
  const chats = data?.pages.flatMap((page) => page.data?.chats ?? []) || [];

  const users = usersData?.pages.flatMap((page) => page.data?.users ?? []) || [];
  const localFilteredUsers = users.filter(
    (user) =>
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) &&
      user.id !== currentUser?.id,
  );
  const localFilteredChats = chats.filter((chat) =>
    `${chat.user.firstName} ${chat.user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()),
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
      <View className={headerClassName}>
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
        className="flex-1"
        data={[
          ...chatsToShow.map((chat, index) => ({
            key: chat.userId + "-chat",
            component: () => (
              <ChatCard chat={chat} position={rowPosition(index, chatsToShow.length)} />
            ),
          })),
          ...(usersToShow
            ? [
                {
                  key: "usuarios-title",
                  component: () => (
                    <Text className="mb-2 mt-6 text-left text-sm font-semibold text-secondary-text">
                      Usuarios
                    </Text>
                  ),
                },
                ...usersToShow.map((user, index) => ({
                  key: user.id + "-user",
                  component: () => (
                    <Pressable
                      accessibilityRole="link"
                      className={listRowClassName(
                        rowPosition(index, usersToShow.length),
                        "px-4 web:cursor-pointer hover:bg-background",
                      )}
                      onPress={() =>
                        router.push({
                          pathname: "/messages/[userId]",
                          params: { userId: user.id },
                        })
                      }
                    >
                      <User key={user.id} user={user} row className="border-b-0" />
                    </Pressable>
                  ),
                })),
              ]
            : []),
        ]}
        onEndReached={() => fetchNextPage()}
        onEndReachedThreshold={0.2}
        refreshControl={<CustomRefresh />}
        contentContainerClassName={listContentClassName}
        renderItem={({ item }) => item.component()}
        ListEmptyComponent={() =>
          isLoading ? (
            <Loader />
          ) : isError ? (
            <Error>Algo salió mal</Error>
          ) : !searchTerm ? (
            <EmptyState
              icon={<MessageIcon size={36} className="text-secondary-text" />}
              title="Todavía no hablaste con nadie"
              description="Buscá a alguien para empezar."
            />
          ) : (
            <EmptyState
              icon={<SearchIcon size={36} className="text-secondary-text" />}
              title="No encontramos resultados"
            />
          )
        }
      />
    </MainView>
  );
}
