import { useState } from "react";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";

interface MissionFormModalProps {
  mission?: MissionTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MissionFormModal({
  mission,
  isOpen,
  onClose,
  onSuccess,
}: MissionFormModalProps) {
  const [formData, setFormData] = useState({
    key: mission?.key || "",
    title: mission?.title || "",
    description: mission?.description || "",
    rewardCredits: mission?.rewardCredits?.toString() || "",
    active: mission?.active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      const data = {
        key: formData.key,
        title: formData.title,
        description: formData.description || undefined,
        rewardCredits: parseInt(formData.rewardCredits),
        active: formData.active,
      };

      if (mission) {
        const response = await adminApi.updateMissionTemplate(mission.id, data);
        if (response.success) {
          alert("Misión actualizada exitosamente");
        }
      } else {
        const response = await adminApi.createMissionTemplate(data);
        if (response.success) {
          alert("Misión creada exitosamente");
        }
      }

      handleClose();
      onSuccess();
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Error al guardar misión");
      } else {
        setError("Error al guardar misión");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full m-4">
        <h2 className="text-xl font-bold mb-4">
          {mission ? "Editar Misión" : "Crear Misión"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold">Clave (key)*:</label>
              <input
                type="text"
                name="key"
                value={formData.key}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                required
                placeholder="donate_5_items"
              />
              <p className="text-sm text-gray-500 mt-1">
                Identificador único de la misión
              </p>
            </div>

            <div>
              <label className="block mb-2 font-semibold">Título*:</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                required
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold">Descripción:</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                rows={3}
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold">
                Recompensa (Créditos)*:
              </label>
              <input
                type="number"
                name="rewardCredits"
                value={formData.rewardCredits}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                required
                min="1"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="w-5 h-5"
                />
                <span className="font-semibold">Activa</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 flex-1"
            >
              {loading ? "Guardando..." : mission ? "Actualizar" : "Crear"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 disabled:opacity-50 flex-1"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
