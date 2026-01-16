import { useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";
import { emailSchema } from "@/services/validations";

export default function AuthorizeAdmin() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validar email con zod
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      setError(validation.error.message);
      return;
    }

    try {
      setLoading(true);
      const response = await adminApi.addValidEmailForRegistration(email);

      if (response.success) {
        setSuccess(
          `Email ${email} autorizado exitosamente. Ahora puede registrarse como administrador.`,
        );
        setEmail("");
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(
          err.response?.data?.error ||
            "Error al autorizar el email. Puede que ya esté autorizado.",
        );
      } else {
        setError("Error al autorizar el email. Puede que ya esté autorizado.");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          Autorizar Nuevo Administrador
        </h1>
        <p className="text-gray-600 mb-6">
          Agrega un email a la lista de autorizados para registro de
          administradores
        </p>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4 flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-4 rounded mb-4 flex items-center gap-2">
            <span className="text-xl">✓</span>
            <span>{success}</span>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                Email del nuevo administrador*:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-gray-300 rounded px-4 py-3 w-full text-lg"
                placeholder="admin@ejemplo.com"
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                Este email podrá registrarse como administrador en la plataforma
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed w-full font-semibold text-lg"
            >
              {loading ? "Autorizando..." : "🔑 Autorizar Email"}
            </button>
          </form>
        </div>

        <div className="mt-8 bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h2 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <span className="text-xl">ℹ️</span>
            ¿Cómo funciona?
          </h2>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Ingresa el email de la persona que quieres autorizar</li>
            <li>El email se agregará a la lista de permitidos</li>
            <li>
              La persona podrá ir a la página de registro y crear su cuenta de
              administrador
            </li>
            <li>
              Solo los emails autorizados pueden registrarse como
              administradores
            </li>
          </ol>
        </div>
      </div>
    </Layout>
  );
}
