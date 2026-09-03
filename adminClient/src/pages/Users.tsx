import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import UsersTable from "@/components/UsersTable";
import ModifyCreditsModal from "@/components/ModifyCreditsModal";
import ResetPasswordModal from "@/components/ResetPasswordModal";
import CommunityFilter from "@/components/CommunityFilter";
import { useCommunityScope } from "@/hooks/useCommunityScope";
import { AxiosError } from "axios";
import { Alert, Button, Input, PageHeader } from "@/components/ui";

/** Respaldo cuando la respuesta no trae `pagination` (revert independiente del lado servidor). Ver `server/api/src/config.ts:156`. */
const DEFAULT_PAGE_SIZE = 10;

export default function Users() {
  const [users, setUsers] = useState<PrivateUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUserForCredits, setSelectedUserForCredits] = useState<PrivateUser | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<PrivateUser | null>(null);

  const {
    isSuperAdmin,
    communities,
    communitiesLoading,
    selectedCommunityId,
    setSelectedCommunityId,
    scopeCommunityId,
  } = useCommunityScope();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getUsers({
        page,
        search: search || undefined,
        ...(scopeCommunityId ? { communityId: scopeCommunityId } : {}),
      });

      if (response.success && response.data) {
        setUsers(response.data.users);
        // Calcular páginas basado en el tamaño de página que reporta el servidor.
        const total = response.data.total;
        const pageSize = response.pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
        setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Error al cargar usuarios");
      } else {
        setError("Error al cargar usuarios");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, scopeCommunityId]);

  useEffect(() => {
    loadUsers();
  }, [page, loadUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleCommunityChange = (communityId: UUID | null) => {
    setSelectedCommunityId(communityId);
    setPage(1);
  };

  return (
    <Layout>
      <PageHeader
        title="Gestión de Usuarios"
        filters={
          <>
            {isSuperAdmin && (
              <CommunityFilter
                communities={communities}
                value={selectedCommunityId}
                onChange={handleCommunityChange}
                allowAll
                loading={communitiesLoading}
              />
            )}
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="flex-1"
              />
              <Button type="submit">Buscar</Button>
            </form>
          </>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      <UsersTable
        users={users}
        loading={loading}
        onModifyCredits={setSelectedUserForCredits}
        onResetPassword={setSelectedUserForPassword}
      />

      {!loading && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="secondary" onClick={() => setPage(page - 1)} disabled={page === 1}>
            Anterior
          </Button>
          <span className="text-body px-4 py-2 text-slate-600">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {selectedUserForCredits && (
        <ModifyCreditsModal
          user={selectedUserForCredits}
          isOpen={!!selectedUserForCredits}
          onClose={() => setSelectedUserForCredits(null)}
          onSuccess={loadUsers}
        />
      )}

      {selectedUserForPassword && (
        <ResetPasswordModal
          user={selectedUserForPassword}
          isOpen={!!selectedUserForPassword}
          onClose={() => setSelectedUserForPassword(null)}
          onSuccess={loadUsers}
        />
      )}
    </Layout>
  );
}
