/** Comunidad y colegios del modo demo, hidratados desde el dataset compartido. */
import { SHARED_COMMUNITY, toMedia } from "./dataset";

export const DEMO_COMMUNITY_MEDIA: Media = toMedia(SHARED_COMMUNITY.media);

export const DEMO_COMMUNITY: Community = {
  id: SHARED_COMMUNITY.id,
  slug: SHARED_COMMUNITY.slug,
  name: SHARED_COMMUNITY.name,
  mediaId: DEMO_COMMUNITY_MEDIA.id,
  theme: SHARED_COMMUNITY.theme,
  meta: null,
  active: true,
  media: DEMO_COMMUNITY_MEDIA,
};

export const DEMO_SCHOOLS: School[] = SHARED_COMMUNITY.schools.map((school) => ({
  id: school.id,
  name: school.name,
  mediaId: school.media.id,
  communityId: SHARED_COMMUNITY.id,
  meta: null,
  media: toMedia(school.media),
}));

/** Dominio con el que la comunidad demo acepta correos. Se muestra en la pantalla de login. */
export const DEMO_EMAIL_DOMAINS: string[] = [...SHARED_COMMUNITY.emailDomains];
