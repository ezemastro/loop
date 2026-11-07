import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { twMerge } from "tailwind-merge";
import CustomButton from "./CustomButton";
import ButtonText from "./ButtonText";

/**
 * Calm "nothing here" block: muted icon, 16 semibold title, small explanation and, where there is
 * an obvious next step, one `secondary` button. `icon` is rendered as given, so callers pick the
 * glyph and size (32-40px) with `className="text-secondary-text"`.
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <View className={twMerge("items-center gap-2 px-6 py-10", className)}>
      {icon ? <View className="mb-1 opacity-70">{icon}</View> : null}
      <Text className="text-center text-base font-semibold text-main-text">{title}</Text>
      {description ? (
        <Text className="max-w-sm text-center text-sm text-secondary-text">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <CustomButton variant="secondary" onPress={onAction} className="mt-2 w-auto max-w-none">
          <ButtonText>{actionLabel}</ButtonText>
        </CustomButton>
      ) : null}
    </View>
  );
}
