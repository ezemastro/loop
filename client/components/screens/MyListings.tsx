import { View, Text, FlatList } from "react-native";
import MyListingsList from "../MyListingsList";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import { useState } from "react";
import CustomRefresh from "../CustomRefresh";
import AllMyPendingList from "../AllMyPendingList";
import AvoidingKeyboard from "../AvoidingKeyboard";

interface Section {
  key: string;
  title?: string;
  show?: () => boolean;
  component: () => React.ReactElement;
}
export default function MyListings() {
  const [hasResults, setHasResults] = useState(false);
  const sections: Section[] = [
    {
      key: "pending-title",
      show: () => hasResults,
      component: () => <TextTitle>Publicaciones pendientes</TextTitle>,
    },
    {
      key: "pending-list",
      show: () => hasResults,
      component: () => (
        <AllMyPendingList
          hasResults={hasResults}
          setHasResults={setHasResults}
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
  return (
    <MainView>
      <AvoidingKeyboard>
        <FlatList
          data={sections}
          className="flex-1"
          refreshControl={<CustomRefresh />}
          contentContainerClassName="px-4 py-4"
          renderItem={({ item }) => (
            <View
              className={`mb-4 ${(!item.show || item.show()) === false && "hidden"}`}
            >
              {item.title && (
                <Text className="text-lg text-main-text text-center">
                  {item.title}
                </Text>
              )}
              {item.component()}
            </View>
          )}
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
