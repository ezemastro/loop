import { Pressable, Text, View } from "react-native";
import { twMerge } from "tailwind-merge";
import { usePathname, useRouter } from "expo-router";
import { useThemeColors } from "@/hooks/useThemeColors";
import { PRIMARY_TABS } from "./primaryTabs";

/**
 * Horizontal nav rendered inside the header at `lg`+ (see Header.tsx). Shares the `PRIMARY_TABS`
 * source with the bottom tab bar, but NOT its tints.
 *
 * The tab bar sits on white, so `PRIMARY` / `SECONDARY_TEXT` read fine there. The header sits on
 * `SECONDARY`, a saturated brand colour, where `SECONDARY_TEXT` grey lands around 1.6:1 and is
 * effectively invisible. Header content is therefore white-based, matching the logo already on
 * this surface, and the active state is carried by opacity plus a translucent pill rather than by
 * hue -- which keeps it legible on whatever `SECONDARY` a given community defines.
 *
 * Mobile is untouched: the wrapping `View` in Header.tsx is `max-lg:hidden`, so below `lg` this
 * component's children never enter layout (native `display: none` removes them entirely) and the
 * header keeps its current two-zone shape.
 */
export default function DesktopNavLinks() {
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View className="flex-row items-center gap-6">
      {PRIMARY_TABS.map((tab) => {
        const isActive = pathname === tab.matchPath;

        // `publish` is the primary action (the tab bar renders it as an elevated plus-icon
        // button in the middle, not a peer tab). As a plain text link it would read as "just
        // another page", losing that intent, so it keeps a filled pill instead of a text link —
        // same information architecture as the bottom bar, adapted to a horizontal row.
        if (tab.key === "publish") {
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(tab.href)}
              className="flex-row items-center gap-2 rounded-full px-4 py-2"
              style={{ backgroundColor: colors.PRIMARY }}
            >
              <tab.Icon color="#FFFFFF" size={20} />
              <Text className="font-semibold text-white">{tab.label}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.href)}
            className={twMerge(
              "flex-row items-center gap-2 rounded-full px-3 py-2",
              isActive ? "bg-white/20" : "",
            )}
          >
            <tab.Icon color="#FFFFFF" size={20} />
            <Text
              className={twMerge(
                "text-white",
                isActive ? "font-semibold" : "font-medium opacity-75",
              )}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
