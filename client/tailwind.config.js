/** @type {import('tailwindcss').Config} */
import { COLORS } from "./config";
export const content = [
  "./app/**/*.{js,jsx,ts,tsx}",
  "./components/**/*.{js,jsx,ts,tsx}",
];
export const presets = [require("nativewind/preset")];
export const theme = {
  extend: {
    colors: {
      primary: COLORS.PRIMARY,
      secondary: COLORS.SECONDARY,
      tertiary: COLORS.TERTIARY,
      "main-text": COLORS.MAIN_TEXT,
      "secondary-text": COLORS.SECONDARY_TEXT,
      credits: COLORS.CREDITS,
      stroke: COLORS.STROKE,
      background: COLORS.BACKGROUND,
    },
  },
};
export const plugins = [];
