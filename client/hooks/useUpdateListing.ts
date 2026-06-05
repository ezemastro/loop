import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchUpdateListing = async (
  params: PatchListingsRequest["body"] & PatchListingsRequest["params"],
) => {
  try {
    const response = await api.patch<PatchListingsResponse>(
      `/listings/${params.listingId}`,
      params,
    );

    if (!response.data.success) {
      throw { message: response.data.error || "Error desconocido", errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const useUpdateListing = () => {
  return useMutation({
    mutationFn: fetchUpdateListing,
  });
};
