import { View } from "react-native";
import React, { useEffect } from "react";
import { useMissions } from "@/hooks/useMissions";
import Mission from "./cards/Mission";
import Loader from "./Loader";
import Error from "./Error";
import ListingGrid from "./bases/ListingGrid";

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
  const missions = data?.userMissions;
  const showMissions =
    !!missions && missions.length > 0 && missions.some((mission) => !mission.completed);
  useEffect(() => {
    if (showMissions !== hasMissions) {
      setHasMissions?.(showMissions);
    }
  }, [showMissions, hasMissions, setHasMissions]);

  return (
    <View>
      <ListingGrid columnRamp={MISSIONS_COLUMN_RAMP} lastFullOnOdd>
        {missions?.map((mission) => (
          <Mission
            key={mission.id}
            mission={mission}
            className={mission.completed ? "saturate-50 opacity-50" : ""}
          />
        )) ?? []}
      </ListingGrid>
      {isLoading && <Loader />}
      {error && <Error>Error al cargar misiones</Error>}
    </View>
  );
}
