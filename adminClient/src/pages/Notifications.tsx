import { useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";

export default function Notifications() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<PrivateUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PrivateUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      setError(null);
      const response = await adminApi.getUsers({ search: searchQuery.trim() });
      if (response.success && response.data) {
        setUsers(response.data.users);
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Error al buscar usuarios");
      } else {
        setError("Error al buscar usuarios");
      }
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user: PrivateUser) => {
    setSelectedUser(user);
    setUsers([]);
    setSearchQuery("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedUser) {
      setError("Debes seleccionar un usuario");
      return;
    }

    if (!title.trim() || !message.trim()) {
      setError("El título y el mensaje son obligatorios");
      return;
    }

    try {
      setLoading(true);
      const response = await adminApi.sendNotification(
        selectedUser.id,
        "admin",
        { title, message },
      );

      if (response.success) {
        setSuccess("Notificación enviada exitosamente");
        setSelectedUser(null);
        setTitle("");
        setMessage("");
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Error al enviar notificación");
      } else {
        setError("Error al enviar notificación");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          Enviar Notificación Administrativa
        </h1>

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

        <div className="bg-white p-6 rounded-lg shadow space-y-6">
          {/* Búsqueda de usuario */}
          <div>
            <label className="block mb-2 font-semibold text-gray-700">
              Usuario destinatario*:
            </label>
            {selectedUser ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-4 py-3">
                <div>
                  <p className="font-semibold text-blue-900">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </p>
                  <p className="text-sm text-blue-700">{selectedUser.email}</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="border border-gray-300 rounded px-4 py-2 flex-1"
                    placeholder="Buscar por nombre o email..."
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {searching ? "Buscando..." : "Buscar"}
                  </button>
                </div>
                {users.length > 0 && (
                  <div className="border border-gray-300 rounded max-h-60 overflow-y-auto">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <p className="font-semibold">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formulario de notificación */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                Título*:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border border-gray-300 rounded px-4 py-2 w-full"
                placeholder="Ej: Actualización de cuenta"
                required
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                Mensaje*:
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="border border-gray-300 rounded px-4 py-2 w-full"
                rows={5}
                placeholder="Escribe el contenido de la notificación..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !selectedUser}
              className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed w-full font-semibold text-lg"
            >
              {loading ? "Enviando..." : "📤 Enviar Notificación"}
            </button>
          </form>
        </div>

        {/* Ejemplo de notificación */}
        <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-700 mb-2">💡 Ejemplo:</h3>
          <p className="text-sm text-gray-600 mb-1">
            <strong>Título:</strong> Cambio en las políticas de uso
          </p>
          <p className="text-sm text-gray-600">
            <strong>Mensaje:</strong> Hemos actualizado nuestras políticas de
            privacidad. Por favor revisa los nuevos términos en tu perfil.
          </p>
        </div>
      </div>
    </Layout>
  );
}
