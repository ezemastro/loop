/** @type {import('tailwindcss').Config} */
export const content = [
  "./app/**/*.{js,jsx,ts,tsx}",
  "./components/**/*.{js,jsx,ts,tsx}",
];
export const presets = [require("nativewind/preset")];
export const theme = {
  extend: {
    colors: {
      primary: "#FF5900",
      secondary: "#4C9F38",
      tertiary: "#009E7C",
      "main-text": "#424242",
      "secondary-text": "#9E9E9E",
      credits: "#FFA826",
      stroke: "#E4E4E4",
      background: "#F0F0F0",
    },
  },
};
export const plugins = [];
