import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { pageContentClassName } from "../bases/MainView";
import { isConversationPath } from "./isConversationPath";
import AppLogo from "./AppLogo";
import CreditsBalance from "./CreditsBalance";
import DesktopNavLinks from "./DesktopNavLinks";
import HeaderSearchBar from "./HeaderSearchBar";
import Messages from "./Messages";
import Notifications from "./Notifications";

/**
 * White header with a 3px strip of the community colour on top (the community keeps its identity
 * without painting the whole chrome).
 *
 * - `lg`+: ONE row, 64px: logo, search (capped at 360px, shrinks before anything wraps), nav
 *   links, then credits / messages / notifications.
 * - below `lg`: logo and credits/icons on a 56px row, search (40px) on a second row.
 *
 * The two arrangements use the same pieces in a different order, which classes alone cannot do
 * (React Native has no `order`), so the switch reads the breakpoint instead of rendering the
 * search bar twice (two inputs would both claim `autoFocus`).
 */
export default function Header() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === "lg" || breakpoint === "xl";
  const isSearchScreen = pathname === "/search";
  // Inside a conversation the search row goes away on mobile so the messages get the screen.
  const hideSearchRow = !isDesktop && isConversationPath(pathname);

  const logo = (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Ir al inicio"
      onPress={() => router.push("/(main)/(tabs)/home")}
      onLongPress={() => router.push("/debug")}
    >
      <AppLogo />
    </Pressable>
  );

  const actions = (
    <View className="flex-row items-center gap-1">
      <CreditsBalance />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mensajes"
        onPress={() => router.push("/(main)/(tabs)/messages")}
        className="rounded-full hover:bg-background active:opacity-80"
      >
        <Messages />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notificaciones"
        onPress={() => router.push("/(main)/(tabs)/notifications")}
        className="rounded-full hover:bg-background active:opacity-80"
      >
        <Notifications />
      </Pressable>
    </View>
  );

  const search = (
    <HeaderSearchBar
      isSearchScreen={isSearchScreen}
      onNavigate={() => router.push("/(main)/(tabs)/search")}
      className="min-h-[40px]"
    />
  );

  return (
    <View className="z-50 border-b border-stroke bg-white" style={{ paddingTop: insets.top }}>
      <View className="h-[3px] bg-secondary" />
      {isDesktop ? (
        <View className={pageContentClassName("wide", "h-16 flex-row items-center gap-4 px-4")}>
          {logo}
          <View className="min-w-[160px] max-w-[360px] flex-1">{search}</View>
          <View className="min-w-0 flex-1 flex-row justify-end self-stretch">
            <DesktopNavLinks />
          </View>
          {actions}
        </View>
      ) : (
        <View className="px-4">
          <View className="h-14 flex-row items-center justify-between">
            {logo}
            {actions}
          </View>
          {hideSearchRow ? null : <View className="pb-2">{search}</View>}
        </View>
      )}
    </View>
  );
}
