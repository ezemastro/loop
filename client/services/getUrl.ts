import { FILE_BASE_URL } from "@/config";
import { ImageSourcePropType } from "react-native";

const DEFAULT_PROFILE_IMAGE = require("@/assets/images/default-profile.png");

export const getUrl = (path: string) => {
  // Las URLs absolutas (ej. las imágenes del modo demo) se usan tal cual; el prefijo solo aplica
  // a rutas relativas servidas por la API.
  if (/^https?:\/\//i.test(path)) return path;
  return `${FILE_BASE_URL}${path}`;
};

export const getProfileImageSource = (path?: string | null): ImageSourcePropType => {
  if (!path?.trim()) return DEFAULT_PROFILE_IMAGE;
  return { uri: getUrl(path) };
};
