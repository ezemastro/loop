import { View, Pressable, Image } from "react-native";
import { useState } from "react";
import { getUrl } from "@/services/getUrl";
import { CameraIcon, EditIcon } from "./Icons";
import ImageSourceSelectorModal from "./modals/ImageSourceSelectorModal";
import * as ImagePicker from "expo-image-picker";
import { useModifySelf } from "@/hooks/useModifySelf";
import { useUploadFiles } from "@/hooks/useUploadFiles";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfileImage({
  user,
  isCurrentUser,
}: {
  user: PublicUser | PrivateUser;
  isCurrentUser: boolean;
}) {
  const hasImage = !!user.profileMedia;
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { mutate: modifyUser } = useModifySelf();
  const { mutate: uploadImages } = useUploadFiles();

  const [cameraStatus, cameraRequestPermission] =
    ImagePicker.useCameraPermissions();
  const [mediaLibraryStatus, mediaLibraryRequestPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const handleSelectImage = async (type: "library" | "camera") => {
    if (!isCurrentUser) return;
    let result: ImagePicker.ImagePickerResult;
    if (type === "library") {
      if (mediaLibraryStatus?.status !== ImagePicker.PermissionStatus.GRANTED) {
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

    if (!result.canceled) {
      if (result.assets.some((asset) => !asset.mimeType)) {
        // TODO - mostrar error
        console.log("Error: some assets have no mimeType");
        return;
      }
      const image = result.assets[0];
      uploadImages([{ uri: image.uri, type: image.mimeType! }], {
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
    }
  };
  return (
    <>
      <Pressable
        className="relative"
        onPress={() => isCurrentUser && setIsModalOpen(true)}
      >
        {hasImage ? (
          <Image
            source={{ uri: getUrl(user.profileMedia!.url) }}
            className="size-32 rounded-full"
          />
        ) : (
          <View className="size-32 items-center justify-center rounded-full bg-stroke">
            <CameraIcon
              className={
                isCurrentUser ? "text-primary-text" : "text-secondary-text"
              }
              size={32}
            />
          </View>
        )}
        {isCurrentUser && (
          <View className="absolute -top-2 -right-6 p-2">
            <EditIcon className="text-tertiary" size={32} />
          </View>
        )}
      </Pressable>
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
    </>
  );
}
