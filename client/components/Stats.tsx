import { View } from "react-native";
import Stat from "./cards/Stat";
import { CO2Icon, H20Icon, WasteIcon } from "./Icons";

export default function Stats() {
  return (
    <View className="flex-row justify-between my-4 gap-2">
      <Stat
        label="Kg. de desechos reciclados"
        value={150}
        icon={<WasteIcon className="text-primary" size={42} />}
      />
      <Stat
        label="Kg. de CO2 ahorrado"
        value={350}
        icon={<CO2Icon className="text-secondary" size={42} />}
      />
      <Stat
        label="Litros de H20 ahorrados"
        value={24}
        icon={<H20Icon className="text-tertiary" size={42} />}
      />
    </View>
  );
}
