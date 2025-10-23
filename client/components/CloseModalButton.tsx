import { Pressable } from "react-native";
import React from "react";
import { CrossIcon } from "./Icons";

export default function CloseModalButton({ onClose }: { onClose: () => void }) {
  return (
    <Pressable onPress={onClose} className="p-2 absolute top-2 right-2 z-10">
      <CrossIcon size={24} className="text-main-text" />
    </Pressable>
  );
}
