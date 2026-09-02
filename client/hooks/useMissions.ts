import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchMissions = async () => {
  try {
    const response = await api.get<GetSelfMissionsResponse>("/me/missions");
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useMissions = () => {
  return useQuery({
    queryKey: ["missions"],
    queryFn: fetchMissions,
  });
};
