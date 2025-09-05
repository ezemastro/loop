import { IconProps } from "@expo/vector-icons/build/createIconSet";
import Feather from "@expo/vector-icons/Feather";
import { cssInterop } from "nativewind";
import { Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

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
export const HomeIcon = (props: Partial<IconProps<string>>) => (
  <Ionicons size={24} {...props} name="home-outline" />
);
export const MyListingsIcon = (props: Partial<IconProps<string>>) => (
  <Ionicons size={24} {...props} name="library-outline" />
);
export const PublishIcon = (props: Partial<IconProps<string>>) => (
  <Ionicons size={24} {...props} name="add-circle-outline" />
);
export const WishlistIcon = (props: Partial<IconProps<string>>) => (
  <Ionicons size={24} {...props} name="bookmarks-outline" />
);
export const ProfileIcon = (props: Partial<IconProps<string>>) => (
  <Ionicons size={24} {...props} name="person-outline" />
);
