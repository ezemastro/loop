import { api } from "@/api/loop";
import { useQuery } from "@tanstack/react-query";

const fetchCategories = async () => {
  const response = await api.get<GetCategoriesResponse>("/categories");
  return {
    categories: response.data.data!.categories,
  };
};

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
};
