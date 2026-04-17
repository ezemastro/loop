import { useEffect, useState } from "react";
import { commonApi } from "@/api/commonApi";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";
import { getUrl } from "@/services/getUrl";

interface EditSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  school: School | null;
}

export default function EditSchoolModal({
  isOpen,
  onClose,
  onSuccess,
  school,
}: EditSchoolModalProps) {
  const [schoolName, setSchoolName] = useState(school?.name || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState<UUID | null>(null);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchoolName(school?.name || "");
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedMediaId(null);
    setError(null);
  }, [school, isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor selecciona un archivo de imagen");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen debe pesar menos de 5MB");
      return;
    }

    setSelectedFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      setError("Por favor selecciona una imagen");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const response = await commonApi.uploadFile(selectedFile);

      if (response.success && response.data) {
        setUploadedMediaId(response.data.media.id);
        alert("Imagen subida exitosamente");
      }
    } catch (err) {
      setError(
        err instanceof AxiosError
          ? err.response?.data?.error
          : "Error al subir la imagen",
      );
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!schoolName.trim()) {
      setError("El nombre de la escuela es requerido");
      return;
    }

    if (!school) {
      setError("No hay escuela cargada");
      return;
    }

    try {
      setUpdating(true);
      // Si no se cambió el logo, no enviar mediaId
      const response = await adminApi.updateSchool(
        school.id,
        schoolName,
        uploadedMediaId || undefined,
      );

      if (response.success) {
        alert("Escuela actualizada exitosamente");
        handleClose();
        onSuccess();
      }
    } catch (err) {
      setError(
        err instanceof AxiosError
          ? err.response?.data?.error
          : "Error al actualizar la escuela",
      );
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleClose = () => {
    setSchoolName(school?.name || "");
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedMediaId(null);
    setError(null);
    onClose();
  };

  if (!isOpen || !school) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full m-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Editar Escuela</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-2 font-semibold">
              Nombre de la Escuela*:
            </label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full"
              required
              placeholder="Ej: Universidad Nacional"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-semibold">
              Logo de la Escuela (Opcional):
            </label>

            {/* Logo actual */}
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-2">Logo actual:</p>
              {school.media && (
                <img
                  src={getUrl(school.media.url)}
                  alt={school.name}
                  className="w-24 h-24 object-cover rounded border border-gray-300"
                />
              )}
            </div>

            {/* Nuevo logo si se selecciona */}
            {previewUrl && (
              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-2">Nuevo logo:</p>
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded border border-gray-300"
                />
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="border border-gray-300 rounded px-3 py-2 w-full"
            />
          </div>

          {selectedFile && !uploadedMediaId && (
            <button
              type="button"
              onClick={handleUploadFile}
              disabled={uploading}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition disabled:bg-gray-400 mb-4"
            >
              {uploading ? "Subiendo..." : "Subir Logo"}
            </button>
          )}

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={updating}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition disabled:bg-gray-400"
            >
              {updating ? "Actualizando..." : "Guardar Cambios"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
