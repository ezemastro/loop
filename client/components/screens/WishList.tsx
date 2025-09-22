import { Text } from "react-native";
import TextTitle from "../bases/TextTitle";
import { MainView } from "../bases/MainView";

export default function WishList() {
  return (
    <MainView className="p-4">
      <TextTitle>Tu lista de deseados</TextTitle>
      <Text className="text-secondary-text text-center">
        Aquí aparecerán los productos que has añadido a tu lista de deseados.
      </Text>
    </MainView>
  );
}
