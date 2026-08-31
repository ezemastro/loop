import { on, httpError, type DemoContext } from "../router";
import { getDemoDb, paginate, toListing, userById } from "../state";
import { newUuid } from "../ids";
import { authUserFromContext } from "./auth";
import type { ListingRecord } from "../db/content";

const notifyLoop = (
  userId: UUID,
  listingId: UUID,
  buyerId: UUID | null,
  toListingStatus: ListingStatus,
  toOfferedCredits: number | null,
  type: LoopNotificationPayloadBase["type"],
) => {
  const db = getDemoDb();
  db.notifications.push({
    id: newUuid(),
    userId,
    type: "loop",
    createdAt: new Date().toISOString(),
    isRead: false,
    readAt: null,
    payload: { listingId, buyerId, toListingStatus, toOfferedCredits, type },
  });
};

const descendantsOf = (categoryId: UUID): Set<string> => {
  const db = getDemoDb();
  const result = new Set<string>([categoryId]);
  for (const child of db.categories.filter((c) => c.parentId === categoryId)) {
    for (const id of descendantsOf(child.id)) result.add(id);
  }
  return result;
};

export const applyListingFilters = (ctx: DemoContext) => {
  const db = getDemoDb();
  const q = ctx.query;
  const searchTerm = (q.searchTerm ?? "").trim().toLowerCase();
  const categoryIds = q.categoryId ? descendantsOf(q.categoryId) : null;

  return db.listings.filter((l) => {
    if (l.disabled) return false;
    if (categoryIds && !categoryIds.has(l.categoryId)) return false;
    if (q.sellerId && l.sellerId !== q.sellerId) return false;
    if (q.buyerId && l.buyerId !== q.buyerId) return false;
    if (q.productStatus && l.productStatus !== q.productStatus) return false;
    if (q.listingStatus && l.listingStatus !== q.listingStatus) return false;
    if (q.schoolId && !userById(l.sellerId)?.schools.some((s) => s.id === q.schoolId)) {
      return false;
    }
    if (searchTerm && !`${l.title} ${l.description ?? ""}`.toLowerCase().includes(searchTerm)) {
      return false;
    }
    return true;
  });
};

export const sortListings = (listings: ListingRecord[], ctx: DemoContext) => {
  const q = ctx.query;
  const order = q.order === "asc" ? 1 : -1;
  const byKey: Record<string, (l: ListingRecord) => string | number> = {
    createdAt: (l) => l.createdAt,
    updatedAt: (l) => l.createdAt,
    price: (l) => l.price,
    title: (l) => l.title,
  };
  const key = byKey[q.sort ?? "createdAt"] ?? byKey.createdAt;
  return [...listings].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return (
      (typeof ka === "number" && typeof kb === "number"
        ? ka - kb
        : String(ka).localeCompare(String(kb))) * order
    );
  });
};

const mediaFromIds = (mediaIds: string[] | undefined): Media[] => {
  const db = getDemoDb();
  return (mediaIds ?? []).map((id) => db.mediaRegistry.get(id)).filter(Boolean) as Media[];
};

