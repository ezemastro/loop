import { View, Text, Modal, Pressable, FlatList } from "react-native";
import React from "react";
import { useSchools } from "@/hooks/useSchools";
import CustomModal from "./CustomModal";
import SearchBar from "./SearchBar";

export default function SchoolSelectorModal({
  isVisible,
  onSelect,
  close,
}: {
  isVisible: boolean;
  onSelect: (school: School) => void;
  close: () => void;
}) {
  const { data, isLoading, isError, fetchNextPage, status } = useSchools();
  const schools = data?.pages.flatMap((page) => page.schools) || [];

  return (
    <CustomModal isVisible={isVisible} handleClose={close}>
      <View className="bg-background rounded p-4 py-6 w-full h-3/4 gap-4">
        <Text className="text-center text-2xl text-main-text">
          Seleccione una escuela
        </Text>
        <SearchBar />
        {isError && (
          <Text className="text-red-500 text-center">
            Error al cargar las escuelas
          </Text>
        )}
        <FlatList
          data={schools}
          className="border-stroke border"
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelect(item)}>
              <Text className="p-2 border-b border-stroke">{item.name}</Text>
            </Pressable>
          )}
        />
      </View>
    </CustomModal>
  );
}
