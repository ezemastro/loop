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
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="search"
  />
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
    className={className}
    style={size ? { width: size, height: size } : { width: 32, height: 32 }}
    resizeMode="contain"
  />
);

export const MessageIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    style={{ color }}
    className={className}
    {...props}
    name="message-circle"
  />
);
export const NotificationIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    style={{ color }}
    className={className}
    {...props}
    name="bell"
  />
);
export const BackIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="arrow-left"
  />
);
export const ArrowDownIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="chevron-down"
  />
);
export const ArrowUpIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="chevron-up"
  />
);
export const CrossIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather size={24} color={color} className={className} {...props} name="x" />
);
export const CameraIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="camera"
  />
);
export const EditIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="edit"
  />
);
export const DeleteIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="trash-2"
  />
);
export const WasteIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="trash"
  />
);
export const CO2Icon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="cloud"
  />
);
export const H20Icon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="droplet"
  />
);
export const PlusCircleIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="plus-circle"
  />
);
export const MinusCircleIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="minus-circle"
  />
);
export const SendIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="send"
  />
);
export const UserIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="user"
  />
);
export const AddUserIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="user-plus"
  />
);
export const GalleryIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="image"
  />
);
export const EmailIcon = ({
  className,
  color,
  ...props
}: Partial<IconProps<string>> & { color?: string }) => (
  <Feather
    size={24}
    color={color}
    className={className}
    {...props}
    name="mail"
  />
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
