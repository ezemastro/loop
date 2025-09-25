import { View } from "react-native";
import Stat from "./cards/Stat";
import { CO2Icon, H20Icon, WasteIcon } from "./Icons";

export default function Stats({ listing }: { listing?: Listing }) {
  return (
    <View className="flex-row justify-between gap-2">
      <Stat
        label="Kg. de desechos reciclados"
        value={!listing ? 150 : listing.category.stats?.kgWaste || 1}
        icon={<WasteIcon className="text-primary" size={42} />}
      />
      <Stat
        label="Kg. de CO2 ahorrado"
        value={!listing ? 350 : listing.category.stats?.kgCo2 || 0.1}
        icon={<CO2Icon className="text-secondary" size={42} />}
      />
      <Stat
        label="Litros de H20 ahorrados"
        value={!listing ? 24 : listing.category.stats?.lH2o || 0.2}
        icon={<H20Icon className="text-tertiary" size={42} />}
      />
    </View>
  );
}
