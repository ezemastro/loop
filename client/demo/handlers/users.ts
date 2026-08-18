import { on, httpError, type DemoContext } from "../router";
import { getDemoDb, paginate, toPublicUser, toWish, userById } from "../state";
import { newUuid } from "../ids";
import { authUserFromContext } from "./auth";

export const registerUsersHandlers = () => {
  on("get", "/users", (ctx: DemoContext) => {
    const db = getDemoDb();
    const page = Number(ctx.query.page ?? 1);
    const searchTerm = (ctx.query.searchTerm ?? "").trim().toLowerCase();
    const schoolId = ctx.query.schoolId ?? null;
    const userId = ctx.query.userId ?? null;

    let users = db.users;
    if (userId) users = users.filter((u) => u.id === userId);
    if (schoolId) users = users.filter((u) => u.schools.some((s) => s.id === schoolId));
    if (searchTerm) {
      users = users.filter((u) =>
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(searchTerm),
      );
    }
    const { items, pagination } = paginate(users, page);
    return { data: { success: true, data: { users: items }, pagination } };
  });

  on("get", "/users/:userId", (ctx: DemoContext) => {
    const user = userById(ctx.params.userId);
    if (!user) throw httpError(404, "Usuario no encontrado");
    return { data: { success: true, data: { user } } };
  });

  on("get", "/users/:userId/wishes", (ctx: DemoContext) => {
    const db = getDemoDb();
    if (!userById(ctx.params.userId)) throw httpError(404, "Usuario no encontrado");
    const userWishes = db.wishes.filter((w) => w.userId === ctx.params.userId).map(toWish);
    return { data: { success: true, data: { userWishes } } };
  });

  on("post", "/users/:userId/donate", (ctx: DemoContext) => {
    const donor = authUserFromContext(ctx);
    const db = getDemoDb();
    const recipient = userById(ctx.params.userId);
    if (!recipient) throw httpError(404, "Usuario no encontrado");
    if (recipient.id === donor.id) throw httpError(400, "No podés donarte a vos mismo");
    const amount = Math.max(0, Number(ctx.body?.amount ?? 0));
    if (amount <= 0) throw httpError(400, "El monto debe ser mayor a cero");
    if (donor.credits.balance < amount) throw httpError(400, "No tenés suficientes créditos");
    donor.credits.balance -= amount;
    recipient.credits.balance += amount;
    db.notifications.push({
      id: newUuid(),
      userId: recipient.id,
      type: "donation",
      createdAt: new Date().toISOString(),
      isRead: false,
      readAt: null,
      payload: { donorUserId: donor.id, amount, message: null },
    });
    return { data: { success: true, data: undefined } };
  });
};
