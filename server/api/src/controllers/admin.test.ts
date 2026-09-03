/**
 * Regresión de rutas de grant y de scope (GRANT-1/2/3, SCOPE-3/5). El comportamiento probado acá
 * ya existe (`controllers/admin.ts:158-172`, `:196`); esto es una red de seguridad, no un
 * descubrimiento. `AdminModel` va mockeado — lo que se verifica es *con qué argumentos* el
 * controller llama al modelo y *qué status* responde, nunca la base real.
 *
 * `adminTokenMiddleware` corre real (no se mockea): las cookies de sesión se generan con el mismo
 * `generateAdminToken` que usa la app, así el chequeo de rol también queda cubierto de punta a
 * punta, no solo a nivel de función suelta (eso ya lo cubre `parseAdminToken.test.ts`).
 */
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

jest.mock("../models/admin.js", () => ({
  AdminModel: {
    addValidEmailForRegistration: jest.fn(),
    getUsers: jest.fn(),
  },
}));

import { adminRouter } from "../routes/admin";
import { AdminModel } from "../models/admin";
import { generateAdminToken } from "../services/jwt";
import { COOKIE_NAMES } from "../config";

const mockAddValidEmail = AdminModel.addValidEmailForRegistration as jest.Mock;
const mockGetUsers = AdminModel.getUsers as jest.Mock;

const COMMUNITY_A = "11111111-1111-4111-8111-111111111111";
const COMMUNITY_B = "22222222-2222-4222-8222-222222222222";
const COMMUNITY_C = "33333333-3333-4333-8333-333333333333";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/admin", adminRouter);

const cookieFor = (role: AdminRole, communityId: UUID | null) => {
  const token = generateAdminToken({ id: "admin-id", role, communityId });
  return `${COOKIE_NAMES.ADMIN_TOKEN}=${token}`;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAddValidEmail.mockResolvedValue(undefined);
  mockGetUsers.mockResolvedValue({ users: [], total: 0, pagination: {} });
});

describe("POST /admin/authorize-email — GRANT-1", () => {
  it("rechaza a un community_admin que pide super_admin, sin crear ninguna fila", async () => {
    const res = await request(app)
      .post("/admin/authorize-email")
      .set("Cookie", cookieFor("community_admin", COMMUNITY_A))
      .send({ email: "nuevo@ejemplo.com", role: "super_admin" });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, errorCode: "SUPER_ADMIN_REQUIRED" });
    expect(mockAddValidEmail).not.toHaveBeenCalled();
  });

  it("un super_admin sí puede otorgar super_admin, y la fila queda sin comunidad", async () => {
    const res = await request(app)
      .post("/admin/authorize-email")
      .set("Cookie", cookieFor("super_admin", null))
      .send({ email: "nuevo@ejemplo.com", role: "super_admin" });

    expect(res.status).toBe(201);
    expect(mockAddValidEmail).toHaveBeenCalledWith(
      expect.objectContaining({ role: "super_admin", communityId: null }),
    );
  });
});

describe("POST /admin/authorize-email — GRANT-2 / GRANT-3", () => {
  it("un community_admin de A queda pinneado a A aunque mande una comunidad B falsificada", async () => {
    const res = await request(app)
      .post("/admin/authorize-email")
      .set("Cookie", cookieFor("community_admin", COMMUNITY_A))
      .send({ email: "nuevo@ejemplo.com", role: "community_admin", communityId: COMMUNITY_B });

    expect(res.status).toBe(201);
    expect(mockAddValidEmail).toHaveBeenCalledWith(
      expect.objectContaining({ role: "community_admin", communityId: COMMUNITY_A }),
    );
  });

  it("un super_admin que otorga community_admin con communityId=C crea la fila en C", async () => {
    const res = await request(app)
      .post("/admin/authorize-email")
      .set("Cookie", cookieFor("super_admin", null))
      .send({ email: "nuevo@ejemplo.com", role: "community_admin", communityId: COMMUNITY_C });

    expect(res.status).toBe(201);
    expect(mockAddValidEmail).toHaveBeenCalledWith(
      expect.objectContaining({ role: "community_admin", communityId: COMMUNITY_C }),
    );
  });
});

describe("GET /admin/users — SCOPE-3 / SCOPE-5", () => {
  it("un community_admin de A solo ve A aunque pida ?communityId=<otra>", async () => {
    const res = await request(app)
      .get(`/admin/users?communityId=${COMMUNITY_B}`)
      .set("Cookie", cookieFor("community_admin", COMMUNITY_A));

    expect(res.status).toBe(200);
    expect(mockGetUsers).toHaveBeenCalledWith(
      expect.objectContaining({ communityId: COMMUNITY_A }),
    );
  });
});
