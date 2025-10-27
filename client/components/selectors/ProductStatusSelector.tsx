import { COLORS, PRODUCT_STATUSES, STATUS_TRANSLATIONS } from "@/config";
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
        <Picker.Item
          label={STATUS_TRANSLATIONS[PRODUCT_STATUSES.NEW]}
          value={PRODUCT_STATUSES.NEW}
        />
        <Picker.Item
          label={STATUS_TRANSLATIONS[PRODUCT_STATUSES.LIKE_NEW]}
          value={PRODUCT_STATUSES.LIKE_NEW}
        />
        <Picker.Item
          label={STATUS_TRANSLATIONS[PRODUCT_STATUSES.VERY_GOOD]}
          value={PRODUCT_STATUSES.VERY_GOOD}
        />
        <Picker.Item
          label={STATUS_TRANSLATIONS[PRODUCT_STATUSES.GOOD]}
          value={PRODUCT_STATUSES.GOOD}
        />
        <Picker.Item
          label={STATUS_TRANSLATIONS[PRODUCT_STATUSES.FAIR]}
          value={PRODUCT_STATUSES.FAIR}
        />
      </Picker>
    </View>
  );
}
