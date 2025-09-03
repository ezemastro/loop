import Modal from "react-native-modal";

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
      onBackdropPress={handleClose}
      isVisible={isVisible}
      className={`justify-center items-center ${className}`}
      statusBarTranslucent
    >
      {children}
    </Modal>
  );
}
