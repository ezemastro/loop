import { create } from "zustand";
import adminApi from "@/api/adminApi";
import type { AdminCommunity } from "@/api/adminApi";
import { getErrorMessage } from "@/services/errors";

interface CommunitiesStore {
  communities: AdminCommunity[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /**
   * Filtro de comunidad compartido por todas las páginas. Vive acá y no en cada página para que
   * un super admin que eligió una comunidad en Usuarios la siga viendo al pasar a Colegios.
   */
  selectedCommunityId: UUID | null;
  setSelectedCommunityId: (communityId: UUID | null) => void;
  /** Solo la llama un super admin: `/admin/communities` le está vedado al resto. */
  load: (options?: { force?: boolean }) => Promise<void>;
}

export const useCommunitiesStore = create<CommunitiesStore>()((set, get) => ({
  communities: [],
  loading: false,
  loaded: false,
  error: null,
  selectedCommunityId: null,
  setSelectedCommunityId: (communityId) => set({ selectedCommunityId: communityId }),
  load: async ({ force = false } = {}) => {
    const { loaded, loading } = get();
    if (loading || (loaded && !force)) return;
    set({ loading: true, error: null });
    try {
      const response = await adminApi.getCommunities();
      set({
        communities: response.data?.communities ?? [],
        loaded: true,
        loading: false,
      });
    } catch (err) {
      set({
        error: getErrorMessage(err, "Error al cargar las comunidades"),
        loading: false,
        loaded: true,
      });
    }
  },
}));
