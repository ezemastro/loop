import { api } from "@/api/loop";
import { ApiError, parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchDeleteListing = async (listingId: string) => {
  try {
    const response = await api.delete(`/listings/${listingId}`);

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

export const useDeleteListing = () => {
  return useMutation({
    mutationFn: fetchDeleteListing,
  });
};
