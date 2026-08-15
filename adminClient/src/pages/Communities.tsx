import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import CommunityFormModal from "@/components/CommunityFormModal";
import adminApi, { type AdminCommunity } from "@/api/adminApi";
import { useCommunitiesStore } from "@/stores/communities";
import { getErrorMessage } from "@/services/errors";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  LoadingBlock,
  PageHeader,
} from "@/components/ui";

/**
 * Gestión de comunidades. Solo super admin (la ruta está protegida con `RequireSuperAdmin`).
 *
 * Es la única página donde se ve más de una comunidad a la vez, así que muestra los colores de cada
 * una como muestras, pero el panel en sí no se tematiza: sería confuso.
 */
export default function Communities() {
  const communities = useCommunitiesStore((state) => state.communities);
  const loading = useCommunitiesStore((state) => state.loading);
  const storeError = useCommunitiesStore((state) => state.error);
  const load = useCommunitiesStore((state) => state.load);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCommunity | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = () => load({ force: true });

  const openCreate = () => {
    setEditing(null);
    setIsFormOpen(true);
  };
  const openEdit = (community: AdminCommunity) => {
    setEditing(community);
    setIsFormOpen(true);
  };

  return (
    <Layout>
      <PageHeader
        title="Comunidades"
        description="Cada comunidad agrupa colegios y está aislada del resto: sus usuarios no ven publicaciones, personas ni mensajes de otra."
        actions={<Button onClick={openCreate}>Nueva comunidad</Button>}
      />

      {storeError && <Alert tone="error">{storeError}</Alert>}

      {loading && communities.length === 0 ? (
        <LoadingBlock />
      ) : communities.length === 0 ? (
        <EmptyState
          icon="🏙️"
          title="Todavía no hay comunidades"
          description="Creá la primera para empezar a recibir usuarios."
          action={<Button onClick={openCreate}>Nueva comunidad</Button>}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {communities.map((community) => (
            <CommunityCard
              key={community.id}
              community={community}
              onEdit={() => openEdit(community)}
              onChanged={reload}
            />
          ))}
        </div>
      )}

      <CommunityFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={reload}
        community={editing}
      />
    </Layout>
  );
}

function CommunityCard({
  community,
  onEdit,
  onChanged,
}: {
  community: AdminCommunity;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const colors = community.theme?.colors;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-3">
            {community.media?.url ? (
              <img
                src={community.media.url}
                alt=""
                className="h-9 w-9 rounded-lg border border-slate-200 object-contain"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                🏙️
              </span>
            )}
            {community.name}
            {!community.active && <Badge tone="warning">Inactiva</Badge>}
          </span>
        }
        description={<code className="text-xs text-slate-500">{community.slug}</code>}
        action={
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Editar
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Usuarios" value={community.stats?.users ?? 0} />
          <Metric label="Colegios" value={community.stats?.schools ?? 0} />
          <Metric label="Publicaciones" value={community.stats?.listings ?? 0} />
        </div>

        {colors && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(colors).map(([key, value]) => (
              <span
                key={key}
                title={`${key}: ${value}`}
                className="h-5 w-5 rounded border border-slate-200"
                style={{ background: value }}
              />
            ))}
          </div>
        )}

        <CommunityDomains community={community} onChanged={onChanged} />
      </CardBody>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

/**
 * Dominios de correo de la comunidad.
 *
 * Son la puerta de entrada: el dominio del correo de quien se registra es lo que decide en qué
 * comunidad entra. Un dominio pertenece a una sola comunidad, y el backend lo hace cumplir con un
 * índice único — de ahí el error dedicado.
 */
function CommunityDomains({
  community,
  onChanged,
}: {
  community: AdminCommunity;
  onChanged: () => void;
}) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const value = domain.trim().toLowerCase();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.addCommunityDomain(community.id, value);
      setDomain("");
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo agregar el dominio"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (domainId: UUID) => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.removeCommunityDomain(community.id, domainId);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo quitar el dominio"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Dominios de correo
      </p>

      {community.domains.length === 0 ? (
        <p className="mb-2 text-sm text-slate-500">
          Sin dominios: nadie puede registrarse solo, únicamente por invitación.
        </p>
      ) : (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {community.domains.map((entry) => (
            <span
              key={entry.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-1 pl-2.5 text-xs font-medium text-slate-700"
            >
              @{entry.domain}
              <button
                type="button"
                onClick={() => void remove(entry.id)}
                disabled={busy}
                aria-label={`Quitar ${entry.domain}`}
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-300 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="colegio.edu.ar"
          disabled={busy}
        />
        <Button variant="secondary" onClick={add} loading={busy} disabled={!domain.trim()}>
          Agregar
        </Button>
      </div>

      {error && (
        <Alert tone="error" className="mt-2">
          {error}
        </Alert>
      )}
    </div>
  );
}
