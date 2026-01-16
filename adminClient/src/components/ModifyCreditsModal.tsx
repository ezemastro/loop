import { useState } from "react";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";

interface ModifyCreditsModalProps {
  user: PrivateUser;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModifyCreditsModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: ModifyCreditsModalProps) {
  const [amount, setAmount] = useState("");
  const [isPositive, setIsPositive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const creditAmount = parseInt(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      setError("Por favor ingresa una cantidad válida");
      return;
    }

    try {
      setLoading(true);
      const response = await adminApi.modifyUserCredits(
        user.id,
        creditAmount,
        isPositive,
      );

      if (response.success) {
        alert("Créditos modificados exitosamente");
        handleClose();
        onSuccess();
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Error al modificar créditos");
      } else {
        setError("Error al modificar créditos");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount("");
    setIsPositive(true);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full m-4">
        <h2 className="text-xl font-bold mb-4">
          Modificar Créditos - {user.firstName} {user.lastName}
        </h2>
        <p className="mb-4 text-gray-600">
          Créditos actuales:{" "}
          <span className="font-semibold">{user.credits.balance}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-2 font-semibold">Cantidad:</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full"
              required
              min="1"
            />
          </div>

          <div className="mb-4">
            <label className="flex items-center mb-2">
              <input
                type="radio"
                checked={isPositive}
                onChange={() => setIsPositive(true)}
                className="mr-2"
              />
              Sumar créditos
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={!isPositive}
                onChange={() => setIsPositive(false)}
                className="mr-2"
              />
              Restar créditos
            </label>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 flex-1"
            >
              {loading ? "Modificando..." : "Modificar"}
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
