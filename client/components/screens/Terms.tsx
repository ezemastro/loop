import { View, Text, BackHandler, FlatList } from "react-native";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { MainView } from "../bases/MainView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessionStore } from "@/stores/session";
import TextTitle from "../bases/TextTitle";

interface Section {
  type: "title" | "subtitle" | "paragraph" | "list-item";
  content: string;
}

export default function TermsPage() {
  const insets = useSafeAreaInsets();
  const setHasAcceptedTerms = useSessionStore(
    (state) => state.setHasAcceptedTerms,
  );
  const handleAccept = () => {
    setHasAcceptedTerms(true);
  };

  const handleReject = () => {
    setHasAcceptedTerms(false);
    // Cerrar la aplicación
    BackHandler.exitApp();
  };

  const termsSections: Section[] = [
    {
      type: "title",
      content: "Deslinde de responsabilidades",
    },
    {
      type: "subtitle",
      content: "1. La Red Itinere:",
    },
    {
      type: "list-item",
      content:
        "No garantiza el cumplimiento de los acuerdos entre usuarios ni la autenticidad de los productos ofrecidos.",
    },
    {
      type: "list-item",
      content:
        "No se responsabiliza por pérdidas, daños materiales o personales, errores de descripción, incumplimientos, ni por el uso indebido de la plataforma.",
    },
    {
      type: "list-item",
      content:
        "No será responsable por interrupciones temporales del servicio, errores técnicos, mantenimiento o actualizaciones.",
    },
    {
      type: "list-item",
      content:
        "No obtiene lucro ni beneficio económico directo por las transacciones realizadas a través de LOOP.",
    },
    {
      type: "subtitle",
      content: "2. Los usuarios:",
    },
    {
      type: "list-item",
      content:
        "Asumen plena responsabilidad por los productos ofrecidos, su estado, entrega y recepción.",
    },
    {
      type: "list-item",
      content:
        "Se comprometen a actuar de buena fe, respetando los valores de confianza, solidaridad y cuidado ambiental que inspiran la iniciativa.",
    },
    {
      type: "list-item",
      content:
        "Liberan a la Red Itinere de cualquier reclamo judicial o extrajudicial derivado de las transacciones efectuadas a través de LOOP.",
    },
  ];

  return (
    <View
      className="flex-1"
      style={{
        paddingBottom: insets.bottom,
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <MainView className="p-4">
        <FlatList
          data={termsSections}
          contentContainerClassName="py-2 px-2"
          renderItem={({ item }) => (
            <>
              {item.type === "title" && (
                <TextTitle className="mb-4 text-3xl">{item.content}</TextTitle>
              )}
              {item.type === "subtitle" && (
                <TextTitle className="mb-3 mt-3 text-left">
                  {item.content}
                </TextTitle>
              )}
              {item.type === "paragraph" && (
                <Text className="mb-2 text-main-text text-lg leading-6">
                  {item.content}
                </Text>
              )}
              {item.type === "list-item" && (
                <Text className="mb-3 text-main-text text-lg leading-6">
                  • {item.content}
                </Text>
              )}
            </>
          )}
        />
        <View className="flex-row gap-2">
          <CustomButton onPress={handleReject} className="bg-alert">
            <ButtonText>Rechazar</ButtonText>
          </CustomButton>
          <CustomButton onPress={handleAccept} className="flex-grow">
            <ButtonText>Aceptar</ButtonText>
          </CustomButton>
        </View>
      </MainView>
    </View>
  );
}
