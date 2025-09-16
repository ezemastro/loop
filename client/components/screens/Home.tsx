import { View, FlatList } from "react-native";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import Stats from "../Stats";
import Missions from "../Missions";
import { useRef, useState } from "react";
import CustomRefresh from "../CustomRefresh";
import MyPendingList from "../MyPendingList";
import Feed from "../Feed";

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
      component: () => <Missions hasMissions={(has) => setHasMissions(has)} />,
    },
    {
      key: "pending",
      title: "Loops pendientes",
      show: hasPending,
      component: () => (
        <MyPendingList
          hasResults={(has) => setHasPending(has)}
          type="to-accept"
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
        contentContainerClassName="p-4"
        onEndReached={() => {
          getMore.current();
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) =>
          item.show === false ? null : (
            <View className="gap-6 mb-4">
              {item.title && <TextTitle>{item.title}</TextTitle>}
              {item.component()}
            </View>
          )
        }
      />
    </MainView>
  );
}
