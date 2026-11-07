const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

const expandShorthand = (hex: string) =>
  hex.length === 3 ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] : hex;

/**
 * Convierte "#RRGGBB" a los canales sueltos "R G B" que espera `rgb(var(--x) / <alpha-value>)`.
 * Sin esto las variantes con opacidad (`bg-primary/10`) generarían CSS inválido, porque
 * `rgb(#000000 / 0.1)` no existe.
 *
 * Es tolerante a propósito: el tema llega del servidor y una comunidad mal cargada no puede
 * dejar la app sin colores, así que un hex inválido cae al fallback en vez de romper.
 */
export const hexToChannels = (hex: string, fallbackHex = "#000000"): string => {
  const match = typeof hex === "string" ? hex.trim().match(HEX_RE) : null;
  if (!match) {
    // Evitar recursión infinita si el fallback también es inválido.
    return fallbackHex === hex ? "0 0 0" : hexToChannels(fallbackHex);
  }
  const value = expandShorthand(match[1]);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
};

/** `true` si el string es un hex de 3 o 6 dígitos, con o sin `#`. */
export const isValidHex = (hex: unknown): hex is string =>
  typeof hex === "string" && HEX_RE.test(hex.trim());

const parseRgb = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToChannels(hex).split(" ").map(Number);
  return [r, g, b];
};

const toHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** WCAG 2.x relative luminance of a hex colour. */
export const relativeLuminance = (hex: string): number => {
  const [r, g, b] = parseRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.x contrast ratio between two hex colours, from 1 (identical) to 21 (black on white). */
export const contrastRatio = (hexA: string, hexB: string): number => {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** Share of black mixed in per attempt. Small enough to keep the hue and avoid overshooting. */
const DARKEN_STEP = 0.02;

/**
 * Darkens `hex` in small steps (mixing it toward black, which keeps its hue) until its contrast
 * against `againstHex` reaches `target`. A colour that already passes comes back unchanged (as an
 * upper-case `#RRGGBB`). Community palettes are arbitrary, so this is what lets any of them back
 * text or a filled control with a guaranteed ratio. If even black cannot reach the target (a dark
 * `againstHex`), black is returned: darkening is the only direction this function moves.
 *
 * An invalid hex is returned as is, matching the tolerant stance of `hexToChannels`.
 */
export const darkenToContrast = (hex: string, againstHex: string, target: number): string => {
  if (!isValidHex(hex)) return hex;
  const base = parseRgb(hex);
  for (let step = 0; step * DARKEN_STEP < 1; step++) {
    const keep = 1 - step * DARKEN_STEP;
    const candidate = toHex(base.map((c) => Math.round(c * keep)) as [number, number, number]);
    if (contrastRatio(candidate, againstHex) >= target) return candidate;
  }
  return "#000000";
};

/** WCAG AA for normal-size text. */
export const AA_NORMAL_TEXT = 4.5;

/** The colours a palette needs derived so that any community palette stays readable. */
export interface AccessibleColors {
  /** Community colour darkened until white text on it reaches AA. Fills and focus rings. */
  ACCENT: string;
  /** Secondary text darkened until it reaches AA on the page background. */
  SECONDARY_TEXT: string;
  /** Credit amounts, darkened until AA on white. */
  CREDITS_LIGHT: string;
  /** Alert colour darkened until white text on it reaches AA. */
  ALERT: string;
}

export const deriveAccessibleColors = (palette: {
  SECONDARY: string;
  SECONDARY_TEXT: string;
  CREDITS_LIGHT: string;
  ALERT: string;
  BACKGROUND: string;
}): AccessibleColors => ({
  ACCENT: darkenToContrast(palette.SECONDARY, "#FFFFFF", AA_NORMAL_TEXT),
  SECONDARY_TEXT: darkenToContrast(palette.SECONDARY_TEXT, palette.BACKGROUND, AA_NORMAL_TEXT),
  CREDITS_LIGHT: darkenToContrast(palette.CREDITS_LIGHT, "#FFFFFF", AA_NORMAL_TEXT),
  ALERT: darkenToContrast(palette.ALERT, "#FFFFFF", AA_NORMAL_TEXT),
});
