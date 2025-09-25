// import { View } from "react-native";
// import Modal from "react-native-modal";
import { twMerge } from "tailwind-merge";

import { Modal, Platform, View } from "react-native";

export default function CustomModal({
  children,
  isVisible,
  handleClose,
  className,
}: {
  children: React.ReactNode;
  isVisible: boolean;
  handleClose: () => void;
  className?: string;
}) {
  return (
    <Modal
      visible={isVisible}
      // onBackdropPress={handleClose}
      // isVisible={isVisible}
      onRequestClose={handleClose}
      backdropColor={Platform.OS !== "ios" ? "rgba(0, 0, 0, 0.3)" : undefined}
      statusBarTranslucent
    >
      <View
        className={twMerge(`flex-1 items-center justify-center p-4`, className)}
      >
        {children}
      </View>
    </Modal>
  );
}
