import { Text, Pressable, View, GestureResponderEvent } from "react-native";
import CategoryBadge from "../CategoryBadge";
import { DeleteIcon, EditIcon } from "../Icons";
import { listRowClassName, type RowPosition } from "../bases/listRow";

export default function Wish({
  wish,
  onEdit,
  onDelete,
  position = "only",
}: {
  wish: UserWish;
  onEdit?: () => void;
  onDelete?: () => void;
  position?: RowPosition;
}) {
  const handleDelete = (e: GestureResponderEvent) => {
    e.stopPropagation();
    onDelete?.();
  };
  const handleEdit = (e: GestureResponderEvent) => {
    e.stopPropagation();
    onEdit?.();
  };
  return (
    <Pressable
      className={listRowClassName(
        position,
        "min-h-[64px] flex-row items-center gap-2 py-2 pl-4 pr-2 web:cursor-pointer hover:bg-background",
      )}
      onPress={onEdit}
    >
      <View className="min-w-0 flex-1">
        <CategoryBadge category={wish.category} className="text-base text-main-text" />
        <Text className="text-sm text-secondary-text">
          {wish.comment ? wish.comment : "Sin comentario"}
        </Text>
      </View>
      <Pressable
        onPress={handleEdit}
        accessibilityRole="button"
        accessibilityLabel="Editar deseo"
        className="h-11 w-11 items-center justify-center rounded-full hover:bg-background active:opacity-80"
      >
        <EditIcon size={20} className="text-secondary-text" />
      </Pressable>
      <Pressable
        onPress={handleDelete}
        accessibilityRole="button"
        accessibilityLabel="Eliminar deseo"
        className="h-11 w-11 items-center justify-center rounded-full hover:bg-alert/10 active:opacity-80"
      >
        <DeleteIcon size={20} className="text-secondary-text" />
      </Pressable>
    </Pressable>
  );
}
