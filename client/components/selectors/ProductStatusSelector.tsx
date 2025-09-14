import { COLORS } from "@/config";
import { Picker } from "@react-native-picker/picker";
import { cssInterop } from "nativewind";
import { View } from "react-native";
import { twMerge } from "tailwind-merge";

cssInterop(Picker, {
  className: "style",
});

export default function ProductStatusSelector({
  value,
  onChange,
  className,
}: {
  value: ProductStatus | null;
  onChange: (value: ProductStatus | null) => void;
  className?: string;
}) {
  return (
    <View className={twMerge("bg-white", className)}>
      <Picker
        selectedValue={value}
        onValueChange={onChange}
        className="px-4"
        itemStyle={{ color: COLORS.MAIN_TEXT }}
        selectionColor={COLORS.SECONDARY_TEXT}
        mode="dropdown"
      >
        <Picker.Item
          label="Cualquier estado"
          value={null}
          color={COLORS.SECONDARY_TEXT}
        />
        <Picker.Item label="Nuevo" value="new" />
        <Picker.Item label="Usado" value="used" />
        <Picker.Item label="Dañado" value="damaged" />
        <Picker.Item label="Reparado" value="repaired" />
      </Picker>
    </View>
  );
}
