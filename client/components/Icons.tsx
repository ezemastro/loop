import { IconProps } from "@expo/vector-icons/build/createIconSet";
import Feather from "@expo/vector-icons/Feather";
import { cssInterop } from "nativewind";
import { Image } from "react-native";

cssInterop(Feather, {
  className: {
    target: "color",
    nativeStyleToProp: {
      color: true,
    },
  },
});

export const SearchIcon = ({
  className,
  ...props
}: { className?: string } & Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="search" />
);

export const CreditIcon = ({ className }: { className?: string }) => (
  <Image
    source={require("../assets/icons/credit.png")}
    className={"size-7 " + className}
  />
);

export const MessageIcon = ({
  className,
  ...props
}: {
  className?: string;
} & Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="message-circle" />
);
export const NotificationIcon = ({
  className,
  ...props
}: {
  className?: string;
} & Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="bell" />
);
