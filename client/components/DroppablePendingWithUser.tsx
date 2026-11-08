import { View, Text, Pressable } from "react-native";
import React, { useState } from "react";
import PendingWithUser from "./PendingWithUser";
import { ArrowDownIcon, ArrowUpIcon } from "./Icons";

export default function DroppablePendingWithUser({ userId }: { userId: string }) {
  const [pendingCount, setPendingCount] = useState({
    "to-receive": 0,
    "to-deliver": 0,
    "to-accept": 0,
    "waiting-acceptance": 0,
  });
  const [isPendingListVisible, setIsPendingListVisible] = useState(false);

  return (
    <>
      <View
        className={
          "border-b border-stroke bg-white " +
          (!Object.values(pendingCount).some((v) => !!v) ? "hidden" : "")
        }
      >
        <Pressable
          className="min-h-[44px] flex-row items-center px-4"
          onPress={() => setIsPendingListVisible(!isPendingListVisible)}
        >
          <Text className="flex-grow text-left text-sm font-semibold text-main-text">
            Loops pendientes <Text>({Object.values(pendingCount).reduce((a, b) => a + b, 0)})</Text>
          </Text>
          {isPendingListVisible ? (
            <ArrowUpIcon className="text-main-text" />
          ) : (
            <ArrowDownIcon className="text-main-text" />
          )}
        </Pressable>
      </View>
      <PendingWithUser
        userId={userId}
        isVisible={isPendingListVisible}
        pendingCount={pendingCount}
        setPendingCount={setPendingCount}
      />
    </>
  );
}
