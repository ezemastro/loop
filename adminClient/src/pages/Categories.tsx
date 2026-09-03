import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { commonApi } from "@/api/commonApi";
import CategoriesTable from "@/components/CategoriesTable";
import CategoryFormModal from "@/components/CategoryFormModal";
import { Alert, Button, PageHeader } from "@/components/ui";
import { AxiosError } from "axios";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentCategoryId, setParentCategoryId] = useState<string | undefined>();

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
    setParentCategoryId(undefined);
    setShowModal(true);
  };

  const handleAddSubcategory = (parentCategory: Category) => {
    setEditingCategory(null);
    setParentCategoryId(parentCategory.id);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setParentCategoryId(undefined);
  };

  return (
    <Layout>
      <PageHeader
        title="Gestión de Categorías"
        actions={
          <Button
            onClick={() => {
              setEditingCategory(null);
              setParentCategoryId(undefined);
              setShowModal(true);
            }}
          >
            Nueva Categoría
          </Button>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      <CategoriesTable
        categories={categories}
        loading={loading}
        onEdit={handleEdit}
        onAddSubcategory={handleAddSubcategory}
      />

      <CategoryFormModal
        category={editingCategory}
        categories={categories}
        isOpen={showModal}
        onClose={handleCloseModal}
        onSuccess={loadCategories}
        parentCategoryId={parentCategoryId}
      />
    </Layout>
  );
}
