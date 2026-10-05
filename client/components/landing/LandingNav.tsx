import { Image, Pressable, Text, View } from "react-native";
import { NAV_LINKS } from "./content";
import LandingButton from "./LandingButton";
import { FOCUS_RING, LANDING_CONTAINER } from "./layout";

type Props = {
  onNavigate: (id: string) => void;
};

/** Top nav, 72px, one line, aligned to the landing container. Anchor links hide below `lg`. */
export default function LandingNav({ onNavigate }: Props) {
  return (
    <View className="w-full border-b border-stroke bg-white/95" style={{ height: 72 }}>
      <View className={`${LANDING_CONTAINER} h-full flex-row items-center justify-between`}>
        <Image
          source={require("../../assets/full_logo.png")}
          accessibilityLabel="Loop"
          resizeMode="contain"
          style={{ width: 92, height: 25 }}
        />

        <View className="flex-row items-center gap-8">
          <View className="flex-row items-center gap-7 max-lg:hidden">
            {NAV_LINKS.map((link) => (
              <Pressable
                key={link.id}
                onPress={() => onNavigate(link.id)}
                accessibilityRole="link"
                accessibilityLabel={link.label}
                hitSlop={8}
                className={`group rounded-sm ${FOCUS_RING}`}
              >
                <Text className="text-sm font-semibold text-main-text underline-offset-[6px] transition-colors duration-200 group-hover:text-secondary group-hover:underline">
                  {link.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <LandingButton
            href="/ingresar"
            label="Ingresar"
            accessibilityLabel="Ingresar a Loop"
            size="sm"
          />
        </View>
      </View>
    </View>
  );
}
