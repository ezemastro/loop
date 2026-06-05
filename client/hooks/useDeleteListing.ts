import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchDeleteListing = async (listingId: string) => {
  try {
    const response = await api.delete(`/listings/${listingId}`);

    if (!response.data.success) {
      throw { message: response.data.error || "Error desconocido", errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const useDeleteListing = () => {
  return useMutation({
    mutationFn: fetchDeleteListing,
  });
};
