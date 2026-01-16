import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import adminApi from "@/api/adminApi";
import UsersTable from "@/components/UsersTable";
import ModifyCreditsModal from "@/components/ModifyCreditsModal";
import ResetPasswordModal from "@/components/ResetPasswordModal";

export default function Users() {
  const [users, setUsers] = useState<PrivateUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUserForCredits, setSelectedUserForCredits] =
    useState<PrivateUser | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] =
    useState<PrivateUser | null>(null);

  useEffect(() => {
    loadUsers();
  }, [page]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getUsers({
        page,
        search: search || undefined,
      });

      if (response.success && response.data) {
        setUsers(response.data.users);
        // Calcular páginas basado en total
        const total = response.data.total;
        setTotalPages(Math.ceil(total / 20)); // Asumiendo 20 por página
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cargar usuarios");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Gestión de Usuarios</h1>

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

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {error}
          </div>
        )}

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
