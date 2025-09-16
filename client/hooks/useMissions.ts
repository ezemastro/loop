import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchMissions = async () => {
  try {
    const response = await api.get<GetSelfMissionsResponse>("/me/missions");
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw {
        name: parseErrorName({ status: error.response?.status || 500 }),
        message: error.message,
      };
    }
  }
};

export const useMissions = () => {
  return useQuery({
    queryKey: ["missions"],
    queryFn: fetchMissions,
  });
};
