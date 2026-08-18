import { on } from "../router";
import { categoryTree } from "../state";

export const registerCategoriesHandlers = () => {
  on("get", "/categories", () => {
    return { data: { success: true, data: { categories: categoryTree() } } };
  });
};
