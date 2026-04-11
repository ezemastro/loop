import { Image } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_COMPRESS_QUALITY,
  MAX_IMAGE_SIDE_PX,
  WEB_IMAGE_ACCEPT_ATTR,
} from "@/config";

export type OptimizedImage = {
  uri: string;
  mimeType: string;
};

export type PickedImageAsset = {
  uri: string;
  mimeType: string;
  width: number;
  height: number;
};

export const useOptimizedImagePicker = () => {
  const inferMimeTypeFromUri = (uri: string) => {
    const normalized = uri.toLowerCase();
    if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    if (normalized.endsWith(".png")) {
      return "image/png";
    }
    if (normalized.endsWith(".webp")) {
      return "image/webp";
    }
    if (normalized.endsWith(".avif")) {
      return "image/avif";
    }
    return "";
  };

  const isAllowedMimeType = (mimeType: string) =>
    ALLOWED_IMAGE_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
    );

  const getImageSize = (
    uri: string,
  ): Promise<{ width: number; height: number }> =>
    new Promise((resolve) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve({ width: MAX_IMAGE_SIDE_PX, height: MAX_IMAGE_SIDE_PX }),
      );
    });

  const pickWebImages = async (
    limit: number,
    multiple = true,
  ): Promise<{ assets: PickedImageAsset[]; invalidCount: number }> => {
    if (typeof document === "undefined") {
      return { assets: [], invalidCount: 0 };
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = WEB_IMAGE_ACCEPT_ATTR;
    input.multiple = multiple && limit > 1;

    const files = await new Promise<File[]>((resolve) => {
      input.onchange = () => resolve(Array.from(input.files || []));
      input.click();
    });

    const selected = files.slice(0, limit);
    const validFiles = selected.filter((file) => isAllowedMimeType(file.type));
    const invalidCount = selected.length - validFiles.length;

    const assets = await Promise.all(
      validFiles.map(async (file): Promise<PickedImageAsset> => {
        const uri = URL.createObjectURL(file);
        const { width, height } = await getImageSize(uri);
        return {
          uri,
          mimeType: file.type,
          width,
          height,
        };
      }),
    );

    return { assets, invalidCount };
  };

  const optimizeImage = async (
    asset: PickedImageAsset,
  ): Promise<OptimizedImage> => {
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width > 0 && asset.height > 0) {
        context.resize(
          asset.width >= asset.height
            ? {
                width: Math.min(asset.width, MAX_IMAGE_SIDE_PX),
              }
            : {
                height: Math.min(asset.height, MAX_IMAGE_SIDE_PX),
              },
        );
      }

      const renderedImage = await context.renderAsync();
      const optimized = await renderedImage.saveAsync({
        compress: IMAGE_COMPRESS_QUALITY,
        format: SaveFormat.JPEG,
      });

      return {
        uri: optimized.uri,
        mimeType: "image/jpeg",
      };
    } catch {
      return {
        uri: asset.uri,
        mimeType: asset.mimeType || "image/jpeg",
      };
    }
  };

  return {
    inferMimeTypeFromUri,
    isAllowedMimeType,
    pickWebImages,
    optimizeImage,
  };
};
