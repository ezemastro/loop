jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import { DEFAULT_COLORS } from "../config";
import {
  contrastRatio,
  darkenToContrast,
  deriveAccessibleColors,
  hexToChannels,
} from "../services/color";
import { resolveThemeColors } from "../stores/theme";

// Literal brand hex is allowed in this file only (see the exemption in brand-palette.test.ts):
// the demo community's palette is the realistic "arbitrary community colours" input.
const DEMO_GREEN = "#4C9F38";
const DEMO_GREY = "#9E9E9E";
const DEMO_BACKGROUND = "#F0F0F0";
const DEMO_RED = "#FF3B30";
const YELLOW = "#FFEB3B";
const NAVY = "#243B7A";
const WHITE = "#FFFFFF";

describe("contrastRatio", () => {
  it("is 21 for black on white, and symmetric", () => {
    expect(contrastRatio("#000000", WHITE)).toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, "#000000")).toBeCloseTo(21, 5);
  });

  it("is 1 for identical colours", () => {
    expect(contrastRatio(DEMO_GREEN, DEMO_GREEN)).toBeCloseTo(1, 5);
  });
});

describe("darkenToContrast", () => {
  it.each([
    ["demo green as a fill behind white text", DEMO_GREEN, WHITE],
    ["secondary text on the page background", DEMO_GREY, DEMO_BACKGROUND],
    ["demo red as a fill behind white text", DEMO_RED, WHITE],
    ["yellow as a fill behind white text", YELLOW, WHITE],
  ])("reaches 4.5:1 for %s", (_label, hex, against) => {
    expect(contrastRatio(hex, against)).toBeLessThan(4.5);
    const result = darkenToContrast(hex, against, 4.5);
    expect(contrastRatio(result, against)).toBeGreaterThanOrEqual(4.5);
  });

  it("stops at the first passing step instead of overshooting", () => {
    const result = darkenToContrast(DEMO_GREY, DEMO_BACKGROUND, 4.5);
    const [r] = hexToChannels(result).split(" ").map(Number);
    // One step lighter (2% of the original channel) must still fail.
    const lighter = `#${Math.min(255, r + 4)
      .toString(16)
      .padStart(2, "0")
      .repeat(3)}`;
    expect(contrastRatio(lighter, DEMO_BACKGROUND)).toBeLessThan(4.5);
  });

  it("returns a colour that already passes unchanged", () => {
    expect(darkenToContrast(NAVY, WHITE, 4.5)).toBe(NAVY);
    expect(darkenToContrast(NAVY.toLowerCase(), WHITE, 4.5)).toBe(NAVY);
  });

  it("keeps the hue direction: a green stays greener than it is red or blue", () => {
    const [r, g, b] = hexToChannels(darkenToContrast(DEMO_GREEN, WHITE, 4.5))
      .split(" ")
      .map(Number);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("falls back to black when darkening cannot reach the target", () => {
    expect(darkenToContrast("#202020", "#101010", 4.5)).toBe("#000000");
  });

  it("returns an invalid hex untouched", () => {
    expect(darkenToContrast("nope", WHITE, 4.5)).toBe("nope");
  });
});

describe("deriveAccessibleColors", () => {
  const palette = {
    SECONDARY: DEMO_GREEN,
    SECONDARY_TEXT: DEMO_GREY,
    CREDITS_LIGHT: YELLOW,
    ALERT: DEMO_RED,
    BACKGROUND: DEMO_BACKGROUND,
  };
  const derived = deriveAccessibleColors(palette);

  it("makes every derived colour reach 4.5:1 against its surface", () => {
    expect(contrastRatio(WHITE, derived.ACCENT)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(derived.SECONDARY_TEXT, DEMO_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(derived.CREDITS_LIGHT, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(WHITE, derived.ALERT)).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves the default navy community colour unchanged", () => {
    expect(deriveAccessibleColors({ ...palette, SECONDARY: NAVY }).ACCENT).toBe(NAVY);
  });
});

describe("resolveThemeColors", () => {
  it("keeps the raw DEFAULT_COLORS values for the keys it does not derive", () => {
    const colors = resolveThemeColors(null);
    expect(colors.PRIMARY).toBe(DEFAULT_COLORS.PRIMARY);
    expect(colors.SECONDARY).toBe(DEFAULT_COLORS.SECONDARY);
    expect(colors.ACCENT).toBe(DEFAULT_COLORS.SECONDARY);
  });

  it("derives a readable secondary text for the default palette", () => {
    const { SECONDARY_TEXT, BACKGROUND } = resolveThemeColors(null);
    expect(SECONDARY_TEXT).not.toBe(DEFAULT_COLORS.SECONDARY_TEXT);
    expect(contrastRatio(SECONDARY_TEXT, BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });

  it("derives from a community's own colours without altering the community data", () => {
    const community = {
      theme: { colors: { secondary: DEMO_GREEN, alert: DEMO_RED } },
    } as unknown as Community;
    const colors = resolveThemeColors(community);
    expect(colors.SECONDARY).toBe(DEMO_GREEN);
    expect(colors.ACCENT).not.toBe(DEMO_GREEN);
    expect(contrastRatio(WHITE, colors.ACCENT)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(WHITE, colors.ALERT)).toBeGreaterThanOrEqual(4.5);
    expect(community.theme?.colors?.secondary).toBe(DEMO_GREEN);
  });
});
