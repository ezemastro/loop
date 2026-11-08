import { ELEVATION, PRODUCT_STATUSES, STATUS_TRANSLATIONS } from "@/config";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Picker } from "@react-native-picker/picker";
import { cssInterop } from "nativewind";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { twMerge } from "tailwind-merge";
import { ArrowDownIcon, ArrowUpIcon } from "../Icons";
import { ControlTrigger, controlClassName } from "../bases/Field";

cssInterop(Picker, {
  className: "style",
});

export default function ProductStatusSelector({
  value,
  onChange,
  className,
  emptyLabel,
  invalid,
}: {
  value: ProductStatus | null;
  onChange: (value: ProductStatus | null) => void;
  className?: string;
  emptyLabel?: string;
  invalid?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = useThemeColors();
  const options: { label: string; value: ProductStatus | null }[] = [
    { label: emptyLabel || "Cualquier estado", value: null },
    {
      label: STATUS_TRANSLATIONS[PRODUCT_STATUSES.LIKE_NEW],
      value: PRODUCT_STATUSES.LIKE_NEW,
    },
    {
      label: STATUS_TRANSLATIONS[PRODUCT_STATUSES.GOOD],
      value: PRODUCT_STATUSES.GOOD,
    },
    {
      label: STATUS_TRANSLATIONS[PRODUCT_STATUSES.FAIR],
      value: PRODUCT_STATUSES.FAIR,
    },
  ];

  const selectedOption = options.find((option) => option.value === value);

  if (Platform.OS === "web") {
    return (
      <View className="relative">
        <ControlTrigger
          onPress={() => setIsOpen((prev) => !prev)}
          invalid={invalid}
          className={className}
          placeholder={emptyLabel || "Cualquier estado"}
          value={value ? selectedOption?.label : null}
          trailing={
            isOpen ? (
              <ArrowUpIcon size={20} className="text-secondary-text" />
            ) : (
              <ArrowDownIcon size={20} className="text-secondary-text" />
            )
          }
        />

        {isOpen && (
          <View
            className={twMerge(
              "absolute left-0 right-0 bottom-full z-50 mb-1 overflow-hidden rounded-lg border border-stroke bg-white",
              ELEVATION.overlay.class,
            )}
          >
            {options.map((option) => (
              <Pressable
                key={option.value || "any"}
                accessibilityRole="button"
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={twMerge(
                  "min-h-[44px] justify-center border-b border-stroke px-3 last:border-b-0 hover:bg-background",
                  value === option.value ? "bg-accent/10" : "bg-white",
                )}
              >
                <Text
                  className={twMerge(
                    "text-left text-base",
                    option.value === null ? "text-secondary-text" : "text-main-text",
                  )}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View className={twMerge(controlClassName({ invalid }), "px-0", className)}>
      <Picker
        selectedValue={value}
        onValueChange={onChange}
        className="flex-1 px-3"
        itemStyle={{ color: colors.MAIN_TEXT }}
        selectionColor={colors.SECONDARY_TEXT}
        mode="dropdown"
      >
        {options.map((option) => (
          <Picker.Item
            key={option.value || "any"}
            label={option.label}
            value={option.value}
            color={option.value === null ? colors.SECONDARY_TEXT : colors.MAIN_TEXT}
          />
        ))}
      </Picker>
    </View>
  );
}
