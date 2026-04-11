import {
  View,
  Dimensions,
  Image,
  Text,
  Pressable,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import Carousel, {
  ICarouselInstance,
  Pagination,
} from "react-native-reanimated-carousel";
import { useSharedValue } from "react-native-reanimated";
import {
  COLORS,
  IMAGE_FORMAT_ERROR_MESSAGE,
  MAX_LISTING_IMAGES,
} from "@/config";
import { CameraIcon, CrossIcon } from "../Icons";
import { twMerge } from "tailwind-merge";
import { getUrl } from "@/services/getUrl";
import ImageSourceSelectorModal from "../modals/ImageSourceSelectorModal";
import Error from "../Error";
import { useOptimizedImagePicker } from "@/hooks/useOptimizedImagePicker";

const width = Dimensions.get("window").width;

type SelectedImage = { uri: string; mimeType: string } | Media;

export default function ImagesSelector({
  onChange,
  className,
  initialImages = [],
}: {
  onChange: (images: ({ uri: string; type: string } | Media)[]) => void;
  className?: string;
  initialImages?: Media[];
}) {
  const DRAG_THRESHOLD_PX = 8;
  const isWeb = Platform.OS === "web";
  const progress = useSharedValue(0);
  const carouselRef = useRef<ICarouselInstance>(null);
  const addPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingAddRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(width);
  const [selectedImages, setSelectedImages] =
    useState<SelectedImage[]>(initialImages);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const allowAddMore = selectedImages.length < MAX_LISTING_IMAGES;
  const [cameraStatus, cameraRequestPermission] =
    ImagePicker.useCameraPermissions();
  const [mediaLibraryStatus, mediaLibraryRequestPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const {
    inferMimeTypeFromUri,
    isAllowedMimeType,
    pickWebImages,
    optimizeImage,
  } = useOptimizedImagePicker();

  const toUploadPayload = (images: SelectedImage[]) =>
    images.map((img) => ({
      uri: "uri" in img ? img.uri : "url" in img ? getUrl(img.url) : "",
      type: "mimeType" in img && img.mimeType ? img.mimeType : "",
      id: "id" in img ? img.id : undefined,
    }));

  const pickImages = async (type: "library" | "camera") => {
    setUploadError(null);
    let result: ImagePicker.ImagePickerResult | null = null;
    let pickedAssets: {
      uri: string;
      mimeType: string;
      width: number;
      height: number;
    }[] = [];

    if (type === "library") {
      if (isWeb) {
        const { assets, invalidCount } = await pickWebImages(
          MAX_LISTING_IMAGES - selectedImages.length,
        );
        pickedAssets = assets;
        if (invalidCount > 0) {
          setUploadError(IMAGE_FORMAT_ERROR_MESSAGE);
        }
      } else {
        if (
          mediaLibraryStatus?.status !== ImagePicker.PermissionStatus.GRANTED
        ) {
          const permission = await mediaLibraryRequestPermission();
          if (!permission.granted) {
            // TODO - mostrar error
            console.log("Permission to access media library was denied");
            return;
          }
        }
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          quality: 1,
          selectionLimit: MAX_LISTING_IMAGES - selectedImages.length,
          orderedSelection: true,
        });
      }
    } else if (type === "camera") {
      if (cameraStatus?.status !== ImagePicker.PermissionStatus.GRANTED) {
        const permission = await cameraRequestPermission();
        if (!permission.granted) {
          // TODO - mostrar error
          console.log("Permission to access camera was denied");
          return;
        }
      }
      await ImagePicker.requestCameraPermissionsAsync();
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: true,
      });
    } else return;

    if (!isWeb && result && !result.canceled) {
      const selected = result.assets.slice(
        0,
        MAX_LISTING_IMAGES - selectedImages.length,
      );

      pickedAssets = selected
        .map((asset) => {
          const mimeType = asset.mimeType || inferMimeTypeFromUri(asset.uri);
          return {
            uri: asset.uri,
            mimeType,
            width: asset.width,
            height: asset.height,
          };
        })
        .filter((asset) => isAllowedMimeType(asset.mimeType));

      if (pickedAssets.length !== selected.length) {
        setUploadError(IMAGE_FORMAT_ERROR_MESSAGE);
      }
    }

    if (pickedAssets.length > 0) {
      const optimizedAssets = await Promise.all(
        pickedAssets.map((asset) => optimizeImage(asset)),
      );

      const newImages = [...selectedImages, ...optimizedAssets];
      setSelectedImages(newImages);
      onChange(toUploadPayload(newImages));
    }
  };
  const onPressPagination = (index: number) => {
    carouselRef.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <>
      {!isWeb && (
        <ImageSourceSelectorModal
          isModalOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          pickImages={pickImages}
          isCameraPermissionDenied={
            cameraStatus?.status === ImagePicker.PermissionStatus.DENIED
          }
          isGalleryPermissionDenied={
            mediaLibraryStatus?.status === ImagePicker.PermissionStatus.DENIED
          }
        />
      )}
      <View
        className={twMerge("w-full gap-4", className)}
        onLayout={({ nativeEvent }) => {
          const nextWidth = nativeEvent.layout.width;
          if (nextWidth > 0 && nextWidth !== containerWidth) {
            setContainerWidth(nextWidth);
          }
        }}
      >
        <Carousel
          ref={carouselRef}
          data={
            allowAddMore ? [...selectedImages, { uri: "add" }] : selectedImages
          }
          width={containerWidth}
          height={240}
          onProgressChange={progress}
          autoPlayInterval={3000}
          enabled={selectedImages.length > 0}
          renderItem={({ item, index }) => (
            <View
              style={{ height: "100%", width: "100%", paddingHorizontal: 16 }}
            >
              {allowAddMore && index === selectedImages.length ? (
                <Pressable
                  className="h-full w-full items-center justify-center rounded bg-secondary-text/20"
                  onPressIn={(event) => {
                    addPressStartRef.current = {
                      x: event.nativeEvent.pageX,
                      y: event.nativeEvent.pageY,
                    };
                    isDraggingAddRef.current = false;
                  }}
                  onPressOut={(event) => {
                    if (!addPressStartRef.current) return;
                    const deltaX = Math.abs(
                      event.nativeEvent.pageX - addPressStartRef.current.x,
                    );
                    const deltaY = Math.abs(
                      event.nativeEvent.pageY - addPressStartRef.current.y,
                    );
                    isDraggingAddRef.current =
                      deltaX > DRAG_THRESHOLD_PX || deltaY > DRAG_THRESHOLD_PX;
                  }}
                  onPress={() => {
                    if (isDraggingAddRef.current) {
                      isDraggingAddRef.current = false;
                      return;
                    }
                    if (isWeb) {
                      pickImages("library");
                      return;
                    }
                    setIsModalOpen(true);
                  }}
                >
                  <CameraIcon className="text-main-text" size={56} />
                  <Text className="mt-2 text-main-text">
                    Presiona para agregar imágenes
                  </Text>
                  <Text className="mt-1 text-xs text-secondary-text">
                    Formatos: JPG, PNG, WEBP o AVIF
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
                    className="rounded"
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                  <Pressable
                    className="absolute top-4 right-6"
                    onPress={() => {
                      setSelectedImages((prev) => {
                        const nextImages = prev.filter((_, i) => i !== index);
                        onChange(toUploadPayload(nextImages));
                        return nextImages;
                      });
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
            onPress={onPressPagination}
          />
        )}
        {uploadError && (
          <Error textClassName="text-sm text-alert">{uploadError}</Error>
        )}
      </View>
    </>
  );
}
