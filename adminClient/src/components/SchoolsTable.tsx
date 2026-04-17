import { getUrl } from "@/services/getUrl";

interface SchoolWithStats extends School {
  stats?: {
    kgWaste: number;
    kgCo2: number;
    lH2o: number;
  };
}

interface SchoolsTableProps {
  schools: SchoolWithStats[];
  loading: boolean;
  onEdit?: (school: School) => void;
}

export default function SchoolsTable({
  schools,
  loading,
  onEdit,
}: SchoolsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando escuelas...</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Logo</th>
            <th className="px-4 py-3 text-left font-semibold">Nombre</th>
            <th className="px-4 py-3 text-left font-semibold">
              Kg Residuos Evitados
            </th>
            <th className="px-4 py-3 text-left font-semibold">
              Kg CO₂ Evitados
            </th>
            <th className="px-4 py-3 text-left font-semibold">
              Litros H₂O Ahorrados
            </th>
            <th className="px-4 py-3 text-left font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((school) => (
            <tr key={school.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-3">
                <img
                  src={getUrl(school.media.url)}
                  alt={school.name}
                  className="w-12 h-12 object-cover rounded"
                />
              </td>
              <td className="px-4 py-3 font-semibold">{school.name}</td>
              <td className="px-4 py-3">
                {school.stats?.kgWaste.toFixed(2) ?? "N/A"} kg
              </td>
              <td className="px-4 py-3">
                {school.stats?.kgCo2.toFixed(2) ?? "N/A"} kg
              </td>
              <td className="px-4 py-3">
                {school.stats?.lH2o.toFixed(2) ?? "N/A"} L
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onEdit?.(school)}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition"
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {schools.length === 0 && (
        <p className="text-center py-8 text-gray-500">
          No hay escuelas registradas
        </p>
      )}
    </div>
  );
}
