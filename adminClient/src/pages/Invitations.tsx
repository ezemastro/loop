import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import CommunityFilter from "@/components/CommunityFilter";
import adminApi from "@/api/adminApi";
import { useCommunityScope } from "@/hooks/useCommunityScope";
import { getErrorMessage } from "@/services/errors";
import { Mail } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  TBody,
  Table,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";

type InvitationState = "used" | "expired" | "available";

const stateOf = (invitation: Invitation): InvitationState => {
  if (invitation.usedAt || invitation.usedByUserId) return "used";
  if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) return "expired";
  return "available";
};

const formatDate = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/**
 * Invitaciones de un solo uso.
 *
 * Existen para el caso que la restricción por dominio deja afuera: alguien que necesita entrar y no
 * tiene correo institucional. Quien use el link entra a la comunidad del admin que lo generó.
 */
export default function Invitations() {
  const {
    isSuperAdmin,
    scopeCommunityId,
    targetCommunityId,
    communities,
    communitiesLoading,
    selectedCommunityId,
    setSelectedCommunityId,
  } = useCommunityScope();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<Invitation | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [revokingInFlight, setRevokingInFlight] = useState(false);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.getInvitations({
        ...(scopeCommunityId ? { communityId: scopeCommunityId } : {}),
      });
      setInvitations(response.data?.invitations ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron cargar las invitaciones"));
    } finally {
      setLoading(false);
    }
  }, [scopeCommunityId]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const handleCreate = async () => {
    // Un super admin no tiene comunidad propia, así que tiene que elegir una en el filtro de arriba.
    if (isSuperAdmin && !targetCommunityId) {
      return setError("Elegí una comunidad antes de generar la invitación.");
    }
    setCreating(true);
    setError(null);
    try {
      const days = Number(expiresInDays);
      const response = await adminApi.createInvitation({
        ...(isSuperAdmin && targetCommunityId ? { communityId: targetCommunityId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(Number.isFinite(days) && days > 0 ? { expiresInDays: days } : {}),
      });
      const created = response.data?.invitation ?? null;
      setLastCreated(created);
      setNote("");
      setExpiresInDays("");
      await loadInvitations();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo generar la invitación"));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (invitation: Invitation) => {
    await navigator.clipboard.writeText(invitation.url);
    setCopiedToken(invitation.token);
    window.setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevoke = async (invitation: Invitation) => {
    setError(null);
    setRevokingInFlight(true);
    try {
      await adminApi.deleteInvitation(invitation.id, {
        ...(scopeCommunityId ? { communityId: scopeCommunityId } : {}),
      });
      if (lastCreated?.id === invitation.id) setLastCreated(null);
      setRevoking(null);
      await loadInvitations();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo revocar la invitación"));
    } finally {
      setRevokingInFlight(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Invitaciones"
        description="Un enlace de un solo uso para que alguien se registre con un correo que no es institucional. Entra a la comunidad desde la que se generó el enlace."
        filters={
          isSuperAdmin ? (
            <CommunityFilter
              communities={communities}
              value={selectedCommunityId}
              onChange={setSelectedCommunityId}
              loading={communitiesLoading}
            />
          ) : undefined
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      <Card className="mb-6">
        <CardHeader
          title="Generar invitación"
          description="El enlace queda disponible hasta que alguien lo use o lo revoques."
        />
        <CardBody>
          <div className="grid items-end gap-4 sm:grid-cols-[2fr_1fr_auto]">
            <Field label="Nota" hint="Para acordarte a quién se la diste. Opcional.">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mamá de Juan, 3ºB"
              />
            </Field>
            <Field label="Vence en (días)" hint="Vacío = sin vencimiento.">
              <Input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="30"
              />
            </Field>
            <Button onClick={handleCreate} loading={creating}>
              Generar
            </Button>
          </div>

          {lastCreated && (
            <Alert tone="success" title="Invitación lista" className="mt-4">
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={lastCreated.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-xs text-slate-700"
                />
                <Button variant="secondary" onClick={() => void handleCopy(lastCreated)}>
                  {copiedToken === lastCreated.token ? "¡Copiado!" : "Copiar"}
                </Button>
              </div>
            </Alert>
          )}
        </CardBody>
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : invitations.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Todavía no generaste ninguna invitación"
          description="Las personas con correo institucional se registran solas, sin necesidad de enlace."
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Estado</Th>
                <Th>Nota</Th>
                {isSuperAdmin && <Th>Comunidad</Th>}
                <Th>Creada</Th>
                <Th>Vence</Th>
                <Th>Usada por</Th>
                <Th className="text-right">Acciones</Th>
              </Tr>
            </THead>
            <TBody>
              {invitations.map((invitation) => {
                const state = stateOf(invitation);
                return (
                  <Tr key={invitation.id}>
                    <Td>
                      {state === "used" ? (
                        <Badge tone="neutral">Usada</Badge>
                      ) : state === "expired" ? (
                        <Badge tone="warning">Vencida</Badge>
                      ) : (
                        <Badge tone="success">Disponible</Badge>
                      )}
                    </Td>
                    <Td>{invitation.note || <span className="text-slate-400">—</span>}</Td>
                    {isSuperAdmin && <Td>{invitation.community?.name ?? "—"}</Td>}
                    <Td>{formatDate(invitation.createdAt)}</Td>
                    <Td>{formatDate(invitation.expiresAt)}</Td>
                    <Td>
                      {invitation.usedByUser
                        ? `${invitation.usedByUser.firstName} ${invitation.usedByUser.lastName}`
                        : "—"}
                    </Td>
                    <Td className="text-right">
                      {state === "used" ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleCopy(invitation)}
                          >
                            {copiedToken === invitation.token ? "¡Copiado!" : "Copiar"}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setRevoking(invitation)}
                          >
                            Revocar
                          </Button>
                        </div>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      {/* Revocar es irreversible: pide confirmación en dos pasos, igual que las bajas de cuenta. */}
      <Modal
        isOpen={revoking !== null}
        onClose={() => setRevoking(null)}
        title="¿Revocar esta invitación?"
        description={
          revoking?.note || `Invitación sin nota (token ${revoking?.token.slice(0, 8)}…)`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)} disabled={revokingInFlight}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={revokingInFlight}
              onClick={() => revoking && void handleRevoke(revoking)}
            >
              Sí, revocar
            </Button>
          </>
        }
      >
        <Alert tone="warning">
          El enlace deja de funcionar de inmediato. Esta acción no se puede deshacer.
        </Alert>
      </Modal>
    </Layout>
  );
}
