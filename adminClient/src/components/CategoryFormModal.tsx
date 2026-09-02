import { useEffect, useState } from "react";
import adminApi from "@/api/adminApi";
import { getErrorMessage } from "@/services/errors";
import { Alert, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";

interface CategoryFormModalProps {
  category?: Category | null;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentCategoryId?: string;
}

const FORM_ID = "category-form";

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
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);

    try {
      setLoading(true);
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        parentId: formData.parentId || undefined,
        icon: formData.icon || undefined,
        minPriceCredits: formData.minPriceCredits ? Number(formData.minPriceCredits) : undefined,
        maxPriceCredits: formData.maxPriceCredits ? Number(formData.maxPriceCredits) : undefined,
        statKgWaste: formData.statKgWaste ? parseFloat(formData.statKgWaste) : undefined,
        statKgCo2: formData.statKgCo2 ? parseFloat(formData.statKgCo2) : undefined,
        statLH2o: formData.statLH2o ? parseFloat(formData.statLH2o) : undefined,
      };

      if (category) {
        const response = await adminApi.updateCategory(category.id, data);
        if (response.success) {
          setFeedback({ type: "success", message: "Categoría actualizada exitosamente" });
        }
      } else {
        const response = await adminApi.createCategory(data);
        if (response.success) {
          setFeedback({ type: "success", message: "Categoría creada exitosamente" });
        }
      }

      handleClose();
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Error al guardar categoría"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setFeedback(null);
    onClose();
  };

  const flattenCategories = (cats: Category[]): Array<Category & { level: number }> => {
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={category ? "Editar categoría" : "Crear categoría"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={loading}>
            {category ? "Actualizar" : "Crear"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre" htmlFor="category-name" required className="col-span-2">
            <Input
              id="category-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </Field>

          <Field label="Descripción" htmlFor="category-description" className="col-span-2">
            <Textarea
              id="category-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
            />
          </Field>

          <Field label="Categoría padre" htmlFor="category-parent" className="col-span-2">
            <Select
              id="category-parent"
              name="parentId"
              value={formData.parentId}
              onChange={handleChange}
            >
              <option value="">Ninguna</option>
              {allCategories
                .filter((c) => c.id !== category?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  ".repeat(c.level)}
                    {c.level > 0 ? "└ " : ""}
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Precio mín (créditos)" htmlFor="category-min-price">
            <Input
              id="category-min-price"
              type="number"
              name="minPriceCredits"
              value={formData.minPriceCredits}
              onChange={handleChange}
              min="0"
            />
          </Field>

          <Field label="Precio máx (créditos)" htmlFor="category-max-price">
            <Input
              id="category-max-price"
              type="number"
              name="maxPriceCredits"
              value={formData.maxPriceCredits}
              onChange={handleChange}
              min="0"
            />
          </Field>

          <div className="col-span-2 mt-2 border-t border-slate-200 pt-4">
            <h3 className="mb-3 font-semibold text-slate-800">Estadísticas ambientales</h3>
          </div>

          <Field label="Kg residuos" htmlFor="category-kg-waste">
            <Input
              id="category-kg-waste"
              type="number"
              name="statKgWaste"
              value={formData.statKgWaste}
              onChange={handleChange}
              step="0.01"
              min="0"
            />
          </Field>

          <Field label="Kg CO₂" htmlFor="category-kg-co2">
            <Input
              id="category-kg-co2"
              type="number"
              name="statKgCo2"
              value={formData.statKgCo2}
              onChange={handleChange}
              step="0.01"
              min="0"
            />
          </Field>

          <Field label="Litros H₂O" htmlFor="category-l-h2o">
            <Input
              id="category-l-h2o"
              type="number"
              name="statLH2o"
              value={formData.statLH2o}
              onChange={handleChange}
              step="0.01"
              min="0"
            />
          </Field>
        </div>

        {feedback && (
          <Alert tone="success" className="mt-4">
            {feedback.message}
          </Alert>
        )}
        {error && (
          <Alert tone="error" className="mt-4">
            {error}
          </Alert>
        )}
      </form>
    </Modal>
  );
}
