interface MissionsTableProps {
  missions: MissionTemplate[];
  loading: boolean;
  onEdit: (mission: MissionTemplate) => void;
}

export default function MissionsTable({
  missions,
  loading,
  onEdit,
}: MissionsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando misiones...</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Clave</th>
            <th className="px-4 py-3 text-left font-semibold">Título</th>
            <th className="px-4 py-3 text-left font-semibold">Recompensa</th>
            <th className="px-4 py-3 text-left font-semibold">Estado</th>
            <th className="px-4 py-3 text-left font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {missions.map((mission) => (
            <tr key={mission.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-3">
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {mission.key}
                </span>
              </td>
              <td className="px-4 py-3">
                <div>
                  <div className="font-semibold">{mission.title}</div>
                  {mission.description && (
                    <div className="text-sm text-gray-600 max-w-xs truncate">
                      {mission.description}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="font-semibold text-green-600">
                  {mission.rewardCredits} créditos
                </span>
              </td>
              <td className="px-4 py-3">
                {mission.active ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                    Activa
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                    Inactiva
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onEdit(mission)}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {missions.length === 0 && (
        <p className="text-center py-8 text-gray-500">
          No hay misiones registradas
        </p>
      )}
    </div>
  );
}
