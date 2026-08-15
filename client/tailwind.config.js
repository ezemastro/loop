/** @type {import('tailwindcss').Config} */
export const content = ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"];
export const presets = [require("nativewind/preset")];
// Los colores son variables CSS y no hex literales para que el ThemeProvider pueda repintarlos por
// comunidad en runtime: NativeWind compila las clases estáticamente, así que el único punto de
// variación posible es el valor de la variable. `<alpha-value>` es lo que mantiene vivas las
// variantes con opacidad (`bg-primary/10`), y por eso las variables guardan canales RGB sueltos
// ("255 89 0") y no hex: `rgb(#FF5900 / 0.1)` no es CSS válido. Defaults en `global.css`.
export const theme = {
  extend: {
    colors: {
      primary: "rgb(var(--color-primary) / <alpha-value>)",
      secondary: "rgb(var(--color-secondary) / <alpha-value>)",
      tertiary: "rgb(var(--color-tertiary) / <alpha-value>)",
      "main-text": "rgb(var(--color-main-text) / <alpha-value>)",
      "secondary-text": "rgb(var(--color-secondary-text) / <alpha-value>)",
      credits: "rgb(var(--color-credits) / <alpha-value>)",
      "credits-light": "rgb(var(--color-credits-light) / <alpha-value>)",
      stroke: "rgb(var(--color-stroke) / <alpha-value>)",
      background: "rgb(var(--color-background) / <alpha-value>)",
      alert: "rgb(var(--color-alert) / <alpha-value>)",
    },
  },
};
export const plugins = [];
