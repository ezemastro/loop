/**
 * Tests de `adminScopeCommunityId` (SCOPE-3, SCOPE-5, GRANT-2): la comunidad efectiva de lectura
 * de un `community_admin` sale exclusivamente del token, nunca del valor `requested` que llega por
 * query/body. Regresión, no descubrimiento: este comportamiento ya existe
 * (`parseAdminToken.ts:65-78`) y no debe romperse en silencio.
 */
import type { Request } from "express";
import { adminScopeCommunityId } from "./parseAdminToken";
import { InvalidInputError, UnauthorizedError } from "../services/errors";

const COMMUNITY_A = "11111111-1111-4111-8111-111111111111";
const COMMUNITY_B = "22222222-2222-4222-8222-222222222222";

const makeRequest = (session?: Request["session"]): Request => ({ session }) as Request;

describe("adminScopeCommunityId / super_admin", () => {
  const superAdminReq = makeRequest({
    userId: "",
    isAdmin: true,
    adminRole: "super_admin",
    adminCommunityId: null,
  });

  it("con nada pedido, devuelve null (todas las comunidades)", () => {
    expect(adminScopeCommunityId(superAdminReq)).toBeNull();
  });

  it("con requested null, devuelve null", () => {
    expect(adminScopeCommunityId(superAdminReq, null)).toBeNull();
  });

  it("con requested vacío, devuelve null", () => {
    expect(adminScopeCommunityId(superAdminReq, "" as UUID)).toBeNull();
  });

  it("con un UUID válido, lo devuelve tal cual", () => {
    expect(adminScopeCommunityId(superAdminReq, COMMUNITY_A)).toBe(COMMUNITY_A);
  });

  it("rechaza un valor que no es UUID", () => {
    expect(() => adminScopeCommunityId(superAdminReq, "not-a-uuid" as UUID)).toThrow(
      InvalidInputError,
    );
  });
});

describe("adminScopeCommunityId / community_admin", () => {
  const communityAdminReq = makeRequest({
    userId: "",
    isAdmin: true,
    adminRole: "community_admin",
    adminCommunityId: COMMUNITY_A,
  });

  it("ignora una comunidad pedida por el cliente y devuelve la del token", () => {
    expect(adminScopeCommunityId(communityAdminReq, COMMUNITY_B)).toBe(COMMUNITY_A);
  });

  it("sin nada pedido, devuelve igual la comunidad del token", () => {
    expect(adminScopeCommunityId(communityAdminReq)).toBe(COMMUNITY_A);
  });

  it("un valor no-UUID pedido tampoco importa: se ignora igual que cualquier otro", () => {
    expect(adminScopeCommunityId(communityAdminReq, "not-a-uuid" as UUID)).toBe(COMMUNITY_A);
  });

  it("un community_admin sin comunidad en el token falla cerrado (nunca cae al scope global)", () => {
    const req = makeRequest({
      userId: "",
      isAdmin: true,
      adminRole: "community_admin",
      adminCommunityId: null,
    });
    expect(() => adminScopeCommunityId(req)).toThrow(UnauthorizedError);
  });

  it("sin sesión, falla cerrado igual que un community_admin sin comunidad", () => {
    expect(() => adminScopeCommunityId(makeRequest(undefined))).toThrow(UnauthorizedError);
  });
});
