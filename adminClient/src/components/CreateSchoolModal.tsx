import { useState } from "react";
import { commonApi } from "@/api/commonApi";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";

interface CreateSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateSchoolModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSchoolModalProps) {
  const [schoolName, setSchoolName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState<UUID | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (!uploadedMediaId) {
      setError("Primero debes subir una imagen para el logo");
      return;
    }

    try {
      setCreating(true);
      const response = await adminApi.createSchool(schoolName, uploadedMediaId);

      if (response.success) {
        alert("Escuela creada exitosamente");
        handleClose();
        onSuccess();
      }
    } catch (err) {
      setError(
        err instanceof AxiosError
          ? err.response?.data?.error
          : "Error al crear la escuela",
      );
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setSchoolName("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedMediaId(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full m-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Crear Nueva Escuela</h2>

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
              Logo de la Escuela*:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="border border-gray-300 rounded px-3 py-2 w-full"
              disabled={uploading || !!uploadedMediaId}
            />
            <p className="text-sm text-gray-500 mt-1">
              Formatos: JPG, PNG, WebP (máx. 5MB)
            </p>
          </div>

          {previewUrl && (
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">Vista previa:</p>
              <img
                src={previewUrl}
                alt="Preview"
                className="w-32 h-32 object-cover rounded border"
              />
            </div>
          )}

          {selectedFile && !uploadedMediaId && (
            <div className="mb-4">
              <button
                type="button"
                onClick={handleUploadFile}
                disabled={uploading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 w-full"
              >
                {uploading ? "Subiendo..." : "Subir Imagen"}
              </button>
            </div>
          )}

          {uploadedMediaId && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
              ✓ Imagen subida correctamente
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !uploadedMediaId}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 flex-1"
            >
              {creating ? "Creando..." : "Crear Escuela"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={creating || uploading}
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
