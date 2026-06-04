import { withClient } from "../services/postgresClient.js";
import { getAllCategories } from "../utils/helpersDb";

export class CategoriesModel {
  static getCategories = async () => {
    return withClient(async (client) => {
      const categories = await getAllCategories({ client });
      return { categories };
    });
  };
}
