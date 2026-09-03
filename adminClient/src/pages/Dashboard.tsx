import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import CommunityFilter from "@/components/CommunityFilter";
import { useCommunityScope } from "@/hooks/useCommunityScope";
import { AxiosError } from "axios";
import { Droplets, Leaf, Recycle, type LucideIcon } from "lucide-react";
import { Alert, EmptyState, LoadingBlock, PageHeader, StatCard } from "@/components/ui";

/**
 * `global_stats` solo tiene 3 nombres posibles (ver `server/api/src/services/queries.ts:1209-1214`),
 * así que el mapa es explícito en vez de derivar la etiqueta del nombre de la columna en la API.
 * Residuos es el indicador principal: es la métrica directa del marketplace (reutilizar en vez de
 * comprar nuevo). CO₂ y agua son el impacto ambiental derivado de esa misma actividad.
 */
const STAT_META: Record<string, { label: string; unit: string; icon: LucideIcon }> = {
  total_kg_waste: { label: "Residuos reciclados", unit: "kg", icon: Recycle },
  total_kg_co2: { label: "CO₂ evitado", unit: "kg", icon: Leaf },
  total_l_h2o: { label: "Agua ahorrada", unit: "L", icon: Droplets },
};

const HEADLINE_STAT = "total_kg_waste";

const formatValue = (value: number) => value.toLocaleString("es-AR", { maximumFractionDigits: 1 });

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

  const headline = stats?.[HEADLINE_STAT];
  const secondaryEntries = stats
    ? Object.entries(stats).filter(([key]) => key !== HEADLINE_STAT)
    : [];

  return (
    <Layout>
      <PageHeader
        title="Dashboard"
        description="Impacto ambiental generado por la comunidad a través del marketplace."
        filters={
          isSuperAdmin && (
            <CommunityFilter
              communities={communities}
              value={selectedCommunityId}
              onChange={setSelectedCommunityId}
              allowAll
              loading={communitiesLoading}
            />
          )
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      {loading && <LoadingBlock label="Cargando estadísticas…" />}

      {!loading && stats && (
        <section>
          <p className="text-eyebrow font-semibold tracking-[0.2em] text-brand-secondary uppercase">
            Impacto ambiental
          </p>

          <div className="mt-3 space-y-4">
            {headline !== undefined && (
              <StatCard
                size="lg"
                icon={STAT_META.total_kg_waste.icon}
                label={STAT_META.total_kg_waste.label}
                value={`${formatValue(headline)} ${STAT_META.total_kg_waste.unit}`}
                hint="Gestionados en publicaciones intercambiadas en vez de descartados"
              />
            )}

            {secondaryEntries.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {secondaryEntries.map(([key, value]) => {
                  const meta = STAT_META[key];
                  return (
                    <StatCard
                      key={key}
                      icon={meta?.icon}
                      label={meta?.label ?? key}
                      value={`${formatValue(value)} ${meta?.unit ?? ""}`.trim()}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {!loading && !stats && !error && (
        <EmptyState
          title="No hay estadísticas disponibles"
          description="Todavía no hay datos de impacto para mostrar."
        />
      )}
    </Layout>
  );
}
