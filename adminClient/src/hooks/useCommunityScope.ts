import { useEffect } from "react";
import { useCommunitiesStore } from "@/stores/communities";
import { useIsSuperAdmin, useSessionStore } from "@/stores/session";

/**
 * Resuelve el alcance de comunidad de la página actual.
 *
 * Para un community_admin el alcance es implícito: el backend ignora `?communityId=` y lo saca del
 * token, así que el panel ni lo manda ni muestra filtros. Para un super admin el filtro es explícito
 * y `scopeCommunityId` es lo que hay que pasarle a la API.
 */
export function useCommunityScope() {
  const isSuperAdmin = useIsSuperAdmin();
  const sessionCommunityId = useSessionStore((state) => state.communityId);
  const communities = useCommunitiesStore((state) => state.communities);
  const loading = useCommunitiesStore((state) => state.loading);
  const error = useCommunitiesStore((state) => state.error);
  const load = useCommunitiesStore((state) => state.load);
  const selectedCommunityId = useCommunitiesStore((state) => state.selectedCommunityId);
  const setSelectedCommunityId = useCommunitiesStore((state) => state.setSelectedCommunityId);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin, load]);

  return {
    isSuperAdmin,
    sessionCommunityId,
    communities,
    communitiesLoading: loading,
    communitiesError: error,
    reloadCommunities: () => load({ force: true }),
    selectedCommunityId,
    setSelectedCommunityId,
    /** `undefined` ⇒ sin filtro: el super admin ve todo, el community_admin ve lo suyo. */
    scopeCommunityId: isSuperAdmin ? (selectedCommunityId ?? undefined) : undefined,
    /**
     * Comunidad concreta sobre la que operar cuando la acción exige una (crear un colegio,
     * listarlos). Para un community_admin es siempre la suya.
     */
    targetCommunityId: isSuperAdmin ? selectedCommunityId : sessionCommunityId,
  };
}
