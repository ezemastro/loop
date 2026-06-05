import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

type Params = PostListingReceivedRequest["params"];
const fetchMarkReceived = async (params: Params) => {
  try {
    const response = await api.post<PostListingReceivedResponse>(
      `/listings/${params.listingId}/receive`,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useListingMarkReceived = (params: Params) => {
  return useMutation({
    mutationFn: () => fetchMarkReceived(params),
  });
};
