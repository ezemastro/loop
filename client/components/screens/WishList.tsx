import { FlatList, Text } from "react-native";
import TextTitle from "../bases/TextTitle";
import { MainView } from "../bases/MainView";
import { useRemoveWish, useWishes } from "@/hooks/useWishes";
import Wish from "../cards/Wish";
import Error from "../Error";
import Loader from "../Loader";
import CustomRefresh from "../CustomRefresh";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import ModifyWishModal from "../modals/ModifyWishModal";
import { useState } from "react";

export default function WishList() {
  const { data: wishesData, isError, isLoading } = useWishes();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedWish, setSelectedWish] = useState<UserWish | null>(null);
  const { mutateAsync: deleteWish } = useRemoveWish();

  const wishes = wishesData?.userWishes || [];
  const handleCreateWish = () => {
    setSelectedWish(null);
    setIsModalVisible(true);
  };
  const handleEdit = (wish: UserWish) => {
    setSelectedWish(wish);
    setIsModalVisible(true);
  };
  const handleDelete = (wish: UserWish) => {
    deleteWish({ categoryId: wish.categoryId });
  };
  return (
    <MainView className="p-4 gap-2">
      <ModifyWishModal
        isVisible={isModalVisible}
        handleClose={() => setIsModalVisible(false)}
        wish={selectedWish}
      />
      <TextTitle>Tu lista de deseados</TextTitle>
      <FlatList
        data={wishes}
        renderItem={({ item }) => (
          <Wish
            wish={item}
            onEdit={() => handleEdit(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        className="flex-1"
        contentContainerClassName="gap-1 pt-2"
        refreshControl={<CustomRefresh />}
        ListEmptyComponent={() => (
          <>
            {isError && <Error>Ocurrió un error</Error>}
            {isLoading && <Loader />}
            {!isLoading && !isError && (
              <Text className="text-center text-secondary-text mt-4">
                No tienes deseos agregados.
              </Text>
            )}
          </>
        )}
      />
      <CustomButton onPress={handleCreateWish}>
        <ButtonText>Agregar deseo</ButtonText>
      </CustomButton>
    </MainView>
  );
}
