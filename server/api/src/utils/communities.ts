import { withClient, unscoped } from "../services/postgresClient.js";
import { queries } from "../services/queries.js";
import type { DatabaseClient } from "../types/dbClient.js";
import { parseCommunityFromBase, parseCommunityFromDb, parseMediaFromDb } from "./parseDb.js";

/**
 * Resolución de la comunidad a partir del correo.
 *
 * Esto es lo que reemplazó a `VALID_EMAIL_DOMAINS`, la constante que estaba hardcodeada y
 * duplicada byte a byte en `server/api/src/config.ts` y `client/config.ts`. Ahora los dominios
 * viven en `community_email_domains` con índice único global, así que un dominio pertenece a una
 * sola comunidad y la resolución es determinística: el correo institucional del usuario decide en
 * qué comunidad entra, sin que él pueda elegir mal.
 */

/** Devuelve el dominio de un correo en minúsculas, o `null` si no parece un correo. */
export const extractDomain = (email: string): string | null => {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1];
  return domain && domain.length > 0 ? domain : null;
};

/** Hidrata el logo de la comunidad sobre una conexión ya abierta. */
export const hydrateCommunity = async ({
  client,
  community,
}: {
  client: DatabaseClient;
  community: CommunityBase;
}): Promise<Community> => {
  if (!community.mediaId) return parseCommunityFromBase({ community, media: null });
  // El logo de una comunidad es media compartida (community_id nulo), así que se ve desde
  // cualquier scope — incluida la pantalla de registro, que todavía no tiene sesión.
  const [mediaDb] = await client.query(queries.mediaById, [community.mediaId, client.communityId]);
  return parseCommunityFromBase({
    community,
    media: mediaDb ? parseMediaFromDb(mediaDb) : null,
  });
};

export const getCommunityByIdWithClient = async ({
  client,
  communityId,
}: {
  client: DatabaseClient;
  communityId: UUID;
}): Promise<Community | null> => {
  const [row] = await client.query(queries.communityById, [communityId]);
  if (!row) return null;
  return hydrateCommunity({ client, community: parseCommunityFromDb(row) });
};

export const resolveCommunityByDomain = async (domain: string): Promise<Community | null> => {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return null;

  return withClient(
    async (client) => {
      const [row] = await client.query(queries.communityByDomain, [normalized]);
      if (!row) return null;
      return hydrateCommunity({ client, community: parseCommunityFromDb(row) });
    },
    { scope: unscoped("auth:resolve-community") },
  );
};

export const resolveCommunityByEmail = async (email: string): Promise<Community | null> => {
  const domain = extractDomain(email);
  if (!domain) return null;
  return resolveCommunityByDomain(domain);
};

export const getCommunityById = async (communityId: UUID): Promise<Community | null> =>
  withClient(
    async (client) => getCommunityByIdWithClient({ client, communityId }),
    { scope: unscoped("public:communities") },
  );

export const getCommunityBySlug = async (slug: string): Promise<Community | null> =>
  withClient(
    async (client) => {
      const [row] = await client.query(queries.communityBySlug, [slug]);
      if (!row) return null;
      return hydrateCommunity({ client, community: parseCommunityFromDb(row) });
    },
    { scope: unscoped("public:communities") },
  );

/**
 * ¿El correo pertenece a algún dominio de esta comunidad?
 *
 * Lo usa el login: un usuario cuyo colegio dejó de estar en la comunidad (o que nunca tuvo correo
 * institucional) no debería poder seguir entrando... salvo que haya entrado por invitación, que es
 * justamente para eso. Ese caso se resuelve con la bandera `domain_exempt` del usuario, no acá.
 */
export const emailBelongsToCommunity = async ({
  client,
  email,
  communityId,
}: {
  client: DatabaseClient;
  email: string;
  communityId: UUID;
}): Promise<boolean> => {
  const domain = extractDomain(email);
  if (!domain) return false;
  const [row] = await client.query(queries.communityByDomain, [domain]);
  return !!row && row.id === communityId;
};

/**
 * Valida que todos los colegios elegidos pertenezcan a la comunidad.
 *
 * Sin esto, alguien podría registrarse con un correo de una comunidad y elegir los colegios de
 * otra. Hoy `PATCH /me` y el registro no validaban nada de esto.
 */
export const areSchoolsInCommunity = async ({
  client,
  schoolIds,
  communityId,
}: {
  client: DatabaseClient;
  schoolIds: UUID[];
  communityId: UUID;
}): Promise<boolean> => {
  const uniqueIds = [...new Set(schoolIds)];
  if (uniqueIds.length === 0) return false;
  const [row] = await client.query(queries.countSchoolsInCommunity, [uniqueIds, communityId]);
  return Number(row?.count ?? 0) === uniqueIds.length;
};
