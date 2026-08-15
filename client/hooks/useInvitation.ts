import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchInvitation = async (params: GetAuthInvitationRequest["params"]) => {
  try {
    const response = await api.get<GetAuthInvitationResponse>(
      `/auth/invitations/${encodeURIComponent(params.token)}`,
    );
    if (!response.data.success) {
      throw { message: response.data.error, errorCode: response.data.errorCode };
    }
    return response.data.data!.invitation;
  } catch (err) {
    throw parseApiError(err);
  }
};

/**
 * Valida un token de invitación de un solo uso. El token llega por query param (`/register?invite=`),
 * así que puede ser cualquier cosa: un token inválido o ya usado es un error esperado, no un fallo
 * de red, y por eso no se reintenta.
 */
export const useInvitation = (token?: string) => {
  return useQuery({
    queryKey: ["invitations", token ?? null],
    queryFn: () => fetchInvitation({ token: token! }),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });
};