export const registerListingsHandlers = () => {
  on("get", "/listings", (ctx: DemoContext) => {
    const page = Number(ctx.query.page ?? 1);
    const { items, pagination } = paginate(sortListings(applyListingFilters(ctx), ctx), page);
    return {
      data: { success: true, data: { listings: items.map(toListing) }, pagination },
    };
  });

  on("post", "/listings", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const body = ctx.body ?? {};
    const record = {
      id: newUuid(),
      sellerId: user.id,
      title: String(body.title ?? "Sin título"),
      description: body.description ?? null,
      categoryId: String(body.categoryId),
      price: Number(body.price ?? 0),
      listingStatus: "published" as ListingStatus,
      productStatus: body.productStatus ?? "good",
      disabled: false,
      buyerId: null,
      offeredCredits: null,
      createdAt: new Date().toISOString(),
      media: mediaFromIds(body.mediaIds),
    };
    db.listings.push(record);
    return { data: { success: true, data: { listing: toListing(record) } } };
  });

  on("get", "/listings/:listingId", (ctx: DemoContext) => {
    const db = getDemoDb();
    const record = db.listings.find((l) => l.id === ctx.params.listingId && !l.disabled);
    if (!record) throw httpError(404, "Publicación no encontrada");
    return { data: { success: true, data: { listing: toListing(record) } } };
  });

  on("patch", "/listings/:listingId", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const record = db.listings.find((l) => l.id === ctx.params.listingId);
    if (!record || record.disabled) throw httpError(404, "Publicación no encontrada");
    if (record.sellerId !== user.id) throw httpError(403, "No podés editar una publicación ajena");
    const body = ctx.body ?? {};
    if ("title" in body) record.title = String(body.title);
    if ("description" in body) record.description = body.description ?? null;
    if ("price" in body) record.price = Number(body.price);
    if ("categoryId" in body) record.categoryId = String(body.categoryId);
    if ("productStatus" in body) record.productStatus = body.productStatus;
    if (Array.isArray(body.mediaIds)) record.media = mediaFromIds(body.mediaIds);
    return { data: { success: true, data: { listing: toListing(record) } } };
  });

  on("delete", "/listings/:listingId", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const record = db.listings.find((l) => l.id === ctx.params.listingId);
    if (!record || record.disabled) throw httpError(404, "Publicación no encontrada");
    if (record.sellerId !== user.id)
      throw httpError(403, "No podés eliminar una publicación ajena");
    record.disabled = true;
    return { data: { success: true, data: { listing: toListing(record) } } };
  });

  on("post", "/listings/:listingId/offer", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const record = db.listings.find((l) => l.id === ctx.params.listingId);
    if (!record || record.disabled) throw httpError(404, "Publicación no encontrada");
    if (record.sellerId === user.id)
      throw httpError(400, "No podés ofrecer por tu propia publicación");
    if (record.listingStatus !== "published") {
      throw httpError(400, "Esta publicación ya tiene una oferta en curso");
    }
    record.buyerId = user.id;
    record.offeredCredits = Number(ctx.body?.price ?? record.price);
    record.listingStatus = "offered";
    notifyLoop(record.sellerId, record.id, user.id, "offered", record.offeredCredits, "new_offer");
    return { data: { success: true, data: { listing: toListing(record) } } };
  });

  on("delete", "/listings/:listingId/offer", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const record = db.listings.find((l) => l.id === ctx.params.listingId);
    if (!record) throw httpError(404, "Publicación no encontrada");
    if (record.buyerId !== user.id) throw httpError(403, "Esta oferta no es tuya");
    const buyerId = record.buyerId;
    record.buyerId = null;
    record.offeredCredits = null;
    record.listingStatus = "published";
    notifyLoop(record.sellerId, record.id, buyerId, "published", null, "offer_deleted");
    return { data: { success: true } };
  });

  on("post", "/listings/:listingId/offer/reject", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const record = db.listings.find((l) => l.id === ctx.params.listingId);
    if (!record) throw httpError(404, "Publicación no encontrada");
    if (record.sellerId !== user.id)
      throw httpError(403, "Solo el vendedor puede rechazar una oferta");
    const buyerId = record.buyerId;
    record.buyerId = null;
    record.offeredCredits = null;
    record.listingStatus = "published";
    if (buyerId) notifyLoop(buyerId, record.id, buyerId, "published", null, "offer_rejected");
    return { data: { success: true } };
  });

  on("post", "/listings/:listingId/offer/accept", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const record = db.listings.find((l) => l.id === ctx.params.listingId);
    if (!record) throw httpError(404, "Publicación no encontrada");
    if (record.sellerId !== user.id)
      throw httpError(403, "Solo el vendedor puede aceptar una oferta");
    if (record.listingStatus !== "offered" || !record.buyerId) {
      throw httpError(400, "No hay una oferta pendiente");
    }
    const buyer = userById(record.buyerId);
    if (buyer) {
      const amount = record.offeredCredits ?? record.price;
      buyer.credits.balance = Math.max(0, buyer.credits.balance - amount);
      user.credits.balance += amount;
    }
    record.listingStatus = "accepted";
    notifyLoop(
      record.buyerId,
      record.id,
      record.buyerId,
      "accepted",
      record.offeredCredits,
      "offer_accepted",
    );
    return { data: { success: true } };
  });

  on("post", "/listings/:listingId/receive", (ctx: DemoContext) => {
    const user = authUserFromContext(ctx);
    const db = getDemoDb();
    const record = db.listings.find((l) => l.id === ctx.params.listingId);
    if (!record) throw httpError(404, "Publicación no encontrada");
    if (record.buyerId !== user.id)
      throw httpError(403, "Solo el comprador puede confirmar la entrega");
    record.listingStatus = "received";
    notifyLoop(
      record.sellerId,
      record.id,
      record.buyerId,
      "received",
      record.offeredCredits,
      "listing_received",
    );
    return { data: { success: true } };
  });
};
