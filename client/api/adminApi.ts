import { api } from "./loop";

/**
 * Cliente API para operaciones de administración
 * Todas las funciones requieren autenticación de administrador excepto login y register
 */
export const adminApi = {
  // Autenticación
  /**
   * Iniciar sesión como administrador
   */
  login: async (username: string, password: string) => {
    const response = await api.post<PostAdminLoginResponse>("/admin/login", {
      username,
      password,
    });
    return response.data;
  },

  /**
   * Registrar un nuevo administrador
   * Requiere un token de registro especial
   */
  register: async (
    username: string,
    fullName: string,
    password: string,
    passToken: string,
  ) => {
    const response = await api.post<PostAdminRegisterResponse>(
      "/admin/register",
      {
        username,
        fullName,
        password,
        passToken,
      },
    );
    return response.data;
  },

  // Gestión de usuarios
  /**
   * Obtener lista de usuarios con paginación y búsqueda opcional
   */
  getUsers: async (params?: { page?: number; search?: string }) => {
    const response = await api.get<GetAdminUsersResponse>("/admin/users", {
      params,
    });
    return response.data;
  },

  /**
   * Modificar los créditos de un usuario
   */
  modifyUserCredits: async (
    userId: UUID,
    amount: number,
    positive: boolean,
    meta?: Record<string, unknown>,
  ) => {
    const response = await api.post<PostAdminUserCreditsResponse>(
      `/admin/users/${userId}/credits`,
      {
        amount,
        positive,
        meta,
      },
    );
    return response.data;
  },

  // Gestión de escuelas
  /**
   * Crear una nueva escuela
   */
  createSchool: async (name: string, mediaId: UUID) => {
    const response = await api.post<PostAdminSchoolsResponse>(
      "/admin/schools",
      {
        name,
        mediaId,
      },
    );
    return response.data;
  },

  // Gestión de categorías
  /**
   * Crear una nueva categoría
   */
  createCategory: async (data: {
    name: string;
    description?: string;
    parentId?: UUID;
    icon?: string;
    minPriceCredits?: number;
    maxPriceCredits?: number;
    statKgWaste?: number;
    statKgCo2?: number;
    statLH2o?: number;
  }) => {
    const response = await api.post<PostAdminCategoriesResponse>(
      "/admin/categories",
      data,
    );
    return response.data;
  },

  /**
   * Actualizar una categoría existente
   */
  updateCategory: async (
    categoryId: UUID,
    data: {
      name?: string;
      description?: string;
      parentId?: UUID | null;
      icon?: string;
      minPriceCredits?: number;
      maxPriceCredits?: number;
      statKgWaste?: number;
      statKgCo2?: number;
      statLH2o?: number;
    },
  ) => {
    const response = await api.patch<PatchAdminCategoryResponse>(
      `/admin/categories/${categoryId}`,
      data,
    );
    return response.data;
  },

  // Gestión de notificaciones
  /**
   * Enviar una notificación a un usuario
   */
  sendNotification: async (
    userId: UUID,
    type: NotificationType,
    payload: Record<string, unknown>,
  ) => {
    const response = await api.post<PostAdminNotificationResponse>(
      "/admin/notifications",
      {
        userId,
        type,
        payload,
      },
    );
    return response.data;
  },

  // Estadísticas
  /**
   * Obtener estadísticas globales del sistema
   */
  getStats: async () => {
    const response = await api.get<GetAdminStatsResponse>("/admin/stats");
    return response.data;
  },

  /**
   * Obtener estadísticas por escuela
   */
  getSchoolStats: async () => {
    const response = await api.get<GetAdminSchoolStatsResponse>(
      "/admin/schools/stats",
    );
    return response.data;
  },

  // Gestión de mission templates
  /**
   * Crear una nueva mission template
   */
  createMissionTemplate: async (data: {
    key: string;
    title: string;
    description?: string;
    rewardCredits: number;
    active: boolean;
  }) => {
    const response = await api.post<PostAdminMissionTemplateResponse>(
      "/admin/missions",
      data,
    );
    return response.data;
  },

  /**
   * Actualizar una mission template existente
   * Permite cambiar título, descripción, recompensa y estado activo/inactivo
   */
  updateMissionTemplate: async (
    missionTemplateId: UUID,
    data: {
      title?: string;
      description?: string;
      rewardCredits?: number;
      active?: boolean;
    },
  ) => {
    const response = await api.patch<PatchAdminMissionTemplateResponse>(
      `/admin/missions/${missionTemplateId}`,
      data,
    );
    return response.data;
  },
};

export default adminApi;
