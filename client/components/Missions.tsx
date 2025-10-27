import { View } from "react-native";
import React, { useEffect } from "react";
import { useMissions } from "@/hooks/useMissions";
import Mission from "./cards/Mission";
import Loader from "./Loader";
import Error from "./Error";

export default function Missions({
  setHasMissions,
  hasMissions,
}: {
  setHasMissions?: (has: boolean) => void;
  hasMissions?: boolean;
}) {
  const { data, isLoading, error } = useMissions();
  const missions = data?.userMissions;
  const showMissions =
    !!missions &&
    missions.length > 0 &&
    missions.some((mission) => !mission.completed);
  useEffect(() => {
    if (showMissions !== hasMissions) {
      setHasMissions?.(showMissions);
    }
  }, [showMissions, hasMissions, setHasMissions]);

  return (
    <View className="gap-2">
      {missions?.map((mission) => (
        <Mission
          key={mission.id}
          mission={mission}
          className={mission.completed ? "opacity-60" : ""}
        />
      ))}
      {isLoading && <Loader />}
      {error && <Error>Error al cargar misiones</Error>}
    </View>
  );
}
