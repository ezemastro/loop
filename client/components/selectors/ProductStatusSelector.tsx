import { COLORS, PRODUCT_STATUSES, STATUS_TRANSLATIONS } from "@/config";
import { Picker } from "@react-native-picker/picker";
import { cssInterop } from "nativewind";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { twMerge } from "tailwind-merge";
import { ArrowDownIcon, ArrowUpIcon } from "../Icons";

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
  const [isOpen, setIsOpen] = useState(false);
  const options: { label: string; value: ProductStatus | null }[] = [
    { label: emptyLabel || "Cualquier estado", value: null },
    {
      label: STATUS_TRANSLATIONS[PRODUCT_STATUSES.NEW],
      value: PRODUCT_STATUSES.NEW,
    },
    {
      label: STATUS_TRANSLATIONS[PRODUCT_STATUSES.LIKE_NEW],
      value: PRODUCT_STATUSES.LIKE_NEW,
    },
    {
      label: STATUS_TRANSLATIONS[PRODUCT_STATUSES.VERY_GOOD],
      value: PRODUCT_STATUSES.VERY_GOOD,
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
        <Pressable
          onPress={() => setIsOpen((prev) => !prev)}
          className={twMerge(
            "min-h-14 flex-row items-center justify-between border border-stroke rounded px-4 bg-white",
            className,
          )}
        >
          <Text
            className={twMerge(
              "text-lg",
              value ? "text-main-text" : "text-secondary-text",
            )}
          >
            {selectedOption?.label || emptyLabel || "Cualquier estado"}
          </Text>
          {isOpen ? (
            <ArrowUpIcon className="text-secondary-text" />
          ) : (
            <ArrowDownIcon className="text-secondary-text" />
          )}
        </Pressable>

        {isOpen && (
          <View className="absolute left-0 right-0 bottom-full mb-1 rounded border border-stroke bg-white z-50 overflow-hidden">
            {options.map((option) => (
              <Pressable
                key={option.value || "any"}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={twMerge(
                  "px-4 py-3 border-b border-stroke/60",
                  value === option.value ? "bg-secondary/10" : "bg-white",
                )}
              >
                <Text
                  className={twMerge(
                    "text-base",
                    option.value === null
                      ? "text-secondary-text"
                      : "text-main-text",
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
    <View className={twMerge("bg-white", className)}>
      <Picker
        selectedValue={value}
        onValueChange={onChange}
        className="px-4"
        itemStyle={{ color: COLORS.MAIN_TEXT }}
        selectionColor={COLORS.SECONDARY_TEXT}
        mode="dropdown"
      >
        {options.map((option) => (
          <Picker.Item
            key={option.value || "any"}
            label={option.label}
            value={option.value}
            color={
              option.value === null ? COLORS.SECONDARY_TEXT : COLORS.MAIN_TEXT
            }
          />
        ))}
      </Picker>
    </View>
  );
}
