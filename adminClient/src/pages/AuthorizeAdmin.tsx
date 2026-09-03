import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import CommunityFilter from "@/components/CommunityFilter";
import adminApi from "@/api/adminApi";
import { useIsSuperAdmin } from "@/stores/session";
import { useCommunitiesStore } from "@/stores/communities";
import { getErrorMessage } from "@/services/errors";
import { emailSchema } from "@/services/validations";
import { Alert, Button, Card, CardBody, Field, Input, PageHeader, Select } from "@/components/ui";

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
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Autorizar Nuevo Administrador"
          description="Agrega un email a la lista de autorizados para registro de administradores"
        />

        {error && <Alert tone="error">{error}</Alert>}
        {success && (
          <Alert tone="success" className="mt-4">
            {success}
          </Alert>
        )}

        <Card className="mt-4">
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email del nuevo administrador" htmlFor="authorize-email" required>
                <Input
                  id="authorize-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ejemplo.com"
                  required
                />
                <p className="text-meta mt-2 text-slate-500">
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

              <Button
                type="submit"
                size="lg"
                loading={loading}
                disabled={missingCommunity}
                className="w-full"
              >
                {loading ? "Autorizando..." : "Autorizar Email"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <Alert tone="info" title="¿Cómo funciona?" className="mt-8">
          <ol className="mt-1 list-inside list-decimal space-y-2">
            <li>Ingresa el email de la persona que quieres autorizar</li>
            <li>El email se agregará a la lista de permitidos</li>
            <li>La persona podrá ir a la página de registro y crear su cuenta de administrador</li>
            <li>Solo los emails autorizados pueden registrarse como administradores</li>
          </ol>
        </Alert>
      </div>
    </Layout>
  );
}
