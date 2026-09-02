/**
 * Separación de claves de firma (SEC-02, D2). Un token de usuario y uno de admin ya no se
 * verifican con el mismo secreto, y el algoritmo está fijado explícitamente.
 */
import jsonwebtoken from "jsonwebtoken";
import { ADMIN_JWT_SECRET, JWT_SECRET } from "../config";
import { generateAdminToken, generateToken, parseAdminToken, parseToken } from "./jwt";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COMMUNITY_ID = "22222222-2222-4222-8222-222222222222";

describe("jwt / signing key separation", () => {
  it("a user token verifies with parseToken", () => {
    const token = generateToken({ userId: USER_ID, communityId: COMMUNITY_ID });
    expect(() => parseToken(token)).not.toThrow();
    expect(parseToken(token).userId).toBe(USER_ID);
  });

  it("an admin token verifies with parseAdminToken", () => {
    const token = generateAdminToken({ id: USER_ID, role: "super_admin", communityId: null });
    expect(() => parseAdminToken(token)).not.toThrow();
    expect(parseAdminToken(token).adminRole).toBe("super_admin");
  });

  it("a user token is rejected by parseAdminToken", () => {
    const token = generateToken({ userId: USER_ID, communityId: COMMUNITY_ID });
    expect(() => parseAdminToken(token)).toThrow();
  });

  it("an admin token is rejected by parseToken", () => {
    const token = generateAdminToken({ id: USER_ID, role: "super_admin", communityId: null });
    expect(() => parseToken(token)).toThrow();
  });

  it("a token forged with JWT_SECRET but claiming admin fields is rejected by parseAdminToken", () => {
    // El escenario exacto que SEC-02 cierra: alguien que conoce JWT_SECRET no puede fabricar un
    // token de admin, aunque el payload lleve `isAdmin`/`adminRole`.
    const forged = jsonwebtoken.sign(
      { adminId: USER_ID, isAdmin: true, adminRole: "super_admin", adminCommunityId: null },
      JWT_SECRET,
      { algorithm: "HS256" },
    );
    expect(() => parseAdminToken(forged)).toThrow();
  });

  it("a token forged with ADMIN_JWT_SECRET is rejected by parseToken even with a userId claim", () => {
    const forged = jsonwebtoken.sign({ userId: USER_ID }, ADMIN_JWT_SECRET, {
      algorithm: "HS256",
    });
    expect(() => parseToken(forged)).toThrow();
  });

  it("rejects a token signed with alg: none", () => {
    // `jsonwebtoken` no permite firmar con "none" por default; se arma el JWT a mano.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ userId: USER_ID })).toString("base64url");
    const noneToken = `${header}.${payload}.`;
    expect(() => parseToken(noneToken)).toThrow();
  });

  it("rejects a token whose algorithm is not the configured one (HS384 vs HS256)", () => {
    const wrongAlg = jsonwebtoken.sign({ userId: USER_ID }, JWT_SECRET, { algorithm: "HS384" });
    expect(() => parseToken(wrongAlg)).toThrow();
  });
});
