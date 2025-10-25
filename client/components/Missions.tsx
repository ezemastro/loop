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
  useEffect(() => {
    if (missions !== hasMissions) {
      setHasMissions?.(!!missions && missions.length > 0);
    }
  }, [missions, hasMissions, setHasMissions]);

  return (
    <View className="gap-2">
      {missions?.map((mission) => (
        <Mission key={mission.id} mission={mission} />
      ))}
      {isLoading && <Loader />}
      {error && <Error>Error al cargar misiones</Error>}
    </View>
  );
}
