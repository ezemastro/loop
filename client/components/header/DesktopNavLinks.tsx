import { Pressable, Text, View } from "react-native";
import { twMerge } from "tailwind-merge";
import { usePathname, useRouter } from "expo-router";
import { useThemeColors } from "@/hooks/useThemeColors";
import ButtonText from "../bases/ButtonText";
import CustomButton from "../bases/CustomButton";
import { PRIMARY_TABS } from "./primaryTabs";

/**
 * Horizontal nav rendered inside the header at `lg`+ (see Header.tsx). Shares the `PRIMARY_TABS`
 * source with the bottom tab bar.
 *
 * The header is white, so the links use the normal text roles: the active one is `accent` with a
 * 2px underline sitting on the header's bottom border, the others are `secondary-text` and darken
 * on hover. Icons only show from `xl` (`max-xl:hidden`): at exactly 1024px the row has to fit
 * logo + search + links + credits without wrapping, and the labels carry the meaning.
 *
 * `publish` is the primary action, so it is a real `primary` button rather than a link.
 *
 * Mobile is untouched: Header.tsx renders this only from `lg`.
 */
export default function DesktopNavLinks() {
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View className="flex-row items-center gap-1 self-stretch">
      {PRIMARY_TABS.map((tab) => {
        const isActive = pathname === tab.matchPath;

        if (tab.key === "publish") {
          return (
            <CustomButton
              key={tab.key}
              size="sm"
              className="mx-2 w-auto max-w-none"
              onPress={() => router.push(tab.href)}
            >
              <ButtonText>{tab.label}</ButtonText>
            </CustomButton>
          );
        }

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="link"
            accessibilityState={{ selected: isActive }}
            onPress={() => router.push(tab.href)}
            className="relative flex-row items-center gap-1.5 self-stretch px-2.5 xl:px-3"
          >
            <View className="max-xl:hidden">
              <tab.Icon color={isActive ? colors.ACCENT : colors.SECONDARY_TEXT} size={18} />
            </View>
            <Text
              className={twMerge(
                "text-sm",
                isActive
                  ? "font-medium text-accent"
                  : "font-normal text-secondary-text hover:text-main-text",
              )}
            >
              {tab.label}
            </Text>
            {isActive ? <View className="absolute inset-x-2 bottom-0 h-0.5 bg-accent" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
