import { View } from "react-native";
import Stat from "./cards/Stat";
import { CO2Icon, H20Icon, WasteIcon } from "./Icons";
import { COLORS } from "../config";

export default function Stats({
  kgWaste,
  kgCo2,
  lH2o,
}: {
  kgWaste: number;
  kgCo2: number;
  lH2o: number;
}) {
  return (
    <View className="flex-row justify-between gap-2">
      <Stat
        label="Kg. de desechos reciclados"
        value={kgWaste}
        icon={<WasteIcon color={COLORS.PRIMARY} size={42} />}
      />
      <Stat
        label="Kg. de CO2 ahorrado"
        value={kgCo2}
        icon={<CO2Icon color={COLORS.SECONDARY} size={42} />}
      />
      <Stat
        label="Litros de H20 ahorrados"
        value={lH2o}
        icon={<H20Icon color={COLORS.TERTIARY} size={42} />}
      />
    </View>
  );
}
