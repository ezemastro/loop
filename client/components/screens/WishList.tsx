import { FlatList, Text, View } from "react-native";
import type { CellRendererProps } from "react-native";
import TextTitle from "../bases/TextTitle";
import { MainView, pageContentClassName } from "../bases/MainView";
import { useRemoveWish, useWishes } from "@/hooks/useWishes";
import Wish from "../cards/Wish";
import Error from "../Error";
import Loader from "../Loader";
import CustomRefresh from "../CustomRefresh";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import ModifyWishModal from "../modals/ModifyWishModal";
import { useState } from "react";
import { GRID_ROW_CLASS, gridCellClass } from "../bases/ListingGrid";

/** 1 column on mobile, 2 from `md`, 3 from `lg` up. */
const WISH_CELL_CLASS = gridCellClass({ base: 1, md: 2, lg: 3 });

/**
 * react-native-web wraps every FlatList item in its own View. The width fraction must land on
 * that wrapper — the direct child of the flex-wrap row — see `Search.tsx`'s `GridCell`.
 */
const WishGridCell = ({ children, ...props }: CellRendererProps<UserWish>) => (
  <View {...props} className={WISH_CELL_CLASS}>
    {children}
  </View>
);

export default function WishList() {
  const { data: wishesData, isError, isLoading } = useWishes();
  const wishListContentClassName = pageContentClassName("wide");
  const flatListContentClassName = pageContentClassName("wide", `pt-2 ${GRID_ROW_CLASS}`);
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
      <View className={wishListContentClassName}>
        <TextTitle>Tu lista de deseados</TextTitle>
      </View>
      <FlatList
        data={wishes}
        renderItem={({ item }) => (
          <Wish wish={item} onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item)} />
        )}
        className="flex-1"
        contentContainerClassName={flatListContentClassName}
        CellRendererComponent={WishGridCell}
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
      <View className={wishListContentClassName}>
        <CustomButton onPress={handleCreateWish}>
          <ButtonText>Agregar deseo</ButtonText>
        </CustomButton>
      </View>
    </MainView>
  );
}
