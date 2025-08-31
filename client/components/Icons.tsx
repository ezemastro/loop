import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { cssInterop } from "nativewind";

cssInterop(MaterialIcons, {
  className: {
    target: "color",
    nativeStyleToProp: {
      color: true,
    },
  },
});

export const SearchIcon = ({ className }: { className?: string }) => (
  <MaterialIcons name="search" size={24} className={className} />
);
