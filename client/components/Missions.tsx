import { View } from "react-native";
import React, { useEffect } from "react";
import { useMissions } from "@/hooks/useMissions";
import Mission from "./cards/Mission";
import Loader from "./Loader";
import Error from "./Error";

export default function Missions({
  hasMissions,
}: {
  hasMissions?: (has: boolean) => void;
}) {
  const { data, isLoading, error } = useMissions();
  const missions = data?.userMissions;
  useEffect(() => {
    if (hasMissions) {
      hasMissions(!!missions && missions.length > 0);
    }
  }, [missions, hasMissions]);

  return (
    <View>
      {missions?.map((mission) => (
        <Mission key={mission.id} mission={mission} />
      ))}
      {isLoading && <Loader />}
      {error && <Error>Error al cargar misiones</Error>}
    </View>
  );
}
