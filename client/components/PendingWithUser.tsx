import { View, Text, FlatList } from "react-native";
import MyPendingList from "./MyPendingList";

export default function PendingWithUser({
  userId,
  isVisible,
  pendingCount,
  setPendingCount,
}: {
  userId: string;
  isVisible: boolean;
  pendingCount: {
    "to-receive": number;
    "to-deliver": number;
    "to-accept": number;
    "waiting-acceptance": number;
  };
  setPendingCount: React.Dispatch<
    React.SetStateAction<{
      "to-receive": number;
      "to-deliver": number;
      "to-accept": number;
      "waiting-acceptance": number;
    }>
  >;
}) {
  const pendingSections = [
    {
      key: "to-receive",
      title: "Tenés que recibir",
      component: () => (
        <MyPendingList
          type="to-receive"
          filterUserId={userId}
          resultsCount={pendingCount["to-receive"]}
          setResultsCount={(count) =>
            pendingCount["to-receive"] !== count
              ? setPendingCount({ ...pendingCount, ["to-receive"]: count })
              : null
          }
        />
      ),
    },
    {
      key: "to-deliver",
      title: "Tenés que entregar",
      component: () => (
        <MyPendingList
          type="to-deliver"
          filterUserId={userId}
          resultsCount={pendingCount["to-deliver"]}
          setResultsCount={(count) =>
            pendingCount["to-deliver"] !== count
              ? setPendingCount({ ...pendingCount, ["to-deliver"]: count })
              : null
          }
        />
      ),
    },
    {
      key: "to-accept",
      title: "Tenés que aceptar",
      component: () => (
        <MyPendingList
          type="to-accept"
          filterUserId={userId}
          resultsCount={pendingCount["to-accept"]}
          setResultsCount={(count) =>
            pendingCount["to-accept"] !== count
              ? setPendingCount({ ...pendingCount, ["to-accept"]: count })
              : null
          }
        />
      ),
    },
    {
      key: "waiting-acceptance",
      title: "Debe aceptarte",
      component: () => (
        <MyPendingList
          type="waiting-acceptance"
          filterUserId={userId}
          resultsCount={pendingCount["waiting-acceptance"]}
          setResultsCount={(count) =>
            pendingCount["waiting-acceptance"] !== count
              ? setPendingCount({
                  ...pendingCount,
                  ["waiting-acceptance"]: count,
                })
              : null
          }
        />
      ),
    },
  ];

  return (
    <View className={isVisible ? "h-60 border-b border-stroke bg-white" : "h-0"}>
      <FlatList
        data={pendingSections}
        className="mt-2"
        contentContainerClassName="gap-2"
        renderItem={({ item }) => (
          <View
            className={
              "px-4 " + (!pendingCount[item.key as keyof typeof pendingCount] ? "hidden" : "")
            }
          >
            <Text className="text-sm font-semibold text-secondary-text">{item.title}</Text>
            {item.component()}
          </View>
        )}
      />
    </View>
  );
}
