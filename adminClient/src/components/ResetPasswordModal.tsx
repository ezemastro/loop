import { useState } from "react";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";

interface ResetPasswordModalProps {
  user: PrivateUser;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
        alert("Contraseña reiniciada exitosamente");
        handleClose();
        onSuccess();
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Error al reiniciar contraseña");
      } else {
        setError("Error al reiniciar contraseña");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full m-4">
        <h2 className="text-xl font-bold mb-4">
          Reiniciar Contraseña - {user.firstName} {user.lastName}
        </h2>
        <p className="mb-4 text-sm text-gray-600">Email: {user.email}</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-2 font-semibold">
              Nueva Contraseña:
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full"
              required
              minLength={6}
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-semibold">
              Confirmar Contraseña:
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full"
              required
              minLength={6}
            />
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
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50 flex-1"
            >
              {loading ? "Reiniciando..." : "Reiniciar Contraseña"}
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
