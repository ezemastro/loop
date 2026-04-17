import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import { commonApi } from "@/api/commonApi";
import CreateSchoolModal from "@/components/CreateSchoolModal";
import SchoolsTable from "@/components/SchoolsTable";
import EditSchoolModal from "@/components/EditSchoolModal";
import { AxiosError } from "axios";

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

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener escuelas y estadísticas en paralelo
      const [schoolsResponse, statsResponse] = await Promise.all([
        commonApi.getSchools(),
        adminApi.getSchoolStats(),
      ]);

      if (schoolsResponse.success && schoolsResponse.data) {
        const schoolsData = schoolsResponse.data.schools;
        const statsData = statsResponse.data?.schools || [];

        // Combinar datos: agregar stats a cada escuela
        const schoolsWithStats: SchoolWithStats[] = schoolsData.map(
          (school) => {
            // Intentar match por id (pueden ser diferentes tipos)
            const stats = statsData.find(
              (s) =>
                s.id === parseInt(school.id) ||
                s.id.toString() === school.id ||
                s.name === school.name,
            );

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
          },
        );

        setSchools(schoolsWithStats);
      }
    } catch (err) {
      setError(
        err instanceof AxiosError
          ? err.response?.data?.error
          : "Error al cargar las escuelas",
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSchool = (school: School) => {
    setSelectedSchool(school);
    setShowEditModal(true);
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Gestión de Escuelas</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
          >
            + Nueva Escuela
          </button>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {error}
          </div>
        )}

        <SchoolsTable
          schools={schools}
          loading={loading}
          onEdit={handleEditSchool}
        />

        <CreateSchoolModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadSchools}
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
      </div>
    </Layout>
  );
}
