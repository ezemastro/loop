import type { ComponentType } from "react";
import type { Href } from "expo-router";
import type { IconProps } from "@expo/vector-icons/build/createIconSet";
import {
  HomeIcon,
  MyListingsIcon,
  PublishIcon,
  WishlistIcon,
  ProfileIcon,
} from "@/components/Icons";

export type PrimaryTabKey = "home" | "myListings" | "publish" | "wishlist" | "profile";

export interface PrimaryTab {
  /** Matches the expo-router screen `name` under `app/(main)/(tabs)/`. */
  key: PrimaryTabKey;
  label: string;
  /** Full path passed to `router.push`, including route groups. */
  href: Href;
  /** Segment `usePathname()` resolves to once route groups are stripped (e.g. `/home`). */
  matchPath: string;
  Icon: ComponentType<Partial<IconProps<string>>>;
}

/**
 * Single source of truth for the five primary tabs. Both the bottom tab bar
 * (`app/(main)/(tabs)/_layout.tsx`) and the desktop header nav (`DesktopNavLinks.tsx`) render from
 * this array, so the two navigations can never drift apart. Order here is the order both render in.
 */
export const PRIMARY_TABS: PrimaryTab[] = [
  {
    key: "home",
    label: "Inicio",
    href: "/(main)/(tabs)/home",
    matchPath: "/home",
    Icon: HomeIcon,
  },
  {
    key: "myListings",
    label: "Mis Loops",
    href: "/(main)/(tabs)/myListings",
    matchPath: "/myListings",
    Icon: MyListingsIcon,
  },
  {
    key: "publish",
    label: "Publicar",
    href: "/(main)/(tabs)/publish",
    matchPath: "/publish",
    Icon: PublishIcon,
  },
  {
    key: "wishlist",
    label: "Deseados",
    href: "/(main)/(tabs)/wishlist",
    matchPath: "/wishlist",
    Icon: WishlistIcon,
  },
  {
    key: "profile",
    label: "Perfil",
    href: "/(main)/(tabs)/profile",
    matchPath: "/profile",
    Icon: ProfileIcon,
  },
];
