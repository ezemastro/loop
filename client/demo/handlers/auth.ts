import { on, httpError, type DemoContext } from "../router";
import { getDemoDb, userById } from "../state";
import { demoTokenFor, userIdFromToken } from "../ids";
import { DEMO_COMMUNITY } from "../db/community";
import { TERMS_VERSION } from "@/content/legal/termsDocument";

const toPrivateUser = (user: PrivateUser) => ({ ...user });

export const registerAuthHandlers = () => {
  on("post", "/auth/login", (ctx: DemoContext) => {
    const { email } = ctx.body ?? {};
    const db = getDemoDb();
    // Cualquier credencial entra a la demo: si el mail coincide con un usuario seed, entra como él.
    const user =
      db.users.find((u) => u.email.toLowerCase() === String(email ?? "").toLowerCase()) ??
      db.users[0];
    return {
      data: {
        success: true,
        data: { user: toPrivateUser(user), token: demoTokenFor(user.id) },
      },
    };
  });

  on("post", "/auth/register", (ctx: DemoContext) => {
    const db = getDemoDb();
    const body = ctx.body ?? {};
    const schools = db.schools.filter((s) => (body.schoolIds ?? []).includes(s.id));
    if (!schools.length) {
      throw httpError(400, "Debés elegir al menos un colegio", "INVALID_INPUT");
    }
    const user: PrivateUser = {
      id: `00000000-0000-4000-8000-${String(Math.floor(Math.random() * 1e12)).padStart(12, "0")}`,
      email: String(body.email ?? "usuario@demo.edu"),
      phone: null,
      firstName: String(body.firstName ?? "Nuevo"),
      lastName: String(body.lastName ?? "Usuario"),
      profileMediaId: null,
      communityId: db.users[0].communityId,
      credits: { balance: 300, locked: 0 },
      stats: { kgWaste: 0, kgCo2: 0, lH2o: 0 },
      profileMedia: null,
      schools,
      community: db.users[0].community,
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: TERMS_VERSION,
    };
    db.users.push(user);
    // Mismo contrato que la API real: el registro no loguea, solo avisa que revise el mail.
    return {
      data: {
        success: true,
        data: { message: "Cuenta creada. Revisá tu email para verificarla." },
      },
    };
  });

  on("post", "/auth/google-login", (ctx: DemoContext) => {
    const db = getDemoDb();
    const schoolIds: string[] = ctx.body?.schoolIds ?? [];
    if (!schoolIds.length) {
      // Mismo contrato que la API real: sin colegios el error trae la comunidad resuelta para
      // que el cliente pueda previsualizar el tema mientras elige.
      throw httpError(
        400,
        "Debés elegir al menos un colegio para continuar",
        "SCHOOL_IDS_REQUIRED",
        { community: DEMO_COMMUNITY },
      );
    }
    const user = db.users[0];
    return {
      data: {
        success: true,
        data: { user: toPrivateUser(user), token: demoTokenFor(user.id) },
      },
    };
  });

  on("get", "/auth/invitations/:token", () => {
    return {
      data: {
        success: true,
        data: {
          invitation: { id: "00000000-0000-4000-8000-000000000301", community: DEMO_COMMUNITY },
        },
      },
    };
  });
};

export const authUserFromContext = (ctx: DemoContext) => {
  const db = getDemoDb();
  const user = userIdFromToken(ctx.token) ? userById(userIdFromToken(ctx.token)) : null;
  if (!user) throw httpError(401, "No autorizado");
  return db.users.find((u) => u.id === user.id)!;
};
