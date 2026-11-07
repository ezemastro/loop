// import { View } from "react-native";
// import Modal from "react-native-modal";
import { twMerge } from "tailwind-merge";

import { useMemo } from "react";
import { Modal, View, useWindowDimensions } from "react-native";

export default function CustomModal({
  children,
  isVisible,
  handleClose,
  className,
}: {
  /**
   * Either a plain node, or a render function receiving `maxHeight` (px) — the space content can
   * safely occupy before it must scroll internally instead of growing past the viewport.
   *
   * The shell owns this height cap instead of every modal hand-rolling a percentage (e.g.
   * `h-3/4`): the wrapper below is `justify-center`, which never gives its child a definite
   * height, so `h-*` percentage classes on that child resolve unreliably (and differently) across
   * web and native. A window-derived pixel value sidesteps that: it clamps a node's own final size
   * regardless of how the ancestor chain sized itself, and a `flex-1` list inside a node with an
   * explicit `maxHeight` correctly shrinks to fit and grows to fill up to that cap.
   */
  children: React.ReactNode | ((maxHeight: number) => React.ReactNode);
  isVisible: boolean;
  handleClose: () => void;
  className?: string;
}) {
  const { height: windowHeight } = useWindowDimensions();
  // Leaves breathing room around the dialog so it never touches the screen edges.
  const maxHeight = useMemo(() => Math.round(windowHeight * 0.85), [windowHeight]);
  // `p-4` (16px) on each side of the wrapper below eats into the space content actually has.
  const contentMaxHeight = Math.max(maxHeight - 32, 0);

  return (
    <Modal
      visible={isVisible}
      onRequestClose={handleClose}
      // Without `transparent`, react-native-web paints the modal container opaque white, hiding
      // the page. The dim layer is the wrapper below, so it is identical on web, iOS and Android
      // (`backdropColor` is not supported by react-native-web).
      transparent
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center bg-black/40">
        <View
          className={twMerge(`items-center justify-center p-4 max-w-3xl w-full`, className)}
          style={{ maxHeight }}
        >
          {typeof children === "function" ? children(contentMaxHeight) : children}
        </View>
      </View>
    </Modal>
  );
}
