const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

const expandShorthand = (hex: string) =>
  hex.length === 3 ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] : hex;

/**
 * Convierte "#RRGGBB" a los canales sueltos "R G B" que espera `rgb(var(--x) / <alpha-value>)`.
 * Sin esto las variantes con opacidad (`bg-primary/10`) generarían CSS inválido, porque
 * `rgb(#FF5900 / 0.1)` no existe.
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
