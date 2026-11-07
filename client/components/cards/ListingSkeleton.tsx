import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, View } from "react-native";

const Block = ({ className }: { className: string }) => (
  <View className={"rounded-md bg-main-text/10 " + className} />
);

/**
 * Grey placeholder in the shape of a grid `Listing` card. Pulses gently unless the system asks for
 * reduced motion, in which case it stays static.
 */
export default function ListingSkeleton() {
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && setReduceMotion(enabled))
      .catch(() => mounted && setReduceMotion(true));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 900,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ opacity }}
      className="h-full w-full overflow-hidden rounded-xl border border-stroke bg-white"
    >
      <View className="aspect-[4/3] w-full bg-main-text/10" />
      <View className="gap-2 p-3">
        <Block className="h-4 w-4/5" />
        <Block className="h-4 w-1/3" />
        <Block className="h-3 w-1/2" />
        <View className="flex-row gap-2">
          <Block className="h-5 w-16 rounded-full" />
          <Block className="h-6 w-6 rounded-full" />
        </View>
        <Block className="h-5 w-2/5" />
      </View>
    </Animated.View>
  );
}
