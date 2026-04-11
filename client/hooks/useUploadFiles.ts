import { api } from "@/api/loop";
import { AxiosError } from "axios";
import { ApiError, parseErrorName } from "../services/errors";
import { useMutation } from "@tanstack/react-query";
import { Platform } from "react-native";

const fetchUploadFile = async ({
  uri,
  type,
}: {
  uri: string;
  type: string;
}) => {
  const formData = new FormData();

  const fallbackName = `upload-${Date.now()}.jpg`;
  const fileName = uri.split("/").pop() || fallbackName;

  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileType = type || blob.type || "image/jpeg";
    const file = new File([blob], fileName, { type: fileType });
    formData.append("file", file);
  } else {
    formData.append("file", {
      uri,
      type,
      name: fileName,
    } as any);
  }

  try {
    const response = await api.post<PostMediaResponse>(
      "/uploads",
      formData,
      Platform.OS === "web"
        ? undefined
        : {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
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
