import { inCommunity, unscoped, withClient } from "../services/postgresClient.js";
import type { GetCategoriesPayload } from "../types/models";
import { getAllCategories } from "../utils/helpersDb";

export class CategoriesModel {
  /**
   * El catálogo de categorías es compartido entre comunidades a propósito, así que las queries no
   * llevan filtro y el resultado es el mismo con cualquiera de los dos scopes. Se usa el de la
   * sesión cuando la hay solo para no mandar todo el tráfico al pool unscoped, que es chico
   * (4 conexiones) y está reservado para auth y admin.
   */
  static getCategories = async ({ communityId }: GetCategoriesPayload) => {
    return withClient(
      async (client) => {
        const categories = await getAllCategories({ client });
        return { categories };
      },
      { scope: communityId ? inCommunity(communityId) : unscoped("public:communities") },
    );
  };
}
