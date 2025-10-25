import { COLORS, PRODUCT_STATUSES } from "@/config";
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
  emptyLabel,
}: {
  value: ProductStatus | null;
  onChange: (value: ProductStatus | null) => void;
  className?: string;
  emptyLabel?: string;
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
          label={emptyLabel || "Cualquier estado"}
          value={null}
          color={COLORS.SECONDARY_TEXT}
        />
        <Picker.Item label="Nuevo" value={PRODUCT_STATUSES.NEW} />
        <Picker.Item label="Como nuevo" value={PRODUCT_STATUSES.LIKE_NEW} />
        <Picker.Item label="Muy bueno" value={PRODUCT_STATUSES.VERY_GOOD} />
        <Picker.Item label="Bueno" value={PRODUCT_STATUSES.GOOD} />
        <Picker.Item label="Regular" value={PRODUCT_STATUSES.FAIR} />
      </Picker>
    </View>
  );
}
