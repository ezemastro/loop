import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import UsersTable from "@/components/UsersTable";
import ModifyCreditsModal from "@/components/ModifyCreditsModal";
import ResetPasswordModal from "@/components/ResetPasswordModal";
import CommunityFilter from "@/components/CommunityFilter";
import { useCommunityScope } from "@/hooks/useCommunityScope";
import { AxiosError } from "axios";

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
      <div className="p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
          {isSuperAdmin && (
            <CommunityFilter
              communities={communities}
              value={selectedCommunityId}
              onChange={handleCommunityChange}
              allowAll
              loading={communitiesLoading}
            />
          )}
        </div>

        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="border border-gray-300 rounded px-3 py-2 flex-1"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Buscar
          </button>
        </form>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        <UsersTable
          users={users}
          loading={loading}
          onModifyCredits={setSelectedUserForCredits}
          onResetPassword={setSelectedUserForPassword}
        />

        {!loading && totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="px-4 py-2">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50"
            >
              Siguiente
            </button>
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
      </div>
    </Layout>
  );
}
