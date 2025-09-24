import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

export const useHideOnKeyboard = () => {
  // Ocultar tab bar al mostrar el teclado
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setVisible(false);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setVisible(true);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  return { visible };
};
