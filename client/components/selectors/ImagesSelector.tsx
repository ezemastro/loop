import { View, Dimensions, Image, Text, Pressable } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import Carousel, { Pagination } from "react-native-reanimated-carousel";
import { useSharedValue } from "react-native-reanimated";
import { COLORS, MAX_LISTING_IMAGES } from "@/config";
import { CameraIcon, CrossIcon } from "../Icons";
import { twMerge } from "tailwind-merge";

const width = Dimensions.get("window").width;

export default function ImagesSelector({
  onChange,
  className,
}: {
  onChange: (images: { uri: string; type: string }[]) => void;
  className?: string;
}) {
  const progress = useSharedValue(0);
  const [selectedImages, setSelectedImages] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const allowAddMore = selectedImages.length < MAX_LISTING_IMAGES;
  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: MAX_LISTING_IMAGES - selectedImages.length,
      orderedSelection: true,
    });
    if (!result.canceled) {
      if (result.assets.some((asset) => !asset.mimeType)) {
        // TODO - mostrar error
        console.log("Error: some assets have no mimeType");
        return;
      }
      setSelectedImages((prev) => [
        ...prev,
        ...result.assets.slice(0, MAX_LISTING_IMAGES - prev.length),
      ]);
      onChange(
        result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.mimeType!,
        })),
      );
    }
  };
  return (
    <View className={twMerge("w-full gap-4", className)}>
      <Carousel
        data={
          allowAddMore ? [...selectedImages, { uri: "add" }] : selectedImages
        }
        width={width}
        height={240}
        onProgressChange={progress}
        autoPlayInterval={3000}
        enabled={selectedImages.length > 0}
        renderItem={({ item, index }) => (
          <View className="h-full w-full px-4">
            {allowAddMore && index === selectedImages.length ? (
              <Pressable
                className="h-full w-full items-center justify-center rounded bg-secondary-text/20"
                onPress={pickImages}
              >
                <CameraIcon className="text-main-text" size={56} />
                <Text className="mt-2 text-main-text">
                  Presiona para agregar imágenes
                </Text>
              </Pressable>
            ) : (
              <>
                <Image
                  source={{ uri: item.uri }}
                  className="h-full w-full rounded"
                  style={{ resizeMode: "contain" }}
                />
                <Pressable
                  className="absolute top-4 right-6"
                  onPress={() => {
                    setSelectedImages((prev) =>
                      prev.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <CrossIcon className="text-main-text" size={24} />
                </Pressable>
              </>
            )}
          </View>
        )}
      />
      {selectedImages.length > 0 && (
        <Pagination.Basic
          data={
            allowAddMore ? [...selectedImages, { uri: "add" }] : selectedImages
          }
          progress={progress}
          containerStyle={{ justifyContent: "center", gap: 8 }}
          dotStyle={{
            width: 8,
            height: 8,
            backgroundColor: COLORS.STROKE,
            borderRadius: 4,
          }}
          activeDotStyle={{
            borderRadius: 4,
            backgroundColor: COLORS.SECONDARY_TEXT,
          }}
        />
      )}
    </View>
  );
}
