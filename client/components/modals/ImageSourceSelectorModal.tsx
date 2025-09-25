import { View, Text, Pressable } from "react-native";
import React from "react";
import CustomModal from "../bases/CustomModal";
import { CameraIcon, CrossIcon, GalleryIcon } from "../Icons";

export default function ImageSourceSelectorModal({
  isModalOpen,
  onClose,
  pickImages,
  isCameraPermissionDenied,
  isGalleryPermissionDenied,
}: {
  isModalOpen: boolean;
  onClose: () => void;
  pickImages: (type: "library" | "camera") => void;
  isCameraPermissionDenied: boolean;
  isGalleryPermissionDenied: boolean;
}) {
  return (
    <CustomModal isVisible={isModalOpen} handleClose={onClose}>
      <View className="bg-white rounded px-4 py-8 w-full m-4 gap-8">
        <Pressable className="absolute top-4 right-4" onPress={onClose}>
          <CrossIcon />
        </Pressable>
        <Text className="text-xl font-semibold text-center text-main-text mx-8">
          Selecciona una opción
        </Text>
        <View className="flex-row justify-evenly gap-6">
          <Pressable
            onPress={() => {
              pickImages("library");
              onClose();
            }}
            className="items-center gap-2 max-w-32 bg-white border-stroke border px-3 py-2 rounded"
          >
            <GalleryIcon className="text-main-text" size={24} />
            <View className="flex-row flex-grow items-center">
              <Text className="text-main-text text-center">
                Seleccionar de mi galería
              </Text>
            </View>
            <Text
              className={
                "text-secondary-text text-center " +
                (!isGalleryPermissionDenied ? "hidden" : "")
              }
            >
              Permiso denegado
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              pickImages("camera");
              onClose();
            }}
            className="items-center gap-2 max-w-32 bg-white border-stroke border px-3 py-2 rounded"
          >
            <CameraIcon className="text-main-text" size={24} />
            <View className="flex-row flex-grow items-center">
              <Text className="text-main-text text-center">Tomar foto</Text>
            </View>
            <Text
              className={
                "text-secondary-text text-center " +
                (!isCameraPermissionDenied ? "hidden" : "")
              }
            >
              Permiso denegado
            </Text>
          </Pressable>
        </View>
      </View>
    </CustomModal>
  );
}
