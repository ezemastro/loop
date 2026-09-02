import { test, expect, type LoopFixtures } from "../fixtures";
import {
  ApiError,
  getCommunityByEmail,
  getMe,
  loginUser,
  newUserPayload,
  registerUser,
  verifyUserEmail,
  verifyUserEmailExpired,
} from "../helpers/api";
import {
  getCommunityBySlug,
  getUserByEmail,
  getUserSchools,
  seedCommunity,
  seedSchool,
} from "../helpers/db";

/**
 * Onboarding y tenancy: el registro resuelve la comunidad por el dominio del correo,
 * valida que los colegios pertenezcan a esa comunidad y rechaza dominios desconocidos.
 * Cada escenario valida la respuesta de la API Y las filas reales en la base.
 */

let communityId: string;
let schoolId: string;
let userEmail: string;

const expectApiError = async (
  promise: Promise<unknown>,
  status: number,
  code: string,
  messagePart: string,
): Promise<ApiError> => {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    const apiError = err as ApiError;
    expect(apiError.status).toBe(status);
    expect(apiError.code).toBe(code);
    expect(apiError.message).toContain(messagePart);
    return apiError;
  }
  throw new Error(`Expected request to fail with ${status} "${code}" ("${messagePart}")`);
};

test.describe.serial("Onboarding y tenancy", () => {
  test.beforeAll(async () => {
    const [community] = await getCommunityBySlug("red-itinere");
    communityId = community.id;
    schoolId = await seedSchool(communityId, "E2E Escuela Onboarding");
  });

  test("registro con dominio válido crea usuario en la comunidad", async ({
    api,
    uniqueEmail,
  }: LoopFixtures) => {
    userEmail = uniqueEmail("northfield.edu.ar", "e2e-onboarding");
    const { user } = await registerUser(api, userEmail, [schoolId]);

    expect(user.communityId).toBe(communityId);
    expect(user.schools.map((s) => s.id)).toContain(schoolId);
    expect(user.credits.balance).toBe(0);
    expect(user.credits.locked).toBe(0);

    const [dbUser] = await getUserByEmail(userEmail);
    expect(dbUser).toBeDefined();
    expect(dbUser.community_id).toBe(communityId);
    expect(Number(dbUser.credits_balance)).toBe(0);
    expect(Number(dbUser.credits_locked)).toBe(0);

    const schools = await getUserSchools(user.id);
    expect(schools.map((s) => s.school_id)).toContain(schoolId);
  });

  test("la cuenta recién creada no puede entrar hasta verificar el mail", async ({
    api,
    uniqueEmail,
  }: LoopFixtures) => {
    const email = uniqueEmail("northfield.edu.ar", "e2e-unverified");
    const res = await api.post("/auth/register", { data: newUserPayload(email, [schoolId]) });
    expect(res.ok()).toBeTruthy();

    // Sin el clic del mail el login no existe, aunque la contraseña sea la correcta.
    await expectApiError(loginUser(api, email), 401, "EMAIL_NOT_VERIFIED", "verificado");

    // El clic del mail (endpoint real) destraba el login.
    await verifyUserEmail(api, email);
    const { user } = await loginUser(api, email);
    expect(user.email).toBe(email);
  });

  test("un token de verificación vencido se rechaza y la cuenta sigue sin verificar", async ({
    api,
    uniqueEmail,
  }: LoopFixtures) => {
    const email = uniqueEmail("northfield.edu.ar", "e2e-expired-token");
    const res = await api.post("/auth/register", { data: newUserPayload(email, [schoolId]) });
    expect(res.ok()).toBeTruthy();

    const verifyRes = await verifyUserEmailExpired(api, email);
    expect(verifyRes.ok()).toBeFalsy();

    // El vencimiento se rechaza igual que un token desconocido: la cuenta sigue bloqueada.
    await expectApiError(loginUser(api, email), 401, "EMAIL_NOT_VERIFIED", "verificado");
  });

  test("registro rechazado con escuela de otra comunidad", async ({
    api,
    uniqueEmail,
  }: LoopFixtures) => {
    const communityB = await seedCommunity({
      slug: `e2e-b-${Date.now()}`,
      name: "E2E Comunidad Vecina 01",
      domains: ["e2e-b.test"],
    });
    const schoolBId = await seedSchool(communityB.communityId, "E2E Escuela Vecina");

    const email = uniqueEmail("northfield.edu.ar", "e2e-cruzado");
    await expectApiError(
      registerUser(api, email, [schoolBId]),
      400,
      "SCHOOLS_NOT_IN_COMMUNITY",
      "no pertenecen",
    );

    // El error se lanza dentro de la transacción: el registro tiene que haber hecho rollback.
    expect(await getUserByEmail(email)).toHaveLength(0);
  });

  test("registro con dominio desconocido rechazado", async ({ api, uniqueEmail }: LoopFixtures) => {
    const email = uniqueEmail("unknown-domain.test");
    await expectApiError(
      registerUser(api, email, [schoolId]),
      400,
      "EMAIL_NOT_AUTHORIZED",
      "no está autorizado",
    );

    expect(await getUserByEmail(email)).toHaveLength(0);
  });

  test("login y /me devuelven el usuario", async ({ api }: LoopFixtures) => {
    const { user, token } = await loginUser(api, userEmail);
    expect(user.email).toBe(userEmail);
    expect(user.communityId).toBe(communityId);

    const me = await getMe(api, token);
    expect(me.user.email).toBe(userEmail);
    expect(me.user.communityId).toBe(communityId);
    expect(me.user.credits).toEqual({ balance: 0, locked: 0 });
  });

  test("resolve devuelve la comunidad del dominio", async ({ api }: LoopFixtures) => {
    const { community } = await getCommunityByEmail(api, "resolve-probe@northfield.edu.ar");
    expect(community.slug).toBe("red-itinere");
    expect(community.id).toBe(communityId);
  });
});
