import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useQuery } from "@tanstack/react-query";

const fetchCategories = async () => {
  try {
    const response = await api.get<GetCategoriesResponse>("/categories");
    return {
      categories: response.data.data!.categories,
    };
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
};
