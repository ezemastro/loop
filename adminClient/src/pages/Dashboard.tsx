import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import CommunityFilter from "@/components/CommunityFilter";
import { useCommunityScope } from "@/hooks/useCommunityScope";
import { AxiosError } from "axios";

export default function Dashboard() {
  const {
    isSuperAdmin,
    communities,
    communitiesLoading,
    selectedCommunityId,
    setSelectedCommunityId,
    scopeCommunityId,
  } = useCommunityScope();

  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getStats(
        scopeCommunityId ? { communityId: scopeCommunityId } : undefined,
      );
      if (response.success && response.data) {
        setStats(response.data.stats);
      }
    } catch (err) {
      setError(
        err instanceof AxiosError ? err.response?.data?.error : "Error al cargar estadísticas",
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [scopeCommunityId]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const formatLabel = (key: string) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          {isSuperAdmin && (
            <CommunityFilter
              communities={communities}
              value={selectedCommunityId}
              onChange={setSelectedCommunityId}
              allowAll
              loading={communitiesLoading}
            />
          )}
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500 text-lg">Cargando estadísticas...</div>
          </div>
        )}

        {!loading && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Object.entries(stats).map(([key, value]) => (
              <div
                key={key}
                className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition"
              >
                <div className="text-3xl font-bold text-blue-600">{value.toLocaleString()}</div>
                <div className="text-gray-500 mt-1 text-sm">{formatLabel(key)}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && !stats && !error && (
          <div className="text-gray-500 text-center mt-12">No hay estadísticas disponibles</div>
        )}
      </div>
    </Layout>
  );
}
