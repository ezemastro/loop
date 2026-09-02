import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import CommunityFilter from "@/components/CommunityFilter";
import adminApi from "@/api/adminApi";
import { useIsSuperAdmin } from "@/stores/session";
import { useCommunitiesStore } from "@/stores/communities";
import { getErrorMessage } from "@/services/errors";
import { emailSchema } from "@/services/validations";
import { Field, Select } from "@/components/ui";

type GrantRole = "community_admin" | "super_admin";

export default function AuthorizeAdmin() {
  const isSuperAdmin = useIsSuperAdmin();
  const communities = useCommunitiesStore((state) => state.communities);
  const communitiesLoading = useCommunitiesStore((state) => state.loading);
  const loadCommunities = useCommunitiesStore((state) => state.load);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GrantRole>("community_admin");
  const [communityId, setCommunityId] = useState<UUID | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Solo un super admin puede elegir comunidad al autorizar: para el resto la comunidad la fija el token.
  useEffect(() => {
    if (isSuperAdmin) void loadCommunities();
  }, [isSuperAdmin, loadCommunities]);

  const needsCommunity = isSuperAdmin && role === "community_admin";
  const missingCommunity = needsCommunity && !communityId;

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

    if (missingCommunity) {
      setError("Hay que elegir una comunidad para esta acción.");
      return;
    }

    try {
      setLoading(true);
      const response = await adminApi.addValidEmailForRegistration(email, {
        role: isSuperAdmin ? role : undefined,
        communityId: needsCommunity && communityId ? communityId : undefined,
      });

      if (response.success) {
        setSuccess(
          `Email ${email} autorizado exitosamente. Ahora puede registrarse como administrador.`,
        );
        setEmail("");
        setRole("community_admin");
        setCommunityId(null);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Error al autorizar el email. Puede que ya esté autorizado."));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Autorizar Nuevo Administrador</h1>
        <p className="text-gray-600 mb-6">
          Agrega un email a la lista de autorizados para registro de administradores
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
            <Field label="Email del nuevo administrador" htmlFor="authorize-email" required>
              <input
                id="authorize-email"
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
            </Field>

            {isSuperAdmin && (
              <Field label="Rol a otorgar" htmlFor="authorize-role" required>
                <Select
                  id="authorize-role"
                  value={role}
                  onChange={(e) => {
                    const nextRole = e.target.value as GrantRole;
                    setRole(nextRole);
                    if (nextRole === "super_admin") setCommunityId(null);
                  }}
                >
                  <option value="community_admin">Administrador de comunidad</option>
                  <option value="super_admin">Super administrador</option>
                </Select>
              </Field>
            )}

            {needsCommunity && (
              <CommunityFilter
                communities={communities}
                value={communityId}
                onChange={setCommunityId}
                allowAll={false}
                loading={communitiesLoading}
                label="Comunidad"
              />
            )}

            <button
              type="submit"
              disabled={loading || missingCommunity}
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
            <li>La persona podrá ir a la página de registro y crear su cuenta de administrador</li>
            <li>Solo los emails autorizados pueden registrarse como administradores</li>
          </ol>
        </div>
      </div>
    </Layout>
  );
}
