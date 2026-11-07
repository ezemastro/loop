import { View, Text, Pressable } from "react-native";
import React from "react";
import CustomModal from "../bases/CustomModal";
import { CameraIcon, GalleryIcon } from "../Icons";
import ModalHeader, { modalSurfaceClassName } from "../bases/ModalHeader";

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
      <View className={modalSurfaceClassName()}>
        <ModalHeader title="Elegí una opción" onClose={onClose} />
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => {
              pickImages("library");
              onClose();
            }}
            accessibilityRole="button"
            className="flex-1 items-center gap-2 rounded-lg border border-stroke bg-white px-3 py-3 hover:bg-background active:opacity-80"
          >
            <GalleryIcon className="text-main-text" size={24} />
            <View className="flex-row flex-grow items-center">
              <Text className="text-main-text text-center">Seleccionar de mi galería</Text>
            </View>
            <Text
              className={
                "text-secondary-text text-center " + (!isGalleryPermissionDenied ? "hidden" : "")
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
            accessibilityRole="button"
            className="flex-1 items-center gap-2 rounded-lg border border-stroke bg-white px-3 py-3 hover:bg-background active:opacity-80"
          >
            <CameraIcon className="text-main-text" size={24} />
            <View className="flex-row flex-grow items-center">
              <Text className="text-main-text text-center">Tomar foto</Text>
            </View>
            <Text
              className={
                "text-secondary-text text-center " + (!isCameraPermissionDenied ? "hidden" : "")
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
