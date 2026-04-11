import { FILE_BASE_URL } from "@/config";
import { ImageSourcePropType } from "react-native";

const DEFAULT_PROFILE_IMAGE = require("@/assets/images/default-profile.png");

export const getUrl = (path: string) => {
  return `${FILE_BASE_URL}${path}`;
};

export const getProfileImageSource = (
  path?: string | null,
): ImageSourcePropType => {
  if (!path?.trim()) return DEFAULT_PROFILE_IMAGE;
  return { uri: getUrl(path) };
};
