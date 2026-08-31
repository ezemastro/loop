import { on, httpError, type DemoContext } from "../router";
import {
  getDemoDb,
  paginate,
  toListing,
  toMessage,
  toNotification,
  toPublicUser,
  toUserBase,
  toUserMission,
  toWish,
  userById,
} from "../state";
import { newUuid } from "../ids";
import { authUserFromContext } from "./auth";
import { sortListings, applyListingFilters } from "./listings";

export const registerMeHandlers = () => {
  on("get", "/me", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    return { data: { success: true, data: { user } } };
  });

  on("patch", "/me", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const body = ctx.body ?? {};
    if ("firstName" in body) user.firstName = String(body.firstName);
    if ("lastName" in body) user.lastName = String(body.lastName);
    if ("phone" in body) user.phone = body.phone ? String(body.phone) : null;
    if ("profileMediaId" in body) {
      user.profileMediaId = body.profileMediaId ? String(body.profileMediaId) : null;
      user.profileMedia = user.profileMediaId
        ? (db.mediaRegistry.get(user.profileMediaId) ?? null)
        : null;
    }
    if (Array.isArray(body.schoolIds)) {
      user.schools = db.schools.filter((s) => body.schoolIds.includes(s.id));
    }
    return { data: { success: true, data: { user: toUserBase(user) } } };
  });

  on("delete", "/me", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    db.users = db.users.filter((u) => u.id !== user.id);
    return { data: { success: true } };
  });

  on("get", "/me/listings", (ctx: DemoContext) => {
    authUserFromContext(ctx);
    const mine = applyListingFilters(ctx);
    const page = Number(ctx.query.page ?? 1);
    const { items, pagination } = paginate(sortListings(mine, ctx), page);
    return { data: { success: true, data: { listings: items.map(toListing) }, pagination } };
  });

  on("get", "/me/missions", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const userMissions = db.userMissions.filter((m) => m.userId === user.id).map(toUserMission);
    return { data: { success: true, data: { userMissions } } };
  });

  on("get", "/me/notifications", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const page = Number(ctx.query.page ?? 1);
    const notifications = db.notifications
      .filter((n) => n.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const { items, pagination } = paginate(notifications, page);
    return {
      data: { success: true, data: { notifications: items.map(toNotification) }, pagination },
    };
  });

  on("get", "/me/notifications/unread", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const unreadNotificationsCount = db.notifications.filter(
      (n) => n.userId === user.id && !n.isRead,
    ).length;
    return { data: { success: true, data: { unreadNotificationsCount } } };
  });

  on("post", "/me/notifications/read-all", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const now = new Date().toISOString();
    db.notifications.forEach((n) => {
      if (n.userId === user.id && !n.isRead) {
        n.isRead = true;
        n.readAt = now;
      }
    });
    return { data: { success: true } };
  });

  on("get", "/me/messages", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const page = Number(ctx.query.page ?? 1);

    const counterpartIds = new Set<string>();
    for (const m of db.messages) {
      if (m.senderId === user.id) counterpartIds.add(m.recipientId);
      if (m.recipientId === user.id) counterpartIds.add(m.senderId);
    }

    const chats = [...counterpartIds].map((counterpartId) => {
      const thread = db.messages.filter(
        (m) => m.senderId === counterpartId || m.recipientId === counterpartId,
      );
      const last = thread.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
      const pendingMessages = thread.filter(
        (m) => m.senderId === counterpartId && m.recipientId === user.id && !m.isRead,
      ).length;
      return {
        userId: counterpartId,
        lastMessageId: last.id,
        pendingMessages,
        lastMessage: toMessage(last),
        user: toPublicUser(userById(counterpartId))!,
      };
    });
    chats.sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
    );

    const { items, pagination } = paginate(chats, page);
    return { data: { success: true, data: { chats: items }, pagination } };
  });

  on("get", "/me/messages/unread", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const unreadChatsCount = new Set(
      db.messages.filter((m) => m.recipientId === user.id && !m.isRead).map((m) => m.senderId),
    ).size;
    return { data: { success: true, data: { unreadChatsCount } } };
  });

  on("get", "/me/wishes", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const userWishes = db.wishes.filter((w) => w.userId === user.id).map(toWish);
    return { data: { success: true, data: { userWishes } } };
  });

  on("post", "/me/wishes", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const categoryId = String(ctx.body?.categoryId ?? "");
    const existing = db.wishes.find((w) => w.userId === user.id && w.categoryId === categoryId);
    if (existing) {
      return { data: { success: true, data: { userWish: toWish(existing) } } };
    }
    const wish = {
      id: newUuid(),
      userId: user.id,
      categoryId,
      comment: ctx.body?.comment ?? null,
    };
    db.wishes.push(wish);
    return { data: { success: true, data: { userWish: toWish(wish) } } };
  });

  on("delete", "/me/wishes/:categoryId", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    db.wishes = db.wishes.filter(
      (w) => !(w.userId === user.id && w.categoryId === ctx.params.categoryId),
    );
    return { data: { success: true } };
  });

  on("put", "/me/wishes/:wishId", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const wish = db.wishes.find((w) => w.id === ctx.params.wishId && w.userId === user.id);
    if (!wish) throw httpError(404, "Deseo no encontrado");
    if ("categoryId" in (ctx.body ?? {})) wish.categoryId = String(ctx.body.categoryId);
    if ("comment" in (ctx.body ?? {})) wish.comment = ctx.body.comment ?? null;
    return { data: { success: true, data: { userWish: toWish(wish) } } };
  });

  on("post", "/me/notification-token", () => {
    return { data: { success: true, data: undefined } };
  });
};
