import { Text, Pressable, View, GestureResponderEvent } from "react-native";
import CategoryBadge from "../CategoryBadge";
import { DeleteIcon, EditIcon } from "../Icons";

export default function Wish({
  wish,
  onEdit,
  onDelete,
}: {
  wish: UserWish;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const handleDelete = (e: GestureResponderEvent) => {
    e.stopPropagation();
    onDelete?.();
  };
  return (
    <Pressable className="flex-grow bg-white p-4 border border-stroke rounded-xl" onPress={onEdit}>
      <View className="absolute top-2 right-2 flex-row">
        <View className="h-9 w-9 items-center justify-center">
          <EditIcon size={20} className="text-secondary-text" />
        </View>
        <Pressable
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Eliminar deseo"
          className="h-9 w-9 items-center justify-center rounded-full hover:bg-alert/10 active:opacity-80"
        >
          <DeleteIcon size={20} className="text-secondary-text" />
        </Pressable>
      </View>
      <CategoryBadge category={wish.category} className="text-lg text-main-text mr-20" />
      <Text className="text-secondary-text mt-2">
        {wish.comment ? wish.comment : "Sin comentario"}
      </Text>
    </Pressable>
  );
}
