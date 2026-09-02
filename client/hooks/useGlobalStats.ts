import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchGlobalStats = async () => {
  try {
    const response = await api.get<GetGlobalStatsResponse>("/stats");
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useGlobalStats = () => {
  return useQuery({
    queryKey: ["globalStats"],
    queryFn: fetchGlobalStats,
  });
};
