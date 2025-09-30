import { View, FlatList } from "react-native";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import Stats from "../Stats";
import Missions from "../Missions";
import { useRef, useState } from "react";
import CustomRefresh from "../CustomRefresh";
import Feed from "../Feed";
import AllMyPendingList from "../AllMyPendingList";

interface Section {
  key: string;
  title?: string;
  show?: boolean;
  component: () => React.ReactNode;
}
export default function Home() {
  const [hasMissions, setHasMissions] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const sections: Section[] = [
    {
      key: "stats",
      component: () => <Stats />,
    },
    {
      key: "mission",
      title: "Misiones",
      show: hasMissions,
      component: () => (
        <Missions hasMissions={hasMissions} setHasMissions={setHasMissions} />
      ),
    },
    {
      key: "pending",
      title: "Loops pendientes",
      show: hasPending,
      component: () => (
        <AllMyPendingList
          hasResults={hasPending}
          setHasResults={setHasPending}
        />
      ),
    },
    {
      key: "feed",
      title: "Publicaciones recomendadas",
      component: () => (
        <Feed
          saveMoreFunction={(getMoreFunction) =>
            (getMore.current = getMoreFunction)
          }
        />
      ),
    },
  ];
  const getMore = useRef<() => void>(() => {});
  return (
    <MainView>
      <FlatList
        data={sections}
        refreshControl={<CustomRefresh />}
        contentContainerClassName="p-4 pt-6"
        onEndReached={() => {
          getMore.current();
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <View className={`gap-4 mb-6 ${item.show === false && "hidden"}`}>
            {item.title && <TextTitle>{item.title}</TextTitle>}
            {item.component()}
          </View>
        )}
      />
    </MainView>
  );
}
