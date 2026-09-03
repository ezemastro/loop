import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import { commonApi } from "@/api/commonApi";
import CreateSchoolModal from "@/components/CreateSchoolModal";
import CommunityFilter from "@/components/CommunityFilter";
import SchoolsTable from "@/components/SchoolsTable";
import EditSchoolModal from "@/components/EditSchoolModal";
import { useCommunityScope } from "@/hooks/useCommunityScope";
import { Alert, Button, EmptyState, PageHeader } from "@/components/ui";
import { AxiosError } from "axios";
import { Building2 } from "lucide-react";

interface SchoolWithStats extends School {
  stats?: {
    kgWaste: number;
    kgCo2: number;
    lH2o: number;
  };
}

export default function Schools() {
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  // `GET /schools` exige saber de qué comunidad: para un community_admin es la suya, y un super
  // admin tiene que elegirla en el filtro (no hay "todas": el endpoint es el mismo que usa la
  // pantalla de registro y siempre está scopeado).
  const {
    isSuperAdmin,
    communities,
    communitiesLoading,
    selectedCommunityId,
    setSelectedCommunityId,
    scopeCommunityId,
    targetCommunityId,
  } = useCommunityScope();

  const loadSchools = useCallback(async () => {
    if (!targetCommunityId) {
      setSchools([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // Obtener escuelas y estadísticas en paralelo
      const [schoolsResponse, statsResponse] = await Promise.all([
        commonApi.getSchools({ communityId: targetCommunityId }),
        adminApi.getSchoolStats({ ...(scopeCommunityId ? { communityId: scopeCommunityId } : {}) }),
      ]);

      if (schoolsResponse.success && schoolsResponse.data) {
        const schoolsData = schoolsResponse.data.schools;
        const statsData = statsResponse.data?.schools || [];

        // Combinar datos: agregar stats a cada escuela
        const schoolsWithStats: SchoolWithStats[] = schoolsData.map((school) => {
          // Intentar match por id (pueden ser diferentes tipos)
          const stats = statsData.find((s) => s.id.toString() === school.id);

          return {
            ...school,
            stats: stats
              ? {
                  kgWaste: stats.statKgWaste,
                  kgCo2: stats.statKgCo2,
                  lH2o: stats.statLH2o,
                }
              : undefined,
          };
        });

        setSchools(schoolsWithStats);
      }
    } catch (err) {
      setError(
        err instanceof AxiosError ? err.response?.data?.error : "Error al cargar las escuelas",
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [targetCommunityId, scopeCommunityId]);

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  const handleEditSchool = (school: School) => {
    setSelectedSchool(school);
    setShowEditModal(true);
  };

  return (
    <Layout>
      <PageHeader
        title="Gestión de Escuelas"
        filters={
          isSuperAdmin && (
            <CommunityFilter
              communities={communities}
              value={selectedCommunityId}
              onChange={setSelectedCommunityId}
              allowAll={false}
              loading={communitiesLoading}
            />
          )
        }
        actions={
          <Button onClick={() => setShowCreateModal(true)} disabled={!targetCommunityId}>
            Nueva Escuela
          </Button>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      {!targetCommunityId ? (
        <EmptyState
          icon={Building2}
          title="Elegí una comunidad"
          description="Los colegios pertenecen a una comunidad; hay que indicar cuál para listarlos."
        />
      ) : (
        <SchoolsTable schools={schools} loading={loading} onEdit={handleEditSchool} />
      )}

      <CreateSchoolModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadSchools}
        communityId={targetCommunityId}
      />

      <EditSchoolModal
        isOpen={showEditModal}
        school={selectedSchool}
        onClose={() => {
          setShowEditModal(false);
          setSelectedSchool(null);
        }}
        onSuccess={loadSchools}
      />
    </Layout>
  );
}
