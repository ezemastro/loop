import { FILE_BASE_URL } from "@/config";

export const getUrl = (path: string) => {
  return `${FILE_BASE_URL}${path}`;
};
