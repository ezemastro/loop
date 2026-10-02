import { ArrowDownIcon, ArrowUpIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { FadeInDown } from "react-native-reanimated";
import AnimatedView from "./AnimatedView";
import { FAQ_ITEMS } from "./content";

/** Accordion: one item expanded at a time, plain Pressable expand/collapse. */
export default function LandingFaq() {
  const colors = useThemeColors();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <View className="w-full px-5 py-16 lg:px-10 lg:py-24" nativeID="preguntas">
      <Text
        accessibilityRole="header"
        className="text-center text-2xl font-bold lg:text-3xl"
        style={{ color: colors.MAIN_TEXT }}
      >
        Preguntas frecuentes
      </Text>

      <View className="mx-auto mt-10 w-full max-w-2xl gap-3">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openId === item.id;
          return (
            <AnimatedView
              key={item.id}
              entering={FadeInDown.duration(400).delay(index * 50)}
              className="overflow-hidden rounded-2xl"
              style={{ borderWidth: 1, borderColor: colors.STROKE }}
            >
              <Pressable
                onPress={() => setOpenId(isOpen ? null : item.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={item.question}
                className="flex-row items-center justify-between gap-3 bg-white px-5 py-4"
              >
                <Text className="flex-1 text-sm font-bold" style={{ color: colors.MAIN_TEXT }}>
                  {item.question}
                </Text>
                {isOpen ? (
                  <ArrowUpIcon color={colors.SECONDARY_TEXT} size={18} />
                ) : (
                  <ArrowDownIcon color={colors.SECONDARY_TEXT} size={18} />
                )}
              </Pressable>
              {isOpen ? (
                <View className="bg-white px-5 pb-4">
                  <Text className="text-sm" style={{ color: colors.SECONDARY_TEXT }}>
                    {item.answer}
                  </Text>
                </View>
              ) : null}
            </AnimatedView>
          );
        })}
      </View>
    </View>
  );
}
