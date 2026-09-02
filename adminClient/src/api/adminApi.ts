import { api } from "@/api/loop";

/**
 * Comunidad tal como la devuelve el panel: con sus dominios y sus métricas. Se deriva del tipo de
 * la respuesta para que no se despegue del contrato.
 */
export type AdminCommunity = NonNullable<
  GetAdminCommunitiesResponse["data"]
>["communities"][number];

/**
 * El backend acepta `?communityId=` en todas las rutas scopeadas, pero lo ignora salvo que quien
 * pregunte sea super admin. Por eso el cliente puede mandarlo siempre sin ramificar por rol.
 */
interface CommunityScope {
  communityId?: UUID;
}

/**
 * Cliente API para operaciones de administración
 * Todas las funciones requieren autenticación de administrador excepto login y register
 */
export const adminApi = {
  // Autenticación
  /**
   * Iniciar sesión como administrador
   */
  login: async (email: string, password: string) => {
    const response = await api.post<PostAdminLoginResponse>("/admin/login", {
      email,
      password,
    });
    return response.data;
  },

  /**
   * Iniciar sesión con Google OAuth
   * @param credential - Token JWT que devuelve Google Sign-In
   */
  googleLogin: async (credential: string) => {
    const response = await api.post<PostAdminGoogleLoginResponse>("/admin/google-login", {
      credential,
    });
    return response.data;
  },

  /**
   * Registrar un nuevo administrador
   */
  register: async (email: string, fullName: string, password: string) => {
    const response = await api.post<PostAdminRegisterResponse>("/admin/register", {
      email,
      fullName,
      password,
    });
    return response.data;
  },

  /**
   * Cerrar sesión. Va sin auth: el punto es poder terminar una sesión que ya puede no servir.
   */
  logout: async () => {
    const response = await api.post<PostAdminLogoutResponse>("/admin/logout");
    return response.data;
  },
  /**
   * Validar un nuevo email para registro de administradores.
   * `role: "super_admin"` solo lo acepta el backend si quien autoriza ya es super admin.
   */
  addValidEmailForRegistration: async (
    email: string,
    options?: { role?: AdminRole; communityId?: UUID },
  ) => {
    const response = await api.post<PostAdminAuthorizeEmailResponse>("/admin/authorize-email", {
      email,
      role: options?.role,
      communityId: options?.communityId,
    });
    return response.data;
  },

  // Gestión de usuarios
  /**
   * Obtener lista de usuarios con paginación y búsqueda opcional
   */
  getUsers: async (params?: { page?: number; search?: string } & CommunityScope) => {
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

  /**
   * Mover un usuario a otra comunidad (solo super admin). Los colegios se reasignan de cero porque
   * los de la comunidad vieja no existen en la nueva.
   */
  moveUserCommunity: async (userId: UUID, communityId: UUID, schoolIds: UUID[]) => {
    const response = await api.post<ApiResponse<{ user: PrivateUser }>>(
      `/admin/users/${userId}/community`,
      { communityId, schoolIds },
    );
    return response.data;
  },

  // Gestión de escuelas
  /**
   * Crear una nueva escuela. Un super admin tiene que indicar en qué comunidad nace.
   */
  createSchool: async (name: string, mediaId: UUID, communityId?: UUID) => {
    const response = await api.post<PostAdminSchoolsResponse>("/admin/schools", {
      name,
      mediaId,
      communityId,
    });
    return response.data;
  },

  /**
   * Actualizar una escuela existente (nombre y/o logo)
   */
  updateSchool: async (schoolId: UUID, name?: string, mediaId?: UUID) => {
    const response = await api.patch<PatchAdminSchoolsResponse>(`/admin/schools/${schoolId}`, {
      name,
      mediaId,
    });
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
    const response = await api.post<PostAdminCategoriesResponse>("/admin/categories", data);
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
    const response = await api.post<PostAdminNotificationResponse>("/admin/notifications", {
      userId,
      type,
      payload,
    });
    return response.data;
  },

  // Estadísticas
  /**
   * Obtener estadísticas globales del sistema
   */
  getStats: async (params?: CommunityScope) => {
    const response = await api.get<GetAdminStatsResponse>("/admin/stats", { params });
    return response.data;
  },

  /**
   * Obtener estadísticas por escuela
   */
  getSchoolStats: async (params?: CommunityScope) => {
    const response = await api.get<GetAdminSchoolStatsResponse>("/admin/schools/stats", { params });
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
    const response = await api.post<PostAdminMissionTemplateResponse>("/admin/missions", data);
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

  /**
   * Obtener todas las mission templates
   */
  getMissionTemplates: async () => {
    const response = await api.get<GetAdminMissionTemplatesResponse>("/admin/missions");
    return response.data;
  },

  /**
   * Reiniciar contraseña de un usuario
   */
  resetUserPassword: async (userId: UUID, newPassword: string) => {
    const response = await api.post<PostAdminUserResetPasswordResponse>(
      `/admin/users/${userId}/reset-password`,
      {
        newPassword,
      },
    );
    return response.data;
  },

  // Gestión de comunidades (solo super admin)
  /**
   * Listar todas las comunidades con sus dominios y métricas
   */
  getCommunities: async () => {
    const response = await api.get<GetAdminCommunitiesResponse>("/admin/communities");
    return response.data;
  },

  /**
   * Crear una comunidad. El slug es inmutable después de crearla.
   */
  createCommunity: async (data: {
    slug: string;
    name: string;
    mediaId?: UUID | null;
    theme?: CommunityTheme;
    domains?: string[];
  }) => {
    const response = await api.post<PostAdminCommunityResponse>("/admin/communities", data);
    return response.data;
  },

  /**
   * Actualizar una comunidad. El slug no se puede cambiar.
   */
  updateCommunity: async (
    communityId: UUID,
    data: {
      name?: string;
      mediaId?: UUID | null;
      theme?: CommunityTheme;
      active?: boolean;
    },
  ) => {
    const response = await api.patch<PatchAdminCommunityResponse>(
      `/admin/communities/${communityId}`,
      data,
    );
    return response.data;
  },

  /**
   * Agregar un dominio de correo a una comunidad
   */
  addCommunityDomain: async (communityId: UUID, domain: string) => {
    const response = await api.post<PostAdminCommunityDomainResponse>(
      `/admin/communities/${communityId}/domains`,
      { domain },
    );
    return response.data;
  },

  /**
   * Quitar un dominio de correo de una comunidad
   */
  removeCommunityDomain: async (communityId: UUID, domainId: UUID) => {
    const response = await api.delete<DeleteAdminCommunityDomainResponse>(
      `/admin/communities/${communityId}/domains/${domainId}`,
    );
    return response.data;
  },

  // Invitaciones
  /**
   * Listar invitaciones (paginado)
   */
  getInvitations: async (params?: { page?: number } & CommunityScope) => {
    const response = await api.get<GetAdminInvitationsResponse>("/admin/invitations", { params });
    return response.data;
  },

  /**
   * Generar una invitación de un solo uso
   */
  createInvitation: async (data?: {
    communityId?: UUID;
    note?: string;
    expiresInDays?: number;
  }) => {
    const response = await api.post<PostAdminInvitationResponse>("/admin/invitations", data ?? {});
    return response.data;
  },

  /**
   * Revocar una invitación sin usar
   */
  deleteInvitation: async (invitationId: UUID, params?: CommunityScope) => {
    const response = await api.delete<DeleteAdminInvitationResponse>(
      `/admin/invitations/${invitationId}`,
      { params },
    );
    return response.data;
  },

  // Solicitudes de borrado de cuenta
  /**
   * Listar solicitudes de borrado de cuenta
   */
  getDeletionRequests: async (
    params?: { page?: number; status?: "pending" | "completed" | "rejected" } & CommunityScope,
  ) => {
    const response = await api.get<GetAdminDeletionRequestsResponse>("/admin/deletion-requests", {
      params,
    });
    return response.data;
  },

  /**
   * Resolver una solicitud: `completed` borra la cuenta de verdad, `rejected` solo la cierra.
   */
  resolveDeletionRequest: async (requestId: UUID, action: "completed" | "rejected") => {
    const response = await api.post<PostAdminResolveDeletionResponse>(
      `/admin/deletion-requests/${requestId}/resolve`,
      { action },
    );
    return response.data;
  },
};

export default adminApi;
