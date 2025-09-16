import { View, Text, FlatList } from "react-native";
import MyListingsList from "../MyListingsList";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import { useState } from "react";
import MyPendingList from "../MyPendingList";

interface Section {
  key: string;
  title?: string;
  show?: () => boolean;
  component: () => React.ReactElement;
}
export default function MyListings() {
  const sections: Section[] = [
    {
      key: "pending-title",
      show: () =>
        haveResults["pending-to-accept"] ||
        haveResults["pending-to-deliver"] ||
        haveResults["pending-to-receive"] ||
        haveResults["pending-waiting-acceptance"],
      component: () => <TextTitle>Publicaciones pendientes</TextTitle>,
    },
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
      title: "Deber entregar",
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
      title: "Deber recibir",
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
      title: "Deber recibir",
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
    {
      key: "own-title",
      component: () => <TextTitle>Mis publicaciones</TextTitle>,
    },
    {
      key: "own",
      component: () => <MyListingsList />,
    },
  ];
  const [haveResults, setHaveResults] = useState(
    Object.fromEntries(sections.map((s) => [s.key, false])),
  );
  return (
    <MainView>
      <FlatList
        data={sections}
        contentContainerClassName="px-4 py-4"
        renderItem={({ item }) => (
          <>
            {(!item.show || item.show()) && (
              <View className="mb-4">
                {item.title && <Text>{item.title}</Text>}
                {item.component()}
              </View>
            )}
          </>
        )}
      />
    </MainView>
  );
}
