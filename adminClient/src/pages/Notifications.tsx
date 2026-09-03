import { useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import CommunityFilter from "@/components/CommunityFilter";
import { useCommunityScope } from "@/hooks/useCommunityScope";
import { AxiosError } from "axios";
import { Send, Lightbulb } from "lucide-react";
import { Alert, Button, Card, CardBody, Field, Input, PageHeader, Textarea } from "@/components/ui";

export default function Notifications() {
  const {
    isSuperAdmin,
    communities,
    communitiesLoading,
    selectedCommunityId,
    setSelectedCommunityId,
    scopeCommunityId,
  } = useCommunityScope();

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
      const response = await adminApi.getUsers({
        search: searchQuery.trim(),
        ...(scopeCommunityId ? { communityId: scopeCommunityId } : {}),
      });
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
      const response = await adminApi.sendNotification(selectedUser.id, "admin", {
        title,
        message,
      });

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
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Enviar Notificación Administrativa"
          filters={
            isSuperAdmin && (
              <CommunityFilter
                communities={communities}
                value={selectedCommunityId}
                onChange={setSelectedCommunityId}
                allowAll
                loading={communitiesLoading}
              />
            )
          }
        />

        {error && <Alert tone="error">{error}</Alert>}
        {success && (
          <Alert tone="success" className="mt-4">
            {success}
          </Alert>
        )}

        <Card className="mt-4">
          <CardBody className="space-y-6 p-6">
            <Field label="Usuario destinatario" required>
              {selectedUser ? (
                <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-indigo-900">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </p>
                    <p className="text-sm text-indigo-700">{selectedUser.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Buscar por nombre o email..."
                      className="flex-1"
                    />
                    <Button onClick={handleSearch} loading={searching}>
                      Buscar
                    </Button>
                  </div>
                  {users.length > 0 && (
                    <div className="rounded-lg border border-slate-300">
                      {users.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectUser(user)}
                          className="w-full border-b border-slate-200 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                        >
                          <p className="font-semibold text-slate-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-slate-600">{user.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Título" htmlFor="notification-title" required>
                <Input
                  id="notification-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Actualización de cuenta"
                  required
                />
              </Field>

              <Field label="Mensaje" htmlFor="notification-message" required>
                <Textarea
                  id="notification-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Escribe el contenido de la notificación..."
                  required
                />
              </Field>

              <Button
                type="submit"
                size="lg"
                loading={loading}
                disabled={!selectedUser}
                className="w-full"
              >
                <Send aria-hidden size={16} strokeWidth={1.75} />
                {loading ? "Enviando..." : "Enviar Notificación"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
            <Lightbulb aria-hidden size={16} strokeWidth={1.75} />
            Ejemplo
          </h3>
          <p className="mb-1 text-sm text-slate-600">
            <strong>Título:</strong> Cambio en las políticas de uso
          </p>
          <p className="text-sm text-slate-600">
            <strong>Mensaje:</strong> Hemos actualizado nuestras políticas de privacidad. Por favor
            revisa los nuevos términos en tu perfil.
          </p>
        </div>
      </div>
    </Layout>
  );
}
