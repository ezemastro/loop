interface UsersTableProps {
  users: PrivateUser[];
  loading: boolean;
  onModifyCredits: (user: PrivateUser) => void;
  onResetPassword: (user: PrivateUser) => void;
}

export default function UsersTable({
  users,
  loading,
  onModifyCredits,
  onResetPassword,
}: UsersTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando usuarios...</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Nombre</th>
            <th className="px-4 py-3 text-left font-semibold">Email</th>
            <th className="px-4 py-3 text-left font-semibold">Créditos</th>
            <th className="px-4 py-3 text-left font-semibold">Escuelas</th>
            <th className="px-4 py-3 text-left font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-3 font-semibold">
                {user.firstName} {user.lastName}
              </td>
              <td className="px-4 py-3">{user.email}</td>
              <td className="px-4 py-3">{user.credits.balance}</td>
              <td className="px-4 py-3">
                {user.schools.map((s) => s.name).join(", ") || "N/A"}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => onModifyCredits(user)}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm"
                  >
                    Créditos
                  </button>
                  <button
                    onClick={() => onResetPassword(user)}
                    className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 text-sm"
                  >
                    Password
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <p className="text-center py-8 text-gray-500">
          No se encontraron usuarios
        </p>
      )}
    </div>
  );
}
