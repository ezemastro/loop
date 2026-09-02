import { DEMO_COMMUNITY, DEMO_SCHOOLS } from "./community";
import { DEMO_CATEGORIES } from "./categories";
import { DEMO_USERS } from "./users";
import {
  DEMO_LISTINGS,
  DEMO_MESSAGES,
  DEMO_MISSION_TEMPLATES,
  DEMO_NOTIFICATIONS,
  DEMO_USER_MISSIONS,
  DEMO_WISHES,
  DEMO_GLOBAL_STATS,
  type ListingRecord,
  type MessageRecord,
  type NotificationRecord,
  type UserMissionRecord,
  type WishRecord,
} from "./content";

/**
 * "Base de datos" en memoria del modo demo. Todo lo que muta un handler (ofertas, mensajes,
 * publicaciones) se refleja acá para que la sesión demo sea interactiva.
 */
export interface DemoDb {
  users: PrivateUser[];
  schools: School[];
  categories: CategoryBase[];
  listings: ListingRecord[];
  messages: MessageRecord[];
  missionTemplates: MissionTemplate[];
  userMissions: UserMissionRecord[];
  notifications: NotificationRecord[];
  wishes: WishRecord[];
  globalStats: Stats;
  /** Uploads simulados de la sesión: POST /uploads los registra y los listings los referencian. */
  mediaRegistry: Map<string, Media>;
}

export const createSeed = (): DemoDb => ({
  users: DEMO_USERS.map((u) => ({
    ...u,
    schools: [...u.schools],
    credits: { ...u.credits },
    stats: { ...u.stats },
  })),
  // `School.media` es nullable (ECO-12): copiarlo con spread directo lo degradaría a un `Media`
  // con todos los campos opcionales, así que se clona sólo cuando existe.
  schools: DEMO_SCHOOLS.map((s) => ({ ...s, media: s.media ? { ...s.media } : null })),
  categories: DEMO_CATEGORIES.map((c) => ({ ...c })),
  listings: DEMO_LISTINGS.map((l) => ({ ...l, media: l.media.map((m) => ({ ...m })) })),
  messages: DEMO_MESSAGES.map((m) => ({ ...m })),
  missionTemplates: DEMO_MISSION_TEMPLATES.map((m) => ({ ...m })),
  userMissions: DEMO_USER_MISSIONS.map((m) => ({ ...m, progress: { ...m.progress } })),
  notifications: DEMO_NOTIFICATIONS.map((n) => ({ ...n })),
  wishes: DEMO_WISHES.map((w) => ({ ...w })),
  globalStats: { ...DEMO_GLOBAL_STATS },
  mediaRegistry: new Map(),
});
