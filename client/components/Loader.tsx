import { ActivityIndicator, View } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

/** Centered spinner in the community accent colour. No text: the spinner says it. */
export default function Loader() {
  const colors = useThemeColors();
  return (
    <View className="items-center justify-center py-6" accessibilityRole="progressbar">
      <ActivityIndicator color={colors.ACCENT} accessibilityLabel="Cargando" />
    </View>
  );
}
