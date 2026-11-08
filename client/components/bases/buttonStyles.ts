export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
export type ButtonSize = "md" | "sm";

/**
 * Class strings per variant. Kept in one table so hover/pressed states cannot drift apart:
 * `hover:` only fires on web, `active:` is the pressed state on both platforms.
 */
export const VARIANT_CONTAINER: Record<ButtonVariant, string> = {
  primary: "bg-accent hover:bg-accent/90 active:opacity-80",
  secondary: "bg-white border border-stroke hover:bg-background active:opacity-80",
  ghost: "bg-transparent hover:bg-background active:opacity-80",
  danger: "bg-alert hover:bg-alert/90 active:opacity-80",
  dangerGhost: "bg-transparent hover:bg-alert/10 active:opacity-80",
};

export const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-main-text",
  ghost: "text-main-text",
  danger: "text-white",
  dangerGhost: "text-alert",
};

export const SIZE_CONTAINER: Record<ButtonSize, string> = {
  md: "min-h-[44px] px-4",
  sm: "min-h-[36px] px-3",
};

export const SIZE_TEXT: Record<ButtonSize, string> = {
  md: "text-base",
  sm: "text-sm",
};
