import { useState, type JSX } from "react";

interface CategoriesTableProps {
  categories: Category[];
  loading: boolean;
  onEdit: (category: Category) => void;
  onAddSubcategory: (parentCategory: Category) => void;
}

export default function CategoriesTable({
  categories,
  loading,
  onEdit,
  onAddSubcategory,
}: CategoriesTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando categorías...</div>
      </div>
    );
  }

  const toggleExpand = (categoryId: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const renderCategoryRow = (
    category: Category,
    level: number = 0,
  ): JSX.Element[] => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedIds.has(category.id);
    const rows: JSX.Element[] = [];

    rows.push(
      <tr key={category.id} className="border-t hover:bg-gray-50">
        <td className="px-4 py-3">
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${level * 24}px` }}
          >
            {hasChildren && (
              <button
                onClick={() => toggleExpand(category.id)}
                className="text-gray-600 hover:text-gray-800 w-5 h-5 flex items-center justify-center"
              >
                {isExpanded ? "▼" : "▶"}
              </button>
            )}
            {!hasChildren && <span className="w-5" />}
            {category.icon && <span className="text-xl">{category.icon}</span>}
            <span className="font-semibold">{category.name}</span>
            {hasChildren && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {category.children!.length} sub
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 truncate">{category.description || ""}</td>
        <td className="px-4 py-3">
          {category.price?.min && category.price?.max
            ? `${category.price.min} - ${category.price.max}`
            : ""}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(category)}
              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
            >
              Editar
            </button>
            <button
              onClick={() => onAddSubcategory(category)}
              className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm font-bold"
              title="Agregar subcategoría"
            >
              +
            </button>
          </div>
        </td>
      </tr>,
    );

    // Si está expandida, renderizar sus hijos
    if (isExpanded && hasChildren) {
      category.children!.forEach((child) => {
        rows.push(...renderCategoryRow(child, level + 1));
      });
    }

    return rows;
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full table-fixed">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left font-semibold w-[40%]">
              Nombre
            </th>
            <th className="px-4 py-3 text-left font-semibold w-[35%]">
              Descripción
            </th>
            <th className="px-4 py-3 text-left font-semibold w-[15%]">
              Rango Precio
            </th>
            <th className="px-4 py-3 text-left font-semibold w-[10%]">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {categories
            .filter((cat) => !cat.parentId)
            .flatMap((category) => renderCategoryRow(category, 0))}
        </tbody>
      </table>

      {categories.length === 0 && (
        <p className="text-center py-8 text-gray-500">
          No hay categorías registradas
        </p>
      )}
    </div>
  );
}
