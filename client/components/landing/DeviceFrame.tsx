import type { ReactNode } from "react";
import type { ImageSourcePropType } from "react-native";
import { Image, View } from "react-native";

/**
 * Hardware frames around REAL content (an `assets/landing/*.webp` capture or the live `/demo`
 * iframe), never a hand-built fake UI. Sizes come in as Tailwind width classes so each caller can
 * size them per breakpoint without measuring.
 */

/** Phone screen aspect: the captures and the `/demo` iframe are both 390x844 CSS px. */
export const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

type PhoneProps = {
  /** Width classes for the SCREEN (the bezel adds 8px per side), e.g. `w-[220px] lg:w-[240px]`. */
  screenClassName: string;
  children: ReactNode;
  className?: string;
};

export function PhoneShell({ screenClassName, children, className = "" }: PhoneProps) {
  return (
    <View className={`rounded-[2.75rem] bg-main-text p-2 ${className}`}>
      <View
        className={`relative aspect-[390/844] overflow-hidden rounded-[2.25rem] bg-white ${screenClassName}`}
      >
        {children}
      </View>
    </View>
  );
}

type ScreenImageProps = {
  source: ImageSourcePropType;
  alt: string;
  className?: string;
};

/** A capture that fills its device screen edge to edge. */
export function ScreenImage({ source, alt, className = "" }: ScreenImageProps) {
  return (
    <Image
      source={source}
      accessibilityLabel={alt}
      resizeMode="cover"
      className={`absolute inset-0 ${className}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

type LaptopProps = {
  source: ImageSourcePropType;
  alt: string;
  /** Width classes for the whole laptop, e.g. `w-[360px] xl:w-[440px]`. */
  className: string;
};

/** Lid with a dark bezel around a 16:10 desktop capture, plus a wider aluminium base. */
export function LaptopShell({ source, alt, className }: LaptopProps) {
  return (
    <View className={className}>
      <View className="rounded-t-[1.1rem] bg-main-text px-[3%] pb-[4%] pt-[3%]">
        <View className="relative aspect-[16/10] w-full overflow-hidden rounded-[3px] bg-white">
          <ScreenImage source={source} alt={alt} />
        </View>
      </View>
      <View className="relative -mx-[7%] h-3.5 rounded-b-2xl bg-stroke">
        <View className="absolute left-[42%] top-0 h-1.5 w-[16%] rounded-b-lg bg-secondary-text/50" />
      </View>
    </View>
  );
}
