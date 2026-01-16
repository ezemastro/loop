import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import MissionsTable from "@/components/MissionsTable";
import MissionFormModal from "@/components/MissionFormModal";

export default function Missions() {
  const [missions, setMissions] = useState<MissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMission, setEditingMission] = useState<MissionTemplate | null>(
    null,
  );

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getMissionTemplates();
      if (response.success && response.data) {
        setMissions(response.data.missions);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cargar misiones");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (mission: MissionTemplate) => {
    setEditingMission(mission);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMission(null);
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Gestión de Misiones</h1>
          <button
            onClick={() => {
              setEditingMission(null);
              setShowModal(true);
            }}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
          >
            + Nueva Misión
          </button>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {error}
          </div>
        )}

        <MissionsTable
          missions={missions}
          loading={loading}
          onEdit={handleEdit}
        />

        <MissionFormModal
          mission={editingMission}
          isOpen={showModal}
          onClose={handleCloseModal}
          onSuccess={loadMissions}
        />
      </div>
    </Layout>
  );
}
