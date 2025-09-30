import { View, Text } from "react-native";
import MyPendingList from "./MyPendingList";
import { useEffect, useState } from "react";

interface Section {
  key: string;
  title?: string;
  show?: () => boolean;
  component: () => React.ReactElement;
}
export default function AllMyPendingList({
  hasResults,
  setHasResults,
}: {
  hasResults: boolean;
  setHasResults: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [haveResults, setHaveResults] = useState<Record<string, boolean>>({});
  const sections: Section[] = [
    {
      key: "pending-to-accept",
      title: "Ofertas pendientes",
      show: () => !!haveResults["pending-to-accept"],
      component: () => (
        <MyPendingList
          type={"to-accept"}
          hasResults={!!haveResults["pending-to-accept"]}
          setHasResults={(has) =>
            setHaveResults((prev) => ({ ...prev, ["pending-to-accept"]: has }))
          }
        />
      ),
    },
    {
      key: "pending-to-deliver",
      title: "Debes entregar",
      show: () => !!haveResults["pending-to-deliver"],
      component: () => (
        <MyPendingList
          type={"to-deliver"}
          hasResults={!!haveResults["pending-to-deliver"]}
          setHasResults={(has) =>
            setHaveResults((prev) => ({ ...prev, ["pending-to-deliver"]: has }))
          }
        />
      ),
    },
    {
      key: "pending-to-receive",
      title: "Debes recibir",
      show: () => !!haveResults["pending-to-receive"],
      component: () => (
        <MyPendingList
          type={"to-receive"}
          hasResults={!!haveResults["pending-to-receive"]}
          setHasResults={(has) =>
            setHaveResults((prev) => ({ ...prev, ["pending-to-receive"]: has }))
          }
        />
      ),
    },
    {
      key: "pending-waiting-acceptance",
      title: "Esperando ser aceptado",
      show: () => !!haveResults["pending-waiting-acceptance"],
      component: () => (
        <MyPendingList
          type={"waiting-acceptance"}
          hasResults={!!haveResults["pending-waiting-acceptance"]}
          setHasResults={(has) =>
            setHaveResults((prev) => ({
              ...prev,
              ["pending-waiting-acceptance"]: has,
            }))
          }
        />
      ),
    },
  ];
  useEffect(() => {
    const anyResults = Object.values(haveResults).some((v) => v);
    if (anyResults === hasResults) return;
    setHasResults(anyResults);
  }, [haveResults, hasResults, setHasResults]);
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
