import type { ComponentType } from "react";
import { Pressable, Text, View } from "react-native";
import { twMerge } from "tailwind-merge";
import type { IconProps } from "@expo/vector-icons/build/createIconSet";

/** One pressable row in the settings list — icon, label, optional description, destructive variant. */
export default function SettingsRow({
  label,
  description,
  Icon,
  variant = "default",
  onPress,
}: {
  label: string;
  description?: string;
  Icon: ComponentType<Partial<IconProps<string>> & { color?: string }>;
  variant?: "default" | "destructive";
  onPress: () => void;
}) {
  const isDestructive = variant === "destructive";
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3 rounded-lg bg-white active:opacity-70"
    >
      <Icon className={isDestructive ? "text-alert" : "text-main-text"} size={22} />
      <View className="flex-1 gap-0.5">
        <Text className={twMerge("text-lg", isDestructive ? "text-alert" : "text-main-text")}>
          {label}
        </Text>
        {description && <Text className="text-secondary-text text-sm">{description}</Text>}
      </View>
    </Pressable>
  );
}
