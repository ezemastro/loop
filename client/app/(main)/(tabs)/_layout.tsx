import { Tabs } from "expo-router";
import { StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelf } from "@/hooks/useSelf";
import { useHideOnKeyboard } from "@/hooks/useHideOnKeyboard";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { PRIMARY_TABS, type PrimaryTabKey } from "@/components/header/primaryTabs";

const tabByKey = (key: PrimaryTabKey) => {
  const tab = PRIMARY_TABS.find((t) => t.key === key);
  if (!tab) throw new Error(`Missing primary tab entry for key "${key}"`);
  return tab;
};

export default function TabsLayout() {
  // Agregar esto al main layout autenticado
  useSelf(); // Hook para mantener la sesión del usuario actualizada

  // Ocultar tab bar al mostrar el teclado
  const { visible } = useHideOnKeyboard();
  const colors = useThemeColors();

  const insets = useSafeAreaInsets();

  // At lg+ the primary tabs move into the header (see DesktopNavLinks); the bottom bar hides but
  // the Tabs navigator stays mounted so routing keeps working. `display: "none"` is the only
  // native-safe way to hide it — tabBarStyle is a native style object, not a className, so the
  // Tailwind-web display-restore idioms guarded in responsive-tokens.test.ts do not apply here.
  const breakpoint = useBreakpoint();
  const isDesktopNav = breakpoint === "lg" || breakpoint === "xl";

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={colors.SECONDARY} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarInactiveTintColor: colors.SECONDARY_TEXT,
          tabBarActiveTintColor: colors.PRIMARY,
          tabBarLabelStyle: {
            fontSize: 11.5,
            fontWeight: "600",
          },
          tabBarStyle: {
            height: 60 + insets.bottom,
            paddingTop: 5,
            display: isDesktopNav ? "none" : visible ? "flex" : "none",
          },
          tabBarHideOnKeyboard: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: tabByKey("home").label,
            tabBarIcon: ({ color, size }) => {
              const { Icon } = tabByKey("home");
              return <Icon color={color} size={size + 2} />;
            },
          }}
        />
        <Tabs.Screen
          name="myListings"
          options={{
            title: tabByKey("myListings").label,
            tabBarIcon: ({ color, size }) => {
              const { Icon } = tabByKey("myListings");
              return <Icon color={color} size={size + 2} />;
            },
          }}
        />
        <Tabs.Screen
          name="publish"
          options={{
            title: tabByKey("publish").label,
            tabBarIcon: ({ color, size }) => {
              const { Icon } = tabByKey("publish");
              return (
                <Icon
                  color={color}
                  size={size + 8}
                  style={{ top: -2, height: 32, textAlign: "right" }}
                />
              );
            },
          }}
        />
        <Tabs.Screen
          name="wishlist"
          options={{
            title: tabByKey("wishlist").label,
            tabBarIcon: ({ color, size }) => {
              const { Icon } = tabByKey("wishlist");
              return <Icon color={color} size={size + 2} />;
            },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: tabByKey("profile").label,
            tabBarIcon: ({ color, size }) => {
              const { Icon } = tabByKey("profile");
              return <Icon color={color} size={size + 2} />;
            },
          }}
        />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>
    </>
  );
}
