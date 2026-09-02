import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchResolveCommunity = async (params: GetCommunityResolveRequest["query"]) => {
  try {
    const response = await api.get<GetCommunityResolveResponse>("/communities/resolve", {
      params,
    });
    return response.data.data!.community;
  } catch (error) {
    throw parseApiError(error);
  }
};

/**
 * Resuelve a qué comunidad pertenece un correo (o un dominio suelto).
 * `community: null` no es error: significa "dominio desconocido", así que no se reintenta.
 */
export const useResolveCommunity = (params: GetCommunityResolveRequest["query"]) => {
  const hasParams = Boolean(params.email?.trim() || params.domain?.trim());

  return useQuery({
    queryKey: ["communities", "resolve", params.email ?? null, params.domain ?? null],
    queryFn: () => fetchResolveCommunity(params),
    enabled: hasParams,
    // El mapeo dominio → comunidad cambia muy de vez en cuando y el registro consulta en cada
    // tecleo, así que conviene servir de caché.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
};
