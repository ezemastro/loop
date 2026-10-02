import { useThemeColors } from "@/hooks/useThemeColors";
import { Link } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { NAV_LINKS } from "./content";

type Props = {
  onNavigate: (id: string) => void;
};

/** Top nav, <= 72px, one line. Anchor links hide below `lg`; "Ingresar" stays visible always. */
export default function LandingNav({ onNavigate }: Props) {
  const colors = useThemeColors();

  return (
    <View
      className="w-full flex-row items-center justify-between border-b bg-white px-5 py-3 lg:px-10"
      style={{ borderColor: colors.STROKE, height: 72 }}
    >
      <Image
        source={require("../../assets/full_logo.png")}
        accessibilityLabel="Loop"
        resizeMode="contain"
        style={{ width: 92, height: 25 }}
      />

      <View className="flex-row items-center gap-6">
        <View className="max-lg:hidden flex-row items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Pressable
              key={link.id}
              onPress={() => onNavigate(link.id)}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              hitSlop={8}
            >
              <Text className="text-sm font-semibold" style={{ color: colors.MAIN_TEXT }}>
                {link.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Link href="/ingresar" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Ingresar a Loop"
            className="rounded-full bg-primary px-5 py-2.5"
          >
            <Text className="text-sm font-bold text-white">Ingresar</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
