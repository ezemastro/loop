import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { commonApi } from "@/api/commonApi";
import CategoriesTable from "@/components/CategoriesTable";
import CategoryFormModal from "@/components/CategoryFormModal";
import { AxiosError } from "axios";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await commonApi.getCategories();
      if (response.success && response.data) {
        setCategories(response.data.categories);
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || "Error al cargar categorías");
      } else {
        setError("Error al cargar categorías");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Gestión de Categorías</h1>
          <button
            onClick={() => {
              setEditingCategory(null);
              setShowModal(true);
            }}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
          >
            + Nueva Categoría
          </button>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {error}
          </div>
        )}

        <CategoriesTable
          categories={categories}
          loading={loading}
          onEdit={handleEdit}
        />

        <CategoryFormModal
          category={editingCategory}
          categories={categories}
          isOpen={showModal}
          onClose={handleCloseModal}
          onSuccess={loadCategories}
        />
      </div>
    </Layout>
  );
}
