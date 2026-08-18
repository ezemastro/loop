import { on } from "../router";
import { getDemoDb } from "../state";

export const registerStatsHandlers = () => {
  on("get", "/stats", () => {
    const db = getDemoDb();
    return { data: { success: true, data: { globalStats: db.globalStats } } };
  });
};
