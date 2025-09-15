import { api } from "@/api/loop";
import { ApiError, parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchUpdateListing = async (
  params: PatchListingsRequest["body"] & PatchListingsRequest["params"],
) => {
  try {
    const response = await api.patch<PatchListingsResponse>(
      `/listings/${params.id}`,
      params,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Error desconocido");
    }
    return response.data.data;
  } catch (err) {
    if (err instanceof AxiosError) {
      const errName = parseErrorName({ status: err.response?.status || 500 });
      throw {
        name: errName,
        message: err.message,
      } as ApiError;
    }
    throw err;
  }
};

export const useUpdateListing = () => {
  return useMutation({
    mutationFn: fetchUpdateListing,
  });
};
