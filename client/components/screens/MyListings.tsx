import { View, FlatList } from "react-native";
import MyListingsList from "../MyListingsList";
import { MainView, pageContentClassName } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import { useState } from "react";
import CustomRefresh from "../CustomRefresh";
import AllMyPendingList from "../AllMyPendingList";
import AvoidingKeyboard from "../AvoidingKeyboard";

interface Section {
  key: string;
  show?: () => boolean;
  component: () => React.ReactElement;
}
export default function MyListings() {
  const [hasResults, setHasResults] = useState(false);
  const contentContainerClassName = pageContentClassName("wide", "px-4 py-4");
  const sections: Section[] = [
    {
      key: "pending-title",
      show: () => hasResults,
      component: () => <TextTitle level="section">Loops pendientes</TextTitle>,
    },
    {
      key: "pending-list",
      show: () => hasResults,
      component: () => <AllMyPendingList hasResults={hasResults} setHasResults={setHasResults} />,
    },
    {
      key: "own-title",
      component: () => <TextTitle level="section">Mis publicaciones</TextTitle>,
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
          contentContainerClassName={contentContainerClassName}
          renderItem={({ item }) => (
            <View className={`mb-4 ${(!item.show || item.show()) === false && "hidden"}`}>
              {item.component()}
            </View>
          )}
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
