import { View, Text, Image } from "react-native";
import { twMerge } from "tailwind-merge";
import { getUrl } from "@/services/getUrl";

/**
 * School logo with a built-in placeholder for schools that have no resolvable media.
 *
 * `School.media` is nullable on purpose (ECO-12): a school is never dropped from a list just
 * because its logo stopped resolving. That guarantee only holds in the UI if every logo call site
 * can render the school without an image, so the fallback keeps the same footprint as the image
 * and shows the school's initial instead of collapsing the row.
 */
export default function SchoolLogo({
  school,
  size,
  className,
  resizeMode = "cover",
}: {
  school: School;
  /**
   * Edge length in px. Applied as an inline `style` rather than a class because width/height
   * utilities do not resolve on `Image`, mirroring `UserBadge`'s `imageSize`.
   */
  size: number;
  className?: string;
  resizeMode?: "cover" | "contain";
}) {
  if (!school.media) {
    return (
      <View
        accessibilityLabel={school.name}
        className={twMerge("items-center justify-center bg-background", className)}
        style={{ width: size, height: size }}
      >
        <Text
          className="text-secondary-text font-bold"
          style={{ fontSize: Math.max(9, Math.round(size * 0.45)) }}
        >
          {school.name.trim().charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={school.name}
      source={{ uri: getUrl(school.media.url) }}
      className={className}
      style={{ width: size, height: size }}
      resizeMode={resizeMode}
    />
  );
}
