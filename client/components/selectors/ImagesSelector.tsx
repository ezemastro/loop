import { View, Dimensions, Image, Text, Pressable } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import Carousel, { Pagination } from "react-native-reanimated-carousel";
import { useSharedValue } from "react-native-reanimated";
import { COLORS, MAX_LISTING_IMAGES } from "@/config";
import { CameraIcon, CrossIcon, GalleryIcon } from "../Icons";
import { twMerge } from "tailwind-merge";
import { getUrl } from "@/services/getUrl";
import CustomModal from "../bases/CustomModal";

const width = Dimensions.get("window").width;

export default function ImagesSelector({
  onChange,
  className,
  initialImages = [],
}: {
  onChange: (images: ({ uri: string; type: string } | Media)[]) => void;
  className?: string;
  initialImages?: Media[];
}) {
  const progress = useSharedValue(0);
  const [selectedImages, setSelectedImages] =
    useState<(ImagePicker.ImagePickerAsset | Media)[]>(initialImages);
  const allowAddMore = selectedImages.length < MAX_LISTING_IMAGES;

  const pickImages = async (type: "library" | "camera") => {
    let result: ImagePicker.ImagePickerResult;
    if (type === "library") {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: MAX_LISTING_IMAGES - selectedImages.length,
        orderedSelection: true,
      });
    } else if (type === "camera") {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: true,
      });
    } else return;

    if (!result.canceled) {
      if (result.assets.some((asset) => !asset.mimeType)) {
        // TODO - mostrar error
        console.log("Error: some assets have no mimeType");
        return;
      }
      const newImages = [
        ...selectedImages,
        ...result.assets.slice(0, MAX_LISTING_IMAGES - selectedImages.length),
      ];
      setSelectedImages(newImages);
      onChange(
        newImages.map((img) => ({
          uri: "uri" in img ? img.uri : "url" in img ? getUrl(img.url) : "",
          type: "mimeType" in img && img.mimeType ? img.mimeType : "",
          id: "id" in img ? img.id : undefined,
        })),
      );
    }
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <>
      <CustomModal
        isVisible={isModalOpen}
        handleClose={() => setIsModalOpen(false)}
      >
        <View className="bg-white rounded px-4 py-8 w-full m-4 gap-8">
          <Pressable
            className="absolute top-4 right-4"
            onPress={() => setIsModalOpen(false)}
          >
            <CrossIcon />
          </Pressable>
          <Text className="text-xl font-semibold text-center text-main-text mx-8">
            Selecciona una opción
          </Text>
          <View className="flex-row justify-evenly gap-6">
            <Pressable
              onPress={() => {
                pickImages("library");
                setIsModalOpen(false);
              }}
              className="items-center gap-2 max-w-32 bg-white border-stroke border px-3 py-2 rounded"
            >
              <GalleryIcon className="text-main-text" size={24} />
              <View className="flex-row flex-grow items-center">
                <Text className="text-main-text text-center">
                  Seleccionar de mi galería
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => {
                pickImages("camera");
                setIsModalOpen(false);
              }}
              className="items-center gap-2 max-w-32 bg-white border-stroke border px-3 py-2 rounded"
            >
              <CameraIcon className="text-main-text" size={24} />
              <View className="flex-row flex-grow items-center">
                <Text className="text-main-text text-center">Tomar foto</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </CustomModal>
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
                  onPress={() => setIsModalOpen(true)}
                >
                  <CameraIcon className="text-main-text" size={56} />
                  <Text className="mt-2 text-main-text">
                    Presiona para agregar imágenes
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Image
                    source={{
                      uri:
                        "uri" in item
                          ? item.uri
                          : "url" in item
                            ? getUrl(item.url)
                            : "",
                    }}
                    className="h-full w-full rounded"
                    style={{ resizeMode: "contain" }}
                  />
                  <Pressable
                    className="absolute top-4 right-6"
                    onPress={() => {
                      setSelectedImages((prev) =>
                        prev.filter((_, i) => i !== index),
                      );
                      onChange(
                        selectedImages
                          .filter((_, i) => i !== index)
                          .map((img) => ({
                            uri:
                              "uri" in img
                                ? img.uri
                                : "url" in img
                                  ? getUrl(img.url)
                                  : "",
                            type:
                              "mimeType" in img && img.mimeType
                                ? img.mimeType
                                : "",
                            id: "id" in img ? img.id : undefined,
                          })),
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
              allowAddMore
                ? [...selectedImages, { uri: "add" }]
                : selectedImages
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
    </>
  );
}
