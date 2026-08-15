import { View } from "react-native";
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
        icon={<WasteIcon color={colors.PRIMARY} size={42} />}
      />
      <Stat
        label="Kg. de CO2 equivalente ahorrado"
        value={kgCo2}
        icon={<CO2Icon color={colors.SECONDARY} size={42} />}
      />
      <Stat
        label="Metros cúbicos de H20 ahorrados"
        value={lH2o}
        icon={<H20Icon color={colors.TERTIARY} size={42} />}
      />
    </View>
  );
}
