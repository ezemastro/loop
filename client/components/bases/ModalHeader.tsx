import { Pressable, Text, View } from "react-native";
import { twMerge } from "tailwind-merge";
import { CrossIcon } from "../Icons";

/**
 * Surface every dialog built on `CustomModal` uses: white, `rounded-xl`, 20px of padding and one
 * 16px rhythm between its blocks. Spread `style={{ maxHeight }}` from the `CustomModal` render
 * function next to it when the content can scroll.
 */
export const MODAL_SURFACE_CLASS = "w-full overflow-hidden rounded-xl bg-white p-5 gap-4";

export const modalSurfaceClassName = (className?: string) =>
  twMerge(MODAL_SURFACE_CLASS, className);

/**
 * Title (18 semibold, left aligned) with the close button at the right, always in the same place
 * and with a 44px hit area. Without `onClose` it renders only the title.
 */
export default function ModalHeader({
  title,
  onClose,
  className,
}: {
  title: string;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <View className={twMerge("flex-row items-center justify-between gap-2", className)}>
      <Text
        className="flex-1 text-left text-lg font-semibold text-main-text"
        accessibilityRole="header"
      >
        {title}
      </Text>
      {onClose ? (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          // Pulled into the padding so the 44px target does not push the title off its baseline.
          className="-mr-2.5 -my-2.5 h-11 w-11 items-center justify-center rounded-full hover:bg-background active:opacity-80"
        >
          <CrossIcon size={22} className="text-main-text" />
        </Pressable>
      ) : null}
    </View>
  );
}
