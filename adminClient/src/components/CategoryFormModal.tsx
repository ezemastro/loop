import { useState, useEffect } from "react";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";

interface CategoryFormModalProps {
  category?: Category | null;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentCategoryId?: string;
}

export default function CategoryFormModal({
  category,
  categories,
  isOpen,
  onClose,
  onSuccess,
  parentCategoryId,
}: CategoryFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    parentId: "",
    icon: "",
    minPriceCredits: "",
    maxPriceCredits: "",
    statKgWaste: "",
    statKgCo2: "",
    statLH2o: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || "",
        description: category.description || "",
        parentId: category.parentId || "",
        icon: category.icon || "",
        minPriceCredits: category.price?.min?.toString() || "",
        maxPriceCredits: category.price?.max?.toString() || "",
        statKgWaste: category.stats?.kgWaste?.toString() || "",
        statKgCo2: category.stats?.kgCo2?.toString() || "",
        statLH2o: category.stats?.lH2o?.toString() || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        parentId: parentCategoryId || "",
        icon: "",
        minPriceCredits: "",
        maxPriceCredits: "",
        statKgWaste: "",
        statKgCo2: "",
        statLH2o: "",
      });
    }
  }, [category, parentCategoryId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        parentId: formData.parentId || undefined,
        icon: formData.icon || undefined,
        minPriceCredits: formData.minPriceCredits
          ? parseInt(formData.minPriceCredits)
          : undefined,
        maxPriceCredits: formData.maxPriceCredits
          ? parseInt(formData.maxPriceCredits)
          : undefined,
        statKgWaste: formData.statKgWaste
          ? parseFloat(formData.statKgWaste)
          : undefined,
        statKgCo2: formData.statKgCo2
          ? parseFloat(formData.statKgCo2)
          : undefined,
        statLH2o: formData.statLH2o ? parseFloat(formData.statLH2o) : undefined,
      };

      if (category) {
        const response = await adminApi.updateCategory(category.id, data);
        if (response.success) {
          alert("Categoría actualizada exitosamente");
        }
      } else {
        const response = await adminApi.createCategory(data);
        if (response.success) {
          alert("Categoría creada exitosamente");
        }
      }

      handleClose();
      onSuccess();
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Error al guardar categoría");
      } else {
        setError("Error al guardar categoría");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  // Aplanar todas las categorías y subcategorías con información de nivel
  const flattenCategories = (
    cats: Category[],
  ): Array<Category & { level: number }> => {
    const result: Array<Category & { level: number }> = [];
    const flatten = (cat: Category, level: number = 0) => {
      result.push({ ...cat, level });
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach((child) => flatten(child, level + 1));
      }
    };
    cats.forEach((cat) => flatten(cat, 0));
    return result;
  };

  const allCategories = flattenCategories(categories);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {category ? "Editar Categoría" : "Crear Categoría"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block mb-2 font-semibold">Nombre*:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block mb-2 font-semibold">Descripción:</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                rows={3}
              />
            </div>

            {/* <div>
              <label className="block mb-2 font-semibold">Icono:</label>
              <input
                type="text"
                name="icon"
                value={formData.icon}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                placeholder="🎒"
              />
            </div> */}

            <div className="col-span-2">
              <label className="block mb-2 font-semibold">
                Categoría Padre:
              </label>
              <select
                name="parentId"
                value={formData.parentId}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
              >
                <option value="">Ninguna</option>
                {allCategories
                  .filter((c) => c.id !== category?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {"\u00A0\u00A0".repeat(c.level)}
                      {c.level > 0 ? "└ " : ""}
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-semibold">
                Precio Mín (Créditos):
              </label>
              <input
                type="number"
                name="minPriceCredits"
                value={formData.minPriceCredits}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                min="0"
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold">
                Precio Máx (Créditos):
              </label>
              <input
                type="number"
                name="maxPriceCredits"
                value={formData.maxPriceCredits}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                min="0"
              />
            </div>

            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="font-semibold mb-3">Estadísticas Ambientales</h3>
            </div>

            <div>
              <label className="block mb-2">Kg Residuos:</label>
              <input
                type="number"
                name="statKgWaste"
                value={formData.statKgWaste}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <label className="block mb-2">Kg CO₂:</label>
              <input
                type="number"
                name="statKgCo2"
                value={formData.statKgCo2}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <label className="block mb-2">Litros H₂O:</label>
              <input
                type="number"
                name="statLH2o"
                value={formData.statLH2o}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 w-full"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 flex-1"
            >
              {loading ? "Guardando..." : category ? "Actualizar" : "Crear"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 disabled:opacity-50 flex-1"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
