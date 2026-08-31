import { on, type DemoContext } from "../router";
import { getDemoDb, paginate } from "../state";

export const registerSchoolsHandlers = () => {
  on("get", "/schools", (ctx: DemoContext) => {
    const db = getDemoDb();
    const page = Number(ctx.query.page ?? 1);
    const searchTerm = (ctx.query.searchTerm ?? "").trim().toLowerCase();
    const communityId = ctx.query.communityId ?? null;
    const domain = ctx.query.domain ?? null;

    let schools = db.schools.filter((s) => !communityId || s.communityId === communityId);
    if (domain) {
      // En la demo todos los dominios pertenecen a la comunidad demo.
      schools = db.schools.filter((s) => s.communityId === db.users[0].communityId);
    }
    if (searchTerm) {
      schools = schools.filter((s) => s.name.toLowerCase().includes(searchTerm));
    }

    const { items, pagination } = paginate(schools, page);
    return {
      data: { success: true, data: { schools: items }, pagination },
    };
  });
};
