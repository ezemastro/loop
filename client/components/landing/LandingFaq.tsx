import { ArrowDownIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { FAQ_ITEMS } from "./content";
import {
  BODY_TEXT,
  FOCUS_RING,
  LANDING_CONTAINER,
  SECTION_HEADING,
  SECTION_PADDING,
} from "./layout";
import Reveal from "./Reveal";

/** Accordion under its heading, one item open at a time, hairline-separated rows. */
export default function LandingFaq() {
  const colors = useThemeColors();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <View className={`w-full ${SECTION_PADDING}`} nativeID="preguntas">
      <View className={LANDING_CONTAINER}>
        <Reveal>
          <Text accessibilityRole="header" className={SECTION_HEADING}>
            Preguntas frecuentes
          </Text>
        </Reveal>

        <Reveal
          step={1}
          className="mt-8 w-full min-w-0 border-b border-stroke lg:mt-10 lg:max-w-[52rem]"
        >
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <View key={item.id} className="border-t border-stroke">
                <Pressable
                  onPress={() => setOpenId(isOpen ? null : item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={item.question}
                  className={`group flex-row items-center justify-between gap-4 rounded-sm py-5 ${FOCUS_RING}`}
                >
                  <Text
                    className={`flex-1 text-base font-bold transition-colors duration-200 group-hover:text-secondary ${
                      isOpen ? "text-secondary" : "text-main-text"
                    }`}
                  >
                    {item.question}
                  </Text>
                  <View
                    className={`transition-transform duration-300 motion-reduce:transition-none ${
                      isOpen ? "rotate-180" : "rotate-0"
                    }`}
                  >
                    <ArrowDownIcon color={colors.SECONDARY} size={20} />
                  </View>
                </Pressable>
                {isOpen ? (
                  <Text className={`pb-5 pr-10 text-[15px] leading-6 ${BODY_TEXT}`}>
                    {item.answer}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Reveal>
      </View>
    </View>
  );
}
