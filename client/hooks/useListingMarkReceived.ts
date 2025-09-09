import { api } from "@/api/loop";
import { parseErrorName } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

type Params = PostListingReceivedRequest["params"];
const fetchMarkReceived = async (params: Params) => {
  try {
    const response = await api.post<PostListingReceivedResponse>(
      `/listings/${params.listingId}/received`,
    );
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

export const useListingMarkReceived = (params: Params) => {
  return useMutation({
    mutationKey: ["listing", "received", params],
    mutationFn: () => fetchMarkReceived(params),
  });
};
