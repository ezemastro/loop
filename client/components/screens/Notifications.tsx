import { Text } from "react-native";
import React from "react";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";

export default function Notifications() {
  return (
    <MainView className="p-4">
      <TextTitle>Notificaciones</TextTitle>
      <Text className="text-secondary-text text-center">
        Aquí aparecerán tus notificaciones.
      </Text>
    </MainView>
  );
}
