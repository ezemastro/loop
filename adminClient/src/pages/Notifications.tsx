import { useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";

export default function Notifications() {
  const [formData, setFormData] = useState({
    userId: "",
    type: "mission" as NotificationType,
    payload: "{}",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const payloadExamples: Record<NotificationType, string> = {
    mission: JSON.stringify(
      {
        missionId: "uuid-here",
        title: "Misión completada",
        rewardCredits: 50,
      },
      null,
      2,
    ),
    loop: JSON.stringify(
      {
        listingId: "uuid-here",
        title: "Nuevo intercambio",
        message: "Tu oferta fue aceptada",
      },
      null,
      2,
    ),
    donation: JSON.stringify(
      {
        donationId: "uuid-here",
        title: "Donación recibida",
        credits: 100,
      },
      null,
      2,
    ),
    admin: JSON.stringify(
      {
        title: "Notificación administrativa",
        message: "Tu cuenta ha sido actualizada",
      },
      null,
      2,
    ),
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as NotificationType;
    setFormData((prev) => ({
      ...prev,
      type: newType,
      payload: payloadExamples[newType],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      // Validar que el payload sea JSON válido
      JSON.parse(formData.payload);
    } catch {
      setError("El payload debe ser un JSON válido");
      return;
    }

    try {
      setLoading(true);
      const response = await adminApi.sendNotification(
        formData.userId,
        formData.type,
        JSON.parse(formData.payload),
      );

      if (response.success) {
        setSuccess("Notificación enviada exitosamente");
        setFormData({
          userId: "",
          type: "mission",
          payload: payloadExamples.mission,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al enviar notificación");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Enviar Notificación</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-4 rounded mb-4">
            {success}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow"
        >
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold">
                ID del Usuario*:
              </label>
              <input
                type="text"
                name="userId"
                value={formData.userId}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                required
                placeholder="uuid-del-usuario"
              />
              <p className="text-sm text-gray-500 mt-1">
                UUID del usuario que recibirá la notificación
              </p>
            </div>

            <div>
              <label className="block mb-2 font-semibold">
                Tipo de Notificación*:
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleTypeChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                required
              >
                <option value="mission">Misión</option>
                <option value="loop">Loop</option>
                <option value="donation">Donación</option>
                <option value="admin">Administrativa</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 font-semibold">
                Payload (JSON)*:
              </label>
              <textarea
                name="payload"
                value={formData.payload}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full font-mono text-sm"
                rows={10}
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                El payload debe ser un objeto JSON válido. Cambia el tipo para
                ver ejemplos.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:opacity-50 w-full font-semibold"
            >
              {loading ? "Enviando..." : "Enviar Notificación"}
            </button>
          </div>
        </form>

        <div className="mt-8 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Ejemplos de Payload</h2>
          <div className="space-y-4">
            {Object.entries(payloadExamples).map(([type, example]) => (
              <div key={type}>
                <h3 className="font-semibold capitalize mb-2">{type}:</h3>
                <pre className="bg-white p-3 rounded border text-sm overflow-x-auto">
                  {example}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
