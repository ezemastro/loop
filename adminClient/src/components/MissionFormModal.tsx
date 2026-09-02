import { useEffect, useState } from "react";
import adminApi from "@/api/adminApi";
import { getErrorMessage } from "@/services/errors";
import { Alert, Button, Field, Input, Modal, Textarea, Toggle } from "@/components/ui";

interface MissionFormModalProps {
  mission?: MissionTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const FORM_ID = "mission-form";

export default function MissionFormModal({
  mission,
  isOpen,
  onClose,
  onSuccess,
}: MissionFormModalProps) {
  const [formData, setFormData] = useState({
    key: "",
    title: "",
    description: "",
    rewardCredits: "",
    active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (mission) {
      setFormData({
        key: mission.key || "",
        title: mission.title || "",
        description: mission.description || "",
        rewardCredits: mission.rewardCredits?.toString() || "",
        active: mission.active ?? true,
      });
    } else {
      setFormData({
        key: "",
        title: "",
        description: "",
        rewardCredits: "",
        active: true,
      });
    }
  }, [mission, isOpen]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);

    try {
      setLoading(true);
      const data = {
        key: formData.key,
        title: formData.title,
        description: formData.description || undefined,
        rewardCredits: Number(formData.rewardCredits),
        active: formData.active,
      };

      if (mission) {
        const response = await adminApi.updateMissionTemplate(mission.id, data);
        if (response.success) {
          setFeedback({ type: "success", message: "Misión actualizada exitosamente" });
        }
      } else {
        const response = await adminApi.createMissionTemplate(data);
        if (response.success) {
          setFeedback({ type: "success", message: "Misión creada exitosamente" });
        }
      }

      handleClose();
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Error al guardar misión"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setFeedback(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mission ? "Editar misión" : "Crear misión"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={loading}>
            {mission ? "Actualizar" : "Crear"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Clave (key)"
          htmlFor="mission-key"
          hint="Identificador único de la misión"
          required
        >
          <Input
            id="mission-key"
            type="text"
            name="key"
            value={formData.key}
            onChange={handleChange}
            required
            placeholder="donate_5_items"
          />
        </Field>

        <Field label="Título" htmlFor="mission-title" required>
          <Input
            id="mission-title"
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </Field>

        <Field label="Descripción" htmlFor="mission-description">
          <Textarea
            id="mission-description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
          />
        </Field>

        <Field label="Recompensa (créditos)" htmlFor="mission-reward" required>
          <Input
            id="mission-reward"
            type="number"
            name="rewardCredits"
            value={formData.rewardCredits}
            onChange={handleChange}
            required
            min="1"
          />
        </Field>

        <Toggle
          checked={formData.active}
          onChange={(checked) => setFormData((prev) => ({ ...prev, active: checked }))}
          label="Activa"
        />

        {feedback && <Alert tone="success">{feedback.message}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
