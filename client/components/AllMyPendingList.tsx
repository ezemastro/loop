import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import MyPendingList from "./MyPendingList";

interface Section {
  key: string;
  title?: string;
  show?: () => boolean;
  component: () => React.ReactElement;
}
export default function AllMyPendingList({
  haveResultsProp,
}: {
  haveResultsProp?: (have: boolean) => void;
}) {
  const sections: Section[] = [
    {
      key: "pending-to-accept",
      title: "Ofertas pendientes",
      show: () => haveResults["pending-to-accept"],
      component: () => (
        <MyPendingList
          type={"to-accept"}
          hasResults={(has) =>
            setHaveResults((prev) => ({ ...prev, ["pending-to-accept"]: has }))
          }
        />
      ),
    },
    {
      key: "pending-to-deliver",
      title: "Debes entregar",
      show: () => haveResults["pending-to-deliver"],
      component: () => (
        <MyPendingList
          type={"to-deliver"}
          hasResults={(has) =>
            setHaveResults((prev) => ({ ...prev, ["pending-to-deliver"]: has }))
          }
        />
      ),
    },
    {
      key: "pending-to-receive",
      title: "Debes recibir",
      show: () => haveResults["pending-to-receive"],
      component: () => (
        <MyPendingList
          type={"to-receive"}
          hasResults={(has) =>
            setHaveResults((prev) => ({ ...prev, ["pending-to-receive"]: has }))
          }
        />
      ),
    },
    {
      key: "pending-waiting-acceptance",
      title: "Esperando ser aceptado",
      show: () => haveResults["pending-waiting-acceptance"],
      component: () => (
        <MyPendingList
          type={"waiting-acceptance"}
          hasResults={(has) =>
            setHaveResults((prev) => ({
              ...prev,
              ["pending-waiting-acceptance"]: has,
            }))
          }
        />
      ),
    },
  ];
  const [haveResults, setHaveResults] = useState(
    Object.fromEntries(sections.map((s) => [s.key, false])),
  );
  useEffect(() => {
    haveResultsProp?.(Object.values(haveResults).some(Boolean));
  }, [haveResults, haveResultsProp]);
  return (
    <View>
      {sections.map((section) => (
        <View
          className={`mb-4 ${(!section.show || section.show()) === false && "hidden"}`}
          key={section.key}
        >
          {section.title && (
            <Text className="text-lg text-secondary-text text-center">
              {section.title}
            </Text>
          )}
          {section.component()}
        </View>
      ))}
    </View>
  );
}
