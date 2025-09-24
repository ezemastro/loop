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
  const [haveResults, setHaveResults] = useState(false);
  const sections: Section[] = [
    {
      key: "pending-title",
      show: () => haveResults,
      component: () => <TextTitle>Publicaciones pendientes</TextTitle>,
    },
    {
      key: "pending-list",
      show: () => haveResults,
      component: () => (
        <AllMyPendingList
          haveResultsProp={(have) =>
            haveResults !== have ? setHaveResults(have) : null
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
  return (
    <MainView>
      <AvoidingKeyboard>
        <FlatList
          data={sections}
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
