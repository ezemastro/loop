import { useEffect, useState } from "react";
import { commonApi } from "@/api/commonApi";
import adminApi from "@/api/adminApi";
import { getErrorMessage } from "@/services/errors";
import { getUrl } from "@/services/getUrl";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";

interface EditSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  school: School | null;
}

const FORM_ID = "edit-school-form";

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
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    setSchoolName(school?.name || "");
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedMediaId(null);
    setError(null);
    setFeedback(null);
  }, [school, isOpen]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

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
        setFeedback({ type: "success", message: "Imagen subida exitosamente" });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Error al subir la imagen"));
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);

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
      const response = await adminApi.updateSchool(
        school.id,
        schoolName,
        uploadedMediaId || undefined,
      );

      if (response.success) {
        setFeedback({ type: "success", message: "Escuela actualizada exitosamente" });
        handleClose();
        onSuccess();
      }
    } catch (err) {
      setError(getErrorMessage(err, "Error al actualizar la escuela"));
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
    setFeedback(null);
    onClose();
  };

  // `ui/Modal` ya resuelve `!isOpen`; el `!school` se mantiene porque el cuerpo lee `school.*`
  // sin más chequeos.
  if (!school) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Editar escuela"
      size="md"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button variant="success" type="submit" form={FORM_ID} loading={updating}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre de la escuela" htmlFor="edit-school-name" required>
          <Input
            id="edit-school-name"
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            required
            placeholder="Ej: Universidad Nacional"
          />
        </Field>

        <Field label="Logo de la escuela" htmlFor="edit-school-logo" hint="Opcional">
          <div className="mb-3">
            <p className="mb-2 text-sm text-slate-600">Logo actual:</p>
            {school.media && (
              <img
                src={getUrl(school.media.url)}
                alt={school.name}
                className="h-24 w-24 rounded border border-slate-300 object-cover"
              />
            )}
          </div>

          {previewUrl && (
            <div className="mb-3">
              <p className="mb-2 text-sm text-slate-600">Nuevo logo:</p>
              <img
                src={previewUrl}
                alt="Preview"
                className="h-24 w-24 rounded border border-slate-300 object-cover"
              />
            </div>
          )}

          <input
            id="edit-school-logo"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </Field>

        {selectedFile && !uploadedMediaId && (
          <Button
            type="button"
            onClick={() => void handleUploadFile()}
            loading={uploading}
            className="w-full"
          >
            Subir logo
          </Button>
        )}

        {feedback && <Alert tone="success">{feedback.message}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
