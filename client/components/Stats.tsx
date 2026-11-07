import { Text, View } from "react-native";
import { formatNumber } from "@/utils/formatNumber";
import Stat from "./cards/Stat";
import { CO2Icon, H20Icon, WasteIcon } from "./Icons";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function Stats({
  kgWaste,
  kgCo2,
  lH2o,
}: {
  kgWaste: number;
  kgCo2: number;
  lH2o: number;
}) {
  const colors = useThemeColors();

  return (
    <View className="flex-row justify-between gap-2">
      <Stat
        label="Kg. de residuos evitados"
        value={kgWaste}
        icon={<WasteIcon color={colors.MAIN_TEXT} size={32} />}
      />
      <Stat
        label="Kg. de CO2 equivalente ahorrado"
        value={kgCo2}
        icon={<CO2Icon color={colors.MAIN_TEXT} size={32} />}
      />
      <Stat
        label="Litros de agua ahorrados"
        value={lH2o}
        icon={<H20Icon color={colors.MAIN_TEXT} size={32} />}
      />
    </View>
  );
}

const ImpactItem = ({
  icon,
  value,
  label,
  bordered,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  bordered?: boolean;
}) => (
  <View
    className={
      "min-w-0 flex-1 items-center justify-center gap-1 px-2 py-3 md:flex-row md:gap-3 md:py-0 " +
      (bordered ? "border-l border-stroke" : "")
    }
  >
    {icon}
    <View className="min-w-0 items-center md:items-start">
      <Text className="text-lg font-semibold text-main-text">{formatNumber(value)}</Text>
      <Text className="text-center text-xs text-secondary-text md:text-left">{label}</Text>
    </View>
  </View>
);

/**
 * Slim version of `Stats` for the home: one white card with the three figures in a row (about 72px
 * tall on desktop, compact on mobile, no horizontal scroll at 390px).
 */
export function ImpactStrip({
  kgWaste,
  kgCo2,
  lH2o,
}: {
  kgWaste: number;
  kgCo2: number;
  lH2o: number;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-row rounded-xl border border-stroke bg-white md:min-h-[72px]">
      <ImpactItem
        icon={<WasteIcon color={colors.ACCENT} size={24} />}
        value={kgWaste}
        label="kg de residuos evitados"
      />
      <ImpactItem
        bordered
        icon={<CO2Icon color={colors.ACCENT} size={24} />}
        value={kgCo2}
        label="kg de CO2 ahorrados"
      />
      <ImpactItem
        bordered
        icon={<H20Icon color={colors.ACCENT} size={24} />}
        value={lH2o}
        label="litros de agua ahorrados"
      />
    </View>
  );
}
