import { useEffect, useState } from "react";
import adminApi from "@/api/adminApi";
import { getErrorMessage } from "@/services/errors";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";

interface ResetPasswordModalProps {
  user: PrivateUser;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const FORM_ID = "reset-password-form";

export default function ResetPasswordModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    try {
      setLoading(true);
      const response = await adminApi.resetUserPassword(user.id, newPassword);

      if (response.success) {
        setFeedback({ type: "success", message: "Contraseña reiniciada exitosamente" });
        handleClose();
        onSuccess();
      }
    } catch (err) {
      setError(getErrorMessage(err, "Error al reiniciar contraseña"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setFeedback(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Reiniciar contraseña — ${user.firstName} ${user.lastName}`}
      description={user.email}
      size="md"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" type="submit" form={FORM_ID} loading={loading}>
            Reiniciar contraseña
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nueva contraseña" htmlFor="reset-new-password" required>
          <Input
            id="reset-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>

        <Field label="Confirmar contraseña" htmlFor="reset-confirm-password" required>
          <Input
            id="reset-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>

        {feedback && <Alert tone="success">{feedback.message}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
