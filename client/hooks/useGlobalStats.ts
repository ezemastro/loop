import { api } from "@/api/loop";
import { useQuery } from "@tanstack/react-query";

const fetchGlobalStats = async () => {
  const response = await api.get<GetGlobalStatsResponse>("/stats");
  return response.data.data;
};

export const useGlobalStats = () => {
  return useQuery({
    queryKey: ["globalStats"],
    queryFn: fetchGlobalStats,
  });
};
