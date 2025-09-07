import { COLORS } from "@/config";
import { Picker } from "@react-native-picker/picker";
import { cssInterop } from "nativewind";

cssInterop(Picker, {
  className: "style",
});

export default function ProductStatusSelector({
  value,
  onChange,
}: {
  value: ProductStatus | null;
  onChange: (value: ProductStatus | null) => void;
}) {
  return (
    <Picker
      selectedValue={value}
      onValueChange={onChange}
      className="bg-white px-4"
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
  );
}
