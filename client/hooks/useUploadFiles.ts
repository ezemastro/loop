import { api } from "@/api/loop";
import { AxiosError } from "axios";
import { ApiError, parseErrorName } from "../services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchUploadFile = async ({
  uri,
  type,
}: {
  uri: string;
  type: string;
}) => {
  const formData = new FormData();
  formData.append("file", {
    uri,
    type,
    name: uri.split("/").pop(),
  } as any);
  try {
    const response = await api.post<PostMediaResponse>("/uploads", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

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

const uploadFiles = async (files: { uri: string; type: string }[]) => {
  const results = await Promise.all(
    files.map(async (file) => {
      return fetchUploadFile(file);
    }),
  );
  return results;
};

export const useUploadFiles = () => {
  return useMutation({
    mutationKey: ["uploadFiles"],
    mutationFn: uploadFiles,
  });
};
