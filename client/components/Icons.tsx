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
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="search" />
);

export const CreditIcon = ({
  className,
  size,
}: {
  className?: string;
  size?: number;
}) => (
  <Image
    source={require("../assets/icons/credit.png")}
    className={"size-7 " + className}
    style={size ? { width: size, height: size } : {}}
  />
);

export const MessageIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="message-circle" />
);
export const NotificationIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="bell" />
);
export const BackIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="arrow-left" />
);
export const ArrowDownIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="arrow-down" />
);
export const ArrowUpIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="arrow-up" />
);
export const CrossIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="x" />
);
export const CameraIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="camera" />
);
export const EditIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="edit" />
);
export const DeleteIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="trash-2" />
);
export const WasteIcon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="trash" />
);
export const CO2Icon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="cloud" />
);
export const H20Icon = ({
  className,
  ...props
}: Partial<IconProps<string>>) => (
  <Feather size={24} className={className} {...props} name="droplet" />
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
