import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchPublishListing = async (body: PostListingsRequest["body"]) => {
  try {
    const response = await api.post<PostListingsResponse>("/listings", body);

    if (!response.data.success) {
      throw { message: response.data.error || "Error desconocido", errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const usePublishListing = () => {
  return useMutation({
    mutationFn: fetchPublishListing,
  });
};
