import { View, Text, Image, Pressable, Platform } from "react-native";
import React from "react";
import { twMerge } from "tailwind-merge";
import ProductStatusBadge from "../badges/ProductStatusBadge";
import UserBadge from "../badges/UserBadge";
import CreditsBadge from "../badges/CreditsBadge";
import { useRouter } from "expo-router";
import { getUrl } from "@/services/getUrl";
import CategoryBadge from "../CategoryBadge";
import SchoolLogo from "../SchoolLogo";
import { ELEVATION } from "@/config";

/**
 * Card hero image ratio (design.md D3). Kept as a single named constant so the box shape is a
 * one-line change if portrait product photos read as too cropped after `contain` -> `cover`.
 */
const CARD_IMAGE_ASPECT_RATIO = "aspect-[4/3]";

/** Fixed thumbnail size for the `compact` variant, matching the pre-redesign row layout. */
const COMPACT_IMAGE_WIDTH = 96;
const COMPACT_IMAGE_HEIGHT = 112;

const schoolAvatars = (schools: Listing["seller"]["schools"]) => (
  <View className="flex-1 flex-row gap-0.5 overflow-hidden">
    {schools.map((school) => (
      <SchoolLogo
        key={school.id}
        school={school}
        size={24}
        className="rounded-full border border-stroke"
        resizeMode="contain"
      />
    ))}
  </View>
);

export default function Listing({
  listing,
  customButton,
  variant = "grid",
  onPress: onPressProp,
}: {
  listing: Listing;
  customButton?: React.ReactNode;
  variant?: "grid" | "compact";
  /** Overrides the default navigation-to-detail behaviour when provided (e.g. selection flows). */
  onPress?: () => void;
}) {
  const router = useRouter();
  // `Media[]` is non-optional in `shared/types/app.d.ts`, but the 2026-09-03 incident proved a
  // `listing` can reach this card with `media` missing at runtime — optional-chain it anyway
  // (design.md D6).
  const hasImage = (listing.media?.length ?? 0) > 0;
  const onPress =
    onPressProp ??
    (() =>
      router.push({
        pathname: "/(main)/listing/[listingId]",
        params: { listingId: listing.id.toString() },
      }));

  if (variant === "compact") {
    return (
      <Pressable
        className={twMerge(
          "flex-row gap-2 rounded-xl border border-stroke bg-white p-2",
          Platform.OS === "web" ? ELEVATION.raised.class : "",
        )}
        style={Platform.OS === "web" ? undefined : ELEVATION.raised.native}
        onPress={onPress}
      >
        {hasImage ? (
          <Image
            source={{ uri: getUrl(listing.media[0].url) }}
            style={{ width: COMPACT_IMAGE_WIDTH, height: COMPACT_IMAGE_HEIGHT }}
            className="rounded-lg bg-background"
            resizeMode="cover"
          />
        ) : (
          <View
            style={{ width: COMPACT_IMAGE_WIDTH, height: COMPACT_IMAGE_HEIGHT }}
            className="rounded-lg bg-background"
          />
        )}
        <View className="flex-1 justify-center gap-1">
          <Text numberOfLines={1} className="text-base font-medium text-main-text">
            {listing.title}
          </Text>
          <CategoryBadge category={listing.category} className="text-sm" numberOfLines={1} />
          <View className="flex-row items-center gap-2">
            <ProductStatusBadge status={listing.productStatus} />
            {schoolAvatars(listing.seller.schools)}
          </View>
          <UserBadge user={listing.seller} />
        </View>
        <View className="items-end justify-center gap-2">
          <CreditsBadge credits={listing.price} />
          {customButton}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      className={twMerge(
        "h-full w-full overflow-hidden rounded-xl border border-stroke bg-white",
        Platform.OS === "web" ? ELEVATION.raised.class : "",
      )}
      style={Platform.OS === "web" ? undefined : ELEVATION.raised.native}
      onPress={onPress}
    >
      {hasImage ? (
        <Image
          source={{ uri: getUrl(listing.media[0].url) }}
          className={twMerge(CARD_IMAGE_ASPECT_RATIO, "w-full bg-background")}
          resizeMode="cover"
        />
      ) : (
        <View className={twMerge(CARD_IMAGE_ASPECT_RATIO, "w-full bg-background")} />
      )}
      <View className="gap-2 p-3">
        <View className="flex-row items-start justify-between gap-2">
          <Text numberOfLines={2} className="flex-1 text-lg font-medium text-main-text">
            {listing.title}
          </Text>
          <CreditsBadge credits={listing.price} />
        </View>
        <CategoryBadge category={listing.category} className="text-sm" numberOfLines={1} />
        <View className="flex-row items-center gap-2">
          <ProductStatusBadge status={listing.productStatus} />
          {schoolAvatars(listing.seller.schools)}
        </View>
        <UserBadge user={listing.seller} />
        {customButton}
      </View>
    </Pressable>
  );
}
