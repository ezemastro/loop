import { FlatList, View } from "react-native";
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
import { useThemeColors } from "@/hooks/useThemeColors";
import EmptyState from "../bases/EmptyState";
import { WishlistIcon } from "../Icons";
import { rowPosition } from "../bases/listRow";

export default function WishList() {
  const colors = useThemeColors();
  const { data: wishesData, isError, isLoading } = useWishes();
  const headerClassName = pageContentClassName(
    "narrow",
    "flex-row items-center justify-between gap-4 px-4 pb-3 pt-4",
  );
  const flatListContentClassName = pageContentClassName("narrow", "px-4 pb-4");
  const mobileActionClassName = pageContentClassName("narrow", "px-4 py-3 md:hidden");
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
    <MainView>
      <ModifyWishModal
        isVisible={isModalVisible}
        handleClose={() => setIsModalVisible(false)}
        wish={selectedWish}
      />
      <View className={headerClassName}>
        <TextTitle>Tu lista de deseados</TextTitle>
        {/* Desktop: next to the title. Mobile: pinned full width at the bottom (below). */}
        <CustomButton
          size="sm"
          className="w-auto max-w-none max-md:hidden"
          onPress={handleCreateWish}
        >
          <ButtonText>Agregar deseo</ButtonText>
        </CustomButton>
      </View>
      <FlatList
        data={wishes}
        renderItem={({ item, index }) => (
          <Wish
            wish={item}
            position={rowPosition(index, wishes.length)}
            onEdit={() => handleEdit(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        className="flex-1"
        contentContainerClassName={flatListContentClassName}
        refreshControl={<CustomRefresh />}
        ListEmptyComponent={() => (
          <>
            {isError && <Error>Algo salió mal</Error>}
            {isLoading && <Loader />}
            {!isLoading && !isError && (
              <EmptyState
                icon={<WishlistIcon size={36} color={colors.SECONDARY_TEXT} />}
                title="Todavía no agregaste ningún deseo"
                description="Sumá lo que estás buscando para que tu comunidad lo vea."
                actionLabel="Agregar deseo"
                onAction={handleCreateWish}
              />
            )}
          </>
        )}
      />
      <View className="border-t border-stroke bg-white md:hidden">
        <View className={mobileActionClassName}>
          <CustomButton className="max-w-none" onPress={handleCreateWish}>
            <ButtonText>Agregar deseo</ButtonText>
          </CustomButton>
        </View>
      </View>
    </MainView>
  );
}
