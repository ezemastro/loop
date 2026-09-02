import { useEffect, useState } from "react";
import { commonApi } from "@/api/commonApi";
import adminApi from "@/api/adminApi";
import { getErrorMessage } from "@/services/errors";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";

interface CreateSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /**
   * Comunidad a la que va a pertenecer el colegio. Un admin de comunidad podría omitirla (el
   * backend la saca del token), pero mandarla siempre deja un solo camino y evita que un super
   * admin cree un colegio sin comunidad.
   */
  communityId: UUID | null;
}

const FORM_ID = "create-school-form";

export default function CreateSchoolModal({
  isOpen,
  onClose,
  onSuccess,
  communityId,
}: CreateSchoolModalProps) {
  const [schoolName, setSchoolName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState<UUID | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

    if (!uploadedMediaId) {
      setError("Primero debes subir una imagen para el logo");
      return;
    }

    try {
      setCreating(true);
      const response = await adminApi.createSchool(
        schoolName,
        uploadedMediaId,
        communityId ?? undefined,
      );

      if (response.success) {
        setFeedback({ type: "success", message: "Escuela creada exitosamente" });
        handleClose();
        onSuccess();
      }
    } catch (err) {
      setError(getErrorMessage(err, "Error al crear la escuela"));
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
    setFeedback(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Crear nueva escuela"
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            type="button"
            onClick={handleClose}
            disabled={creating || uploading}
          >
            Cancelar
          </Button>
          <Button
            variant="success"
            type="submit"
            form={FORM_ID}
            loading={creating}
            disabled={!uploadedMediaId}
          >
            Crear escuela
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre de la escuela" htmlFor="school-name" required>
          <Input
            id="school-name"
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            required
            placeholder="Ej: Universidad Nacional"
          />
        </Field>

        <Field
          label="Logo de la escuela"
          htmlFor="school-logo"
          hint="Formatos: JPG, PNG, WebP (máx. 5MB)"
          required
        >
          <input
            id="school-logo"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            disabled={uploading || !!uploadedMediaId}
          />
        </Field>

        {previewUrl && (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Vista previa:</p>
            <img src={previewUrl} alt="Preview" className="h-32 w-32 rounded border object-cover" />
          </div>
        )}

        {selectedFile && !uploadedMediaId && (
          <Button
            type="button"
            onClick={() => void handleUploadFile()}
            loading={uploading}
            className="w-full"
          >
            Subir imagen
          </Button>
        )}

        {feedback && <Alert tone="success">{feedback.message}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
