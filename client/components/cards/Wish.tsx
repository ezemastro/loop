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
    <Pressable
      className="flex-grow bg-white p-4 border border-stroke rounded-xl"
      onPress={onEdit}
    >
      <View className="absolute top-1 right-1 flex-row">
        <View className="p-1">
          <EditIcon className="text-tertiary" />
        </View>
        <Pressable onPress={handleDelete} className="p-1">
          <DeleteIcon className="text-alert" />
        </Pressable>
      </View>
      <CategoryBadge
        category={wish.category}
        className="text-lg text-main-text mr-14"
      />
      <Text className="text-secondary-text mt-2">
        {wish.comment ? wish.comment : "Sin comentario"}
      </Text>
    </Pressable>
  );
}
