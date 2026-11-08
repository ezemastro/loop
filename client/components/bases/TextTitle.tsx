import { Text } from "react-native";
import { twMerge } from "tailwind-merge";

/**
 * Type scale for headings: `page` (24 semibold) names the screen, `section` (18 semibold) names a
 * block inside it. Both are left aligned; pass `className` for the rare exception.
 */
export default function TextTitle({
  children,
  className,
  level = "page",
}: {
  children: React.ReactNode;
  className?: string;
  level?: "page" | "section";
}) {
  return (
    <Text
      accessibilityRole="header"
      className={twMerge(
        "text-left font-semibold text-main-text",
        level === "page" ? "text-2xl" : "text-lg",
        className,
      )}
    >
      {children}
    </Text>
  );
}
