import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import MissionsTable from "@/components/MissionsTable";
import MissionFormModal from "@/components/MissionFormModal";
import { Alert, Button, PageHeader } from "@/components/ui";
import { AxiosError } from "axios";

export default function Missions() {
  const [missions, setMissions] = useState<MissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMission, setEditingMission] = useState<MissionTemplate | null>(null);

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getMissionTemplates();
      if (response.success && response.data) {
        setMissions(response.data.missionTemplates);
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Error al cargar misiones");
      } else {
        setError("Error al cargar misiones");
      }
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
      <PageHeader
        title="Gestión de Misiones"
        actions={
          <Button
            onClick={() => {
              setEditingMission(null);
              setShowModal(true);
            }}
          >
            Nueva Misión
          </Button>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      <MissionsTable missions={missions} loading={loading} onEdit={handleEdit} />

      <MissionFormModal
        mission={editingMission}
        isOpen={showModal}
        onClose={handleCloseModal}
        onSuccess={loadMissions}
      />
    </Layout>
  );
}
