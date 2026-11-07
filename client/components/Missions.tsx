import { Pressable, Text, View } from "react-native";
import React, { useEffect, useState } from "react";
import { useMissions } from "@/hooks/useMissions";
import Mission from "./cards/Mission";
import Loader from "./Loader";
import Error from "./Error";
import ListingGrid from "./bases/ListingGrid";
import { ArrowDownIcon, ArrowUpIcon } from "./Icons";

/** 1 column on mobile, 2 from `md` up — see design note in `ListingGrid`. */
const MISSIONS_COLUMN_RAMP = { base: 1, md: 2 };

export default function Missions({
  setHasMissions,
  hasMissions,
}: {
  setHasMissions?: (has: boolean) => void;
  hasMissions?: boolean;
}) {
  const { data, isLoading, error } = useMissions();
  const [showCompleted, setShowCompleted] = useState(false);
  const missions = data?.userMissions;
  const active = missions?.filter((mission) => !mission.completed) ?? [];
  const completed = missions?.filter((mission) => mission.completed) ?? [];
  const showMissions = active.length > 0;
  useEffect(() => {
    if (showMissions !== hasMissions) {
      setHasMissions?.(showMissions);
    }
  }, [showMissions, hasMissions, setHasMissions]);

  return (
    <View className="gap-3">
      <ListingGrid columnRamp={MISSIONS_COLUMN_RAMP} lastFullOnOdd>
        {active.map((mission) => (
          <Mission key={mission.id} mission={mission} />
        ))}
      </ListingGrid>
      {completed.length > 0 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showCompleted }}
            onPress={() => setShowCompleted((v) => !v)}
            className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-stroke bg-white px-4 web:cursor-pointer hover:bg-background"
          >
            <Text className="text-sm font-semibold text-secondary-text">
              {completed.length === 1 ? "1 completada" : `${completed.length} completadas`}
            </Text>
            {showCompleted ? (
              <ArrowUpIcon size={20} className="text-secondary-text" />
            ) : (
              <ArrowDownIcon size={20} className="text-secondary-text" />
            )}
          </Pressable>
          {showCompleted ? (
            <ListingGrid columnRamp={MISSIONS_COLUMN_RAMP} lastFullOnOdd>
              {completed.map((mission) => (
                <Mission key={mission.id} mission={mission} />
              ))}
            </ListingGrid>
          ) : null}
        </>
      ) : null}
      {isLoading && <Loader />}
      {error && <Error>Error al cargar misiones</Error>}
    </View>
  );
}
