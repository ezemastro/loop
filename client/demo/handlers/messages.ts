import { on, httpError, type DemoContext } from "../router";
import { getDemoDb, paginate, toMessage, toPublicUser, userById } from "../state";
import { newUuid } from "../ids";
import { authUserFromContext } from "./auth";

export const registerMessagesHandlers = () => {
  on("get", "/messages/:userId", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const counterpart = userById(ctx.params.userId);
    if (!counterpart) throw httpError(404, "Usuario no encontrado");
    const db = getDemoDb();
    const page = Number(ctx.query.page ?? 1);

    const thread = db.messages
      .filter(
        (m) =>
          (m.senderId === user.id && m.recipientId === counterpart.id) ||
          (m.senderId === counterpart.id && m.recipientId === user.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const { items, pagination } = paginate(thread, page);
    return { data: { success: true, data: { messages: items.map(toMessage) }, pagination } };
  });

  on("post", "/messages/:userId", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const recipient = userById(ctx.params.userId);
    if (!recipient) throw httpError(404, "Usuario no encontrado");
    const db = getDemoDb();
    const text = String(ctx.body?.text ?? "").trim();
    if (!text) throw httpError(400, "El mensaje no puede estar vacío");

    const record = {
      id: newUuid(),
      senderId: user.id,
      recipientId: recipient.id,
      text,
      attachedListingId: ctx.body?.attachedListingId ?? null,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    db.messages.push(record);
    return { data: { success: true, data: { message: toMessage(record) } } };
  });

  on("post", "/messages/:userId/read", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const counterpart = userById(ctx.params.userId);
    if (!counterpart) throw httpError(404, "Usuario no encontrado");
    const db = getDemoDb();
    db.messages.forEach((m) => {
      if (m.senderId === counterpart.id && m.recipientId === user.id) {
        m.isRead = true;
      }
    });
    return { data: { success: true, data: undefined } };
  });
};
