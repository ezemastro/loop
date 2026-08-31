/**
 * Dataset de demostración de Loop — fuente única de verdad.
 *
 * Lo consumen dos lados que nunca hablan entre sí:
 *
 *   • `server/api/src/scripts/seed.ts` lo inserta en Postgres para desarrollo local. Es data real:
 *     contraseñas con bcrypt, filas con `community_id`, la API sirviéndola sin saber que es demo.
 *   • `client/demo/` lo hidrata en memoria para el modo demo de producción, donde no hay red.
 *
 * Por eso el dataset es neutro (ver `types.ts`): describe *qué* hay, no cómo se guarda. Un cambio
 * acá aparece en los dos lados sin tocar ninguno de los dos.
 *
 * `DEV_DATASET` trae tres comunidades porque en local queremos poder ver el aislamiento entre
 * inquilinos. `DEMO_DATASET` trae una sola: es la que recorre el modo demo en producción, y ahí
 * una comunidad alcanza y sobra.
 */
import { DEMO_BLUEPRINTS, DEV_BLUEPRINTS } from "./blueprints";
import { DEMO_PASSWORD, buildDemoCommunity } from "./buildCommunity";
import { DEMO_CATEGORIES, DEMO_MISSION_TEMPLATES } from "./catalog";
import { demoId } from "./ids";
import type {
  DemoAdmin,
  DemoAuthorizedAdminEmail,
  DemoCommunity,
  DemoDataset,
  DemoUser,
} from "./types";

export * from "./types";
export { DEMO_PASSWORD } from "./buildCommunity";
export { CATEGORY_STATS, DEMO_CATEGORIES, DEMO_MISSION_TEMPLATES } from "./catalog";
export { demoId, uuidFromSeed } from "./ids";

/**
 * Super admin del panel. `communityId` en `null` no es un descuido: la base tiene un CHECK que ata
 * rol y alcance, y ser super admin significa justamente no pertenecer a ninguna comunidad.
 */
const SUPER_ADMIN: DemoAdmin = {
  id: demoId("panel", "admin", "super"),
  email: "super@loop.demo",
  password: DEMO_PASSWORD,
  fullName: "Super Admin",
  role: "super_admin",
  communityId: null,
};

/**
 * Email habilitado pero **sin registrar**, para poder probar `POST /admin/register` de punta a
 * punta. Sin una fila en la allowlist ese endpoint devuelve `EMAIL_NOT_AUTHORIZED`, así que sin
 * esto el alta de admins solo se puede probar autorizando primero desde el propio panel.
 */
const UNREGISTERED_ADMIN_EMAIL = "nuevo@demo.edu";

const buildDataset = (blueprints: typeof DEV_BLUEPRINTS): DemoDataset => {
  const communities = blueprints.map(buildDemoCommunity);
  const demoCommunity = communities.find((community) => community.slug === DEMO_COMMUNITY_SLUG);

  // La allowlist refleja a los admins ya sembrados (así el modelo queda consistente: todo admin
  // que existe está autorizado) más el que falta registrar.
  const authorizedAdminEmails: DemoAuthorizedAdminEmail[] = [
    { email: SUPER_ADMIN.email, role: SUPER_ADMIN.role, communityId: null },
    ...communities.map((community) => ({
      email: community.admin.email,
      role: community.admin.role,
      communityId: community.id,
    })),
  ];
  if (demoCommunity) {
    authorizedAdminEmails.push({
      email: UNREGISTERED_ADMIN_EMAIL,
      role: "community_admin",
      communityId: demoCommunity.id,
    });
  }

  return {
    categories: DEMO_CATEGORIES,
    missionTemplates: DEMO_MISSION_TEMPLATES,
    superAdmin: SUPER_ADMIN,
    authorizedAdminEmails,
    communities,
  };
};

/** Slug de la comunidad que se muestra en el modo demo. */
export const DEMO_COMMUNITY_SLUG = "demo";

/** Dataset del modo demo en producción: una sola comunidad. */
export const DEMO_DATASET: DemoDataset = buildDataset(DEMO_BLUEPRINTS);

/** Dataset del seed de desarrollo: la comunidad demo más dos comunidades extra. */
export const DEV_DATASET: DemoDataset = buildDataset(DEV_BLUEPRINTS);

export const findDemoCommunity = (dataset: DemoDataset, slug: string): DemoCommunity => {
  const found = dataset.communities.find((community) => community.slug === slug);
  if (!found) throw new Error(`Comunidad inexistente en el dataset demo: ${slug}`);
  return found;
};

/** La comunidad del modo demo, ya construida. */
export const DEMO_COMMUNITY = findDemoCommunity(DEMO_DATASET, DEMO_COMMUNITY_SLUG);

/**
 * Credenciales de todas las cuentas del dataset, en el orden en que se documentan en `DEMO.md`.
 * El script de seed las imprime al terminar para no tener que abrir el markdown.
 */
export interface DemoCredential {
  community: string;
  communitySlug: string;
  email: string;
  password: string;
  fullName: string;
  credits: number;
  /** `true` en la cuenta con la que entra el modo demo. */
  showcase: boolean;
}

export interface DemoAdminCredential {
  email: string;
  password: string;
  fullName: string;
  role: DemoAdmin["role"];
  /** Nombre de la comunidad, o `null` si es el super admin. */
  community: string | null;
}

/** Credenciales del panel, super admin primero. */
export const demoAdminCredentials = (dataset: DemoDataset): DemoAdminCredential[] => [
  {
    email: dataset.superAdmin.email,
    password: dataset.superAdmin.password,
    fullName: dataset.superAdmin.fullName,
    role: dataset.superAdmin.role,
    community: null,
  },
  ...dataset.communities.map((community) => ({
    email: community.admin.email,
    password: community.admin.password,
    fullName: community.admin.fullName,
    role: community.admin.role,
    community: community.name,
  })),
];

/** Emails habilitados que todavía no tienen cuenta: sirven para probar el alta de admins. */
export const unregisteredAdminEmails = (dataset: DemoDataset): DemoAuthorizedAdminEmail[] => {
  const registrados = new Set([
    dataset.superAdmin.email,
    ...dataset.communities.map((community) => community.admin.email),
  ]);
  return dataset.authorizedAdminEmails.filter((entry) => !registrados.has(entry.email));
};

export const demoCredentials = (dataset: DemoDataset): DemoCredential[] =>
  dataset.communities.flatMap((community) =>
    community.users.map((user: DemoUser) => ({
      community: community.name,
      communitySlug: community.slug,
      email: user.email,
      password: user.password,
      fullName: `${user.firstName} ${user.lastName}`,
      credits: user.creditsBalance,
      showcase: user.id === community.showcaseUserId,
    })),
  );
