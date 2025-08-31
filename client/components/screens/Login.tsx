import { Text, View } from "react-native";
import { MainView } from "../MainView";
import SchoolSelector from "../SchoolSelector";

export const Login = () => {
  return (
    <MainView>
      <View className="w-3/4 bg-slate-300 m-auto p-4 rounded-lg">
        <Text className="text-xl text-center font-bold color-primary">
          Inicia sesión
        </Text>
        <SchoolSelector />
      </View>
    </MainView>
  );
};
