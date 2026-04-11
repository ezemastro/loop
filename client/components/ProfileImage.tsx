import { View, Pressable, Image, Platform } from "react-native";
import { useState } from "react";
import { getProfileImageSource, getUrl } from "@/services/getUrl";
import { CameraIcon, EditIcon } from "./Icons";
import ImageSourceSelectorModal from "./modals/ImageSourceSelectorModal";
import * as ImagePicker from "expo-image-picker";
import { useModifySelf } from "@/hooks/useModifySelf";
import { useUploadFiles } from "@/hooks/useUploadFiles";
import { useQueryClient } from "@tanstack/react-query";
import Error from "./Error";
import { IMAGE_FORMAT_ERROR_MESSAGE } from "@/config";
import { useOptimizedImagePicker } from "@/hooks/useOptimizedImagePicker";

export default function ProfileImage({
  user,
  isCurrentUser,
}: {
  user: PublicUser | PrivateUser;
  isCurrentUser: boolean;
}) {
  const isWeb = Platform.OS === "web";
  const hasImage = !!user.profileMedia;
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { mutate: modifyUser } = useModifySelf();
  const { mutate: uploadImages } = useUploadFiles();

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

  const handleSelectImage = async (type: "library" | "camera") => {
    if (!isCurrentUser) return;
    setUploadError(null);
    let result: ImagePicker.ImagePickerResult | null = null;
    let pickedAsset: {
      uri: string;
      mimeType: string;
      width: number;
      height: number;
    } | null = null;

    if (type === "library") {
      if (isWeb) {
        const { assets, invalidCount } = await pickWebImages(1, false);
        if (invalidCount > 0) {
          setUploadError(IMAGE_FORMAT_ERROR_MESSAGE);
        }
        pickedAsset = assets[0] || null;
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
          allowsMultipleSelection: false,
          aspect: [1, 1],
          allowsEditing: true,
          quality: 1,
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
        aspect: [1, 1],
      });
    } else return;

    if (!isWeb && result && !result.canceled) {
      const image = result.assets[0];
      if (!image) {
        return;
      }

      const mimeType = image.mimeType || inferMimeTypeFromUri(image.uri);
      if (!isAllowedMimeType(mimeType)) {
        setUploadError(IMAGE_FORMAT_ERROR_MESSAGE);
        return;
      }

      pickedAsset = {
        uri: image.uri,
        mimeType,
        width: image.width,
        height: image.height,
      };
    }

    if (!pickedAsset) {
      return;
    }

    const optimizedImage = await optimizeImage(pickedAsset);
    uploadImages([{ uri: optimizedImage.uri, type: optimizedImage.mimeType }], {
      onSuccess: (uploaded) => {
        const uploadedImage = uploaded[0]?.media;
        if (!uploadedImage) return;
        modifyUser(
          { profileMediaId: uploadedImage.id },
          {
            onSettled: () => {
              queryClient.invalidateQueries({ queryKey: ["self"] });
            },
          },
        );
      },
    });
  };
  return (
    <>
      <Pressable
        className="relative"
        onPress={() => {
          if (!isCurrentUser) return;
          if (isWeb) {
            handleSelectImage("library");
            return;
          }
          setIsModalOpen(true);
        }}
      >
        {hasImage ? (
          <Image
            source={{ uri: getUrl(user.profileMedia!.url) }}
            className="rounded-full"
            style={{ width: 128, height: 128 }}
          />
        ) : isCurrentUser ? (
          <View className="size-32 items-center justify-center rounded-full bg-stroke">
            <CameraIcon className="text-primary-text" size={32} />
          </View>
        ) : (
          <Image
            source={getProfileImageSource(null)}
            className="rounded-full"
            style={{ width: 128, height: 128 }}
          />
        )}
        {isCurrentUser && (
          <View className="absolute -top-2 -right-6 p-2">
            <EditIcon className="text-tertiary" size={32} />
          </View>
        )}
      </Pressable>
      {!isWeb && (
        <ImageSourceSelectorModal
          isModalOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          pickImages={handleSelectImage}
          isCameraPermissionDenied={
            cameraStatus?.status === ImagePicker.PermissionStatus.DENIED
          }
          isGalleryPermissionDenied={
            mediaLibraryStatus?.status === ImagePicker.PermissionStatus.DENIED
          }
        />
      )}
      {uploadError && (
        <Error textClassName="text-sm text-alert">{uploadError}</Error>
      )}
    </>
  );
}
