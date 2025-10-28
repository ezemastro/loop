import { View, Text, TextInput } from "react-native";
import CategorySelector from "../selectors/CategorySelector";
import { useEffect, useState } from "react";
import CustomModal from "../bases/CustomModal";
import TextTitle from "../bases/TextTitle";
import CloseModalButton from "../CloseModalButton";
import AvoidingKeyboard from "../AvoidingKeyboard";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { useCreateWish, useModifyWish } from "@/hooks/useWishes";

export default function ModifyWishModal({
  wish,
  isVisible,
  handleClose,
}: {
  wish: UserWish | null;
  isVisible: boolean;
  handleClose: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState(
    wish?.category || null,
  );
  const [comment, setComment] = useState(wish?.comment || "");
  const { mutateAsync: modifyWish, isPending: isModifying } = useModifyWish();
  const { mutateAsync: createWish, isPending: isCreating } = useCreateWish();
  const isLoading = isModifying || isCreating;

  useEffect(() => {
    setSelectedCategory(wish?.category || null);
    setComment(wish?.comment || "");
  }, [wish]);

  const handleSubmit = () => {
    if (!selectedCategory) {
      return;
    }
    if (!!wish) {
      // Modify existing wish
      modifyWish({
        wishId: wish.id,
        categoryId: selectedCategory?.id,
        comment: comment === "" ? null : comment,
      }).then(() => {
        handleClose();
      });
    } else {
      // Create new wish
      createWish({
        categoryId: selectedCategory?.id,
        comment: comment === "" ? null : comment,
      }).then(() => {
        handleClose();
      });
    }
  };
  return (
    <CustomModal handleClose={handleClose} isVisible={isVisible}>
      <AvoidingKeyboard className="items-center justify-center flex-1 w-full">
        <View className="bg-background p-4 rounded-lg w-full gap-4">
          <CloseModalButton onClose={handleClose} />
          <TextTitle>{wish ? "Modificar deseo" : "Agregar deseo"}</TextTitle>
          <View className="gap-1">
            <Text className="text-main-text text-lg">Categoría</Text>
            <CategorySelector
              value={selectedCategory}
              onChange={(cat) => setSelectedCategory(cat)}
            />
          </View>
          <View className="gap-1">
            <Text className="text-main-text text-lg">Comentario</Text>
            <TextInput
              className="border border-gray-300 p-2 rounded text-main-text bg-white"
              value={comment}
              onChangeText={setComment}
              placeholderClassName="text-secondary-text"
              placeholder="Sé más específico en lo que buscas..."
              multiline
              numberOfLines={4}
            />
          </View>
          <CustomButton
            onPress={handleSubmit}
            className="mt-4"
            disabled={isLoading || !selectedCategory}
          >
            <ButtonText>
              {wish ? "Guardar cambios" : "Agregar deseo"}
            </ButtonText>
          </CustomButton>
        </View>
      </AvoidingKeyboard>
    </CustomModal>
  );
}
