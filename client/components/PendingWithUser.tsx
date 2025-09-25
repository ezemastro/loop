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
      title: "Debes recibir",
      component: () => (
        <MyPendingList
          type="to-receive"
          filterUserId={userId}
          resultsCount={(count) =>
            pendingCount["to-receive"] !== count
              ? setPendingCount({ ...pendingCount, ["to-receive"]: count })
              : null
          }
        />
      ),
    },
    {
      key: "to-deliver",
      title: "Debes entregar",
      component: () => (
        <MyPendingList
          type="to-deliver"
          filterUserId={userId}
          resultsCount={(count) =>
            pendingCount["to-deliver"] !== count
              ? setPendingCount({ ...pendingCount, ["to-deliver"]: count })
              : null
          }
        />
      ),
    },
    {
      key: "to-accept",
      title: "Debes aceptar",
      component: () => (
        <MyPendingList
          type="to-accept"
          filterUserId={userId}
          resultsCount={(count) =>
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
          resultsCount={(count) =>
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
    <FlatList
      data={pendingSections}
      className={
        "flex-grow bg-background z-10 mt-2 " + (isVisible ? "" : "hidden")
      }
      contentContainerClassName="gap-2"
      renderItem={({ item }) => (
        <View
          className={
            "px-4 " +
            (!pendingCount[item.key as keyof typeof pendingCount]
              ? "hidden"
              : "")
          }
        >
          <Text className="text-secondary-text text-lg font-bold">
            {item.title}
          </Text>
          {item.component()}
        </View>
      )}
    />
  );
}
