/** Usuarios del modo demo, hidratados desde el dataset compartido. */
import { DEMO_COMMUNITY, DEMO_SCHOOLS } from "./community";
import { SHARED_COMMUNITY, toMedia } from "./dataset";

export const DEMO_USERS: PrivateUser[] = SHARED_COMMUNITY.users.map((user) => ({
  id: user.id,
  email: user.email,
  phone: user.phone,
  firstName: user.firstName,
  lastName: user.lastName,
  profileMediaId: user.avatar?.id ?? null,
  communityId: SHARED_COMMUNITY.id,
  credits: { balance: user.creditsBalance, locked: user.creditsLocked },
  stats: { ...user.stats },
  profileMedia: user.avatar ? toMedia(user.avatar) : null,
  schools: DEMO_SCHOOLS.filter((school) => user.schoolIds.includes(school.id)),
  community: DEMO_COMMUNITY,
}));

export const demoUserByEmail = (email: string) =>
  DEMO_USERS.find((user) => user.email.toLowerCase() === email.toLowerCase());

/**
 * Cuenta con la que entra el modo demo. Es la misma que siembra el seed en desarrollo, así que la
 * demo recorre el mismo camino que una cuenta real: cambia quién contesta, no el flujo.
 */
export const DEMO_SHOWCASE_USER: PrivateUser = (() => {
  const showcase = DEMO_USERS.find((user) => user.id === SHARED_COMMUNITY.showcaseUserId);
  if (!showcase) throw new Error("El dataset demo no define un usuario de portada");
  return showcase;
})();

/** Email de esa cuenta. Es lo único que necesita `loginAsDemo` para entrar. */
export const DEMO_SHOWCASE_EMAIL = DEMO_SHOWCASE_USER.email;
