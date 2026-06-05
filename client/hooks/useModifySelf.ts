import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchModifySelf = async (params: PatchSelfRequest["body"]) => {
  try {
    const response = await api.patch<PatchListingsResponse>(`/me`, params);

    if (!response.data.success) {
      throw { message: response.data.error || "Error desconocido", errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const useModifySelf = () => {
  return useMutation({
    mutationFn: fetchModifySelf,
  });
};
