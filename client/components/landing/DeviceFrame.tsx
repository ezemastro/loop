import { useThemeColors } from "@/hooks/useThemeColors";
import type { ImageSourcePropType } from "react-native";
import { Image, View } from "react-native";

type FrameProps = {
  source: ImageSourcePropType;
  alt: string;
  width: number;
};

/**
 * A simple phone bezel built from a bordered View around a real screenshot, not a decorative
 * fake-UI mockup: the content inside is always an actual `assets/landing/*.png` capture.
 */
export function PhoneFrame({ source, alt, width }: FrameProps) {
  const colors = useThemeColors();
  const height = Math.round(width * 2.165);

  return (
    <View
      className="overflow-hidden rounded-[2.5rem] bg-white p-2"
      style={{
        width: width + 16,
        height: height + 16,
        borderWidth: 6,
        borderColor: colors.MAIN_TEXT,
      }}
    >
      <View className="flex-1 overflow-hidden rounded-[1.9rem]">
        <Image
          source={source}
          accessibilityLabel={alt}
          resizeMode="cover"
          style={{ width, height }}
        />
      </View>
    </View>
  );
}

/** A minimal browser-chrome bar (three dots) framing the desktop screenshot. */
export function BrowserFrame({ source, alt, width }: FrameProps) {
  const colors = useThemeColors();
  const height = Math.round((width * 900) / 1440);

  return (
    <View
      className="overflow-hidden rounded-2xl bg-white"
      style={{ width, borderWidth: 1, borderColor: colors.STROKE }}
    >
      <View
        className="h-8 flex-row items-center gap-1.5 px-3"
        style={{ backgroundColor: colors.BACKGROUND }}
      >
        <View className="h-2.5 w-2.5 rounded-full bg-alert" />
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#E4C200" }} />
        <View className="h-2.5 w-2.5 rounded-full bg-tertiary" />
      </View>
      <Image
        source={source}
        accessibilityLabel={alt}
        resizeMode="cover"
        style={{ width, height }}
      />
    </View>
  );
}
