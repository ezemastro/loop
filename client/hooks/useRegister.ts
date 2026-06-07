import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchRegister = async (body: PostAuthRegisterRequest["body"]) => {
  try {
    const response = await api.post<PostAuthRegisterResponse>("/auth/register", body);

    if (!response.data.success) {
      throw { message: response.data.error, errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const useRegister = () => {
  return useMutation({
    mutationFn: fetchRegister,
  });
};
