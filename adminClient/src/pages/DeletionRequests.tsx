import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import CommunityFilter from "@/components/CommunityFilter";
import adminApi from "@/api/adminApi";
import { useCommunityScope } from "@/hooks/useCommunityScope";
import { getErrorMessage } from "@/services/errors";
import { Archive } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  TBody,
  Table,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";

type Status = "pending" | "completed" | "rejected";

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendientes",
  completed: "Ejecutadas",
  rejected: "Rechazadas",
};

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Solicitudes de borrado de cuenta.
 *
 * El formulario público de la landing ya no borra nada: solo deja la solicitud registrada. El
 * borrado real se ejecuta desde acá, y es **irreversible**, así que pide confirmación en dos pasos.
 */
export default function DeletionRequests() {
  const {
    isSuperAdmin,
    scopeCommunityId,
    communities,
    communitiesLoading,
    selectedCommunityId,
    setSelectedCommunityId,
  } = useCommunityScope();

  const [requests, setRequests] = useState<AccountDeletionRequest[]>([]);
  const [status, setStatus] = useState<Status>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AccountDeletionRequest | null>(null);
  const [rejecting, setRejecting] = useState<AccountDeletionRequest | null>(null);
  const [resolving, setResolving] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.getDeletionRequests({
        status,
        ...(scopeCommunityId ? { communityId: scopeCommunityId } : {}),
      });
      setRequests(response.data?.deletionRequests ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron cargar las solicitudes"));
    } finally {
      setLoading(false);
    }
  }, [status, scopeCommunityId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const resolve = async (request: AccountDeletionRequest, action: "completed" | "rejected") => {
    setResolving(true);
    setError(null);
    try {
      await adminApi.resolveDeletionRequest(request.id, action);
      setConfirming(null);
      setRejecting(null);
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo resolver la solicitud"));
    } finally {
      setResolving(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Solicitudes de borrado"
        description="Pedidos hechos desde el formulario público de la landing. Ejecutar el borrado elimina la cuenta y todo su contenido, y no se puede deshacer."
        filters={
          <div className="flex flex-wrap items-center gap-3">
            {isSuperAdmin && (
              <CommunityFilter
                communities={communities}
                value={selectedCommunityId}
                onChange={setSelectedCommunityId}
                loading={communitiesLoading}
              />
            )}
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="w-auto"
            >
              {(Object.keys(STATUS_LABEL) as Status[]).map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABEL[key]}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <LoadingBlock />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Archive}
          title={`No hay solicitudes ${STATUS_LABEL[status].toLowerCase()}`}
          description={
            status === "pending"
              ? "Cuando alguien pida bajarse desde la landing, va a aparecer acá."
              : undefined
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Correo</Th>
                <Th>Usuario</Th>
                <Th>Solicitada</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </Tr>
            </THead>
            <TBody>
              {requests.map((request) => (
                <Tr key={request.id}>
                  <Td>{request.email}</Td>
                  <Td>
                    {request.user
                      ? `${request.user.firstName} ${request.user.lastName}`
                      : "Cuenta ya inexistente"}
                  </Td>
                  <Td>{formatDate(request.createdAt)}</Td>
                  <Td>
                    {request.status === "pending" ? (
                      <Badge tone="warning">Pendiente</Badge>
                    ) : request.status === "completed" ? (
                      <Badge tone="danger">Ejecutada</Badge>
                    ) : (
                      <Badge tone="neutral">Rechazada</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    {request.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setRejecting(request)}
                          disabled={resolving}
                        >
                          Rechazar
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setConfirming(request)}>
                          Borrar cuenta
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {request.resolvedAt ? formatDate(request.resolvedAt) : "—"}
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {/* Segundo paso: borrar una cuenta es irreversible, así que nunca se hace con un solo clic. */}
      <Modal
        isOpen={confirming !== null}
        onClose={() => setConfirming(null)}
        title="¿Borrar esta cuenta?"
        description={confirming?.email}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={resolving}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={resolving}
              onClick={() => confirming && void resolve(confirming, "completed")}
            >
              Sí, borrar definitivamente
            </Button>
          </>
        }
      >
        <Alert tone="error" title="Esta acción no se puede deshacer">
          Se eliminan la cuenta y todo su contenido: publicaciones, mensajes, notificaciones,
          misiones, movimientos de loopies y deseos.
        </Alert>
      </Modal>

      {/* Instancia separada de la de "Borrar cuenta": son dos acciones distintas y no se generalizan. */}
      <Modal
        isOpen={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="¿Rechazar esta solicitud?"
        description={rejecting?.email}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)} disabled={resolving}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={resolving}
              onClick={() => rejecting && void resolve(rejecting, "rejected")}
            >
              Sí, rechazar
            </Button>
          </>
        }
      >
        <Alert tone="warning">
          La cuenta queda activa; la solicitud de baja pasa a "Rechazadas".
        </Alert>
      </Modal>
    </Layout>
  );
}
