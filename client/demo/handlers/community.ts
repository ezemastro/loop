import { on, type DemoContext } from "../router";
import { DEMO_COMMUNITY } from "../db/community";

export const registerCommunityHandlers = () => {
  // Cualquier dominio resuelve a la comunidad demo, así el registro no bloquea.
  on("get", "/communities/resolve", (_ctx: DemoContext) => {
    return { data: { success: true, data: { community: DEMO_COMMUNITY } } };
  });
};
