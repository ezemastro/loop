import { useEffect, useState } from "react";
import adminApi from "@/api/adminApi";
import { getErrorMessage } from "@/services/errors";
import { Alert, Button, Field, Input, Modal, Textarea } from "@/components/ui";

interface ModifyCreditsModalProps {
  user: PrivateUser;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const FORM_ID = "modify-credits-form";

export default function ModifyCreditsModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: ModifyCreditsModalProps) {
  const [amount, setAmount] = useState("");
  const [isPositive, setIsPositive] = useState(true);
  const [reason, setReason] = useState("");
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

    const creditAmount = Number(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      setError("Por favor ingresa una cantidad válida");
      return;
    }

    if (!reason.trim()) {
      setError("El motivo es obligatorio");
      return;
    }

    try {
      setLoading(true);
      const response = await adminApi.modifyUserCredits(user.id, creditAmount, isPositive, {
        reason: reason.trim(),
      });

      if (response.success) {
        setFeedback({ type: "success", message: "Créditos modificados exitosamente" });
        handleClose();
        onSuccess();
      }
    } catch (err) {
      setError(getErrorMessage(err, "Error al modificar créditos"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount("");
    setIsPositive(true);
    setReason("");
    setError(null);
    setFeedback(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Modificar créditos — ${user.firstName} ${user.lastName}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={loading}>
            Modificar
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        Créditos actuales: <span className="font-semibold">{user.credits.balance}</span>
      </p>

      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <Field label="Cantidad" htmlFor="credits-amount" required>
          <Input
            id="credits-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            min="1"
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Operación</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              checked={isPositive}
              onChange={() => setIsPositive(true)}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            Sumar créditos
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              checked={!isPositive}
              onChange={() => setIsPositive(false)}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            Restar créditos
          </label>
        </fieldset>

        <Field label="Motivo" htmlFor="credits-reason" required>
          <Textarea
            id="credits-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Ajuste por error de carga"
            rows={2}
            required
          />
        </Field>

        {feedback && <Alert tone="success">{feedback.message}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
