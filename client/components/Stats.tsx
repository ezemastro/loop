import { View } from "react-native";
import Stat from "./cards/Stat";
import { CO2Icon, H20Icon, WasteIcon } from "./Icons";

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
        icon={<WasteIcon className="text-primary" size={42} />}
      />
      <Stat
        label="Kg. de CO2 ahorrado"
        value={kgCo2}
        icon={<CO2Icon className="text-secondary" size={42} />}
      />
      <Stat
        label="Litros de H20 ahorrados"
        value={lH2o}
        icon={<H20Icon className="text-tertiary" size={42} />}
      />
    </View>
  );
}
