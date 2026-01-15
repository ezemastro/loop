import { api } from "@/api/loop";

/**
 * Cliente API para operaciones comunes
 * Incluye funcionalidades compartidas como la subida de archivos
 */
export const commonApi = {
  /**
   * Subir un archivo al servidor
   * Requiere autenticación
   * @param file - Archivo a subir (File o Blob)
   * @returns Información del archivo subido incluyendo URL pública
   */
  uploadFile: async (file: File | Blob) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<PostMediaResponse>("/uploads", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  /**
   * Obtener lista de escuelas
   * @param params - Parámetros de paginación y búsqueda opcionales
   * @returns Lista de escuelas con paginación
   */
  getSchools: async (params?: { page?: number; searchTerm?: string }) => {
    const response = await api.get<GetSchoolsResponse>("/schools", {
      params,
    });
    return response.data;
  },
};
