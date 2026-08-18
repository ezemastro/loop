import { IDS } from "../ids";
import { DEMO_CATEGORIES, CATEGORY_STATS } from "./categories";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();
const daysAgo = (days: number, hours = 0) => hoursAgo(days * 24 + hours);

const catId = (name: string): UUID => {
  const cat = DEMO_CATEGORIES.find((c) => c.name === name);
  if (!cat) throw new Error(`Categoría demo inexistente: ${name}`);
  return cat.id;
};

const img = (seed: string) => ({
  id: `00000000-0000-4000-8000-${seed}`,
  url: `https://picsum.photos/seed/${seed}/800/600`,
  mime: "image/jpeg",
  mediaType: "image" as const,
});

export interface ListingRecord {
  id: UUID;
  sellerId: UUID;
  title: string;
  description: string | null;
  categoryId: UUID;
  price: number;
  listingStatus: ListingStatus;
  productStatus: ProductStatus;
  disabled: boolean;
  buyerId: UUID | null;
  offeredCredits: number | null;
  createdAt: string;
  media: Media[];
}

export const DEMO_LISTINGS: ListingRecord[] = [
  {
    id: "00000000-0000-4000-8000-000000001101",
    sellerId: IDS.USER_DEMO,
    title: "Buzo escolar gris talle 12",
    description: "Buzo de uniforme gris, talle 12, con logo bordado. Casi sin uso, se usó un cuatrimestre.",
    categoryId: catId("Buzos y camperas"),
    price: 6000,
    listingStatus: "published",
    productStatus: "like_new",
    disabled: false,
    buyerId: null,
    offeredCredits: null,
    createdAt: daysAgo(3),
    media: [img("loop-demo-buzo-1"), img("loop-demo-buzo-2")],
  },
  {
    id: "00000000-0000-4000-8000-000000001102",
    sellerId: IDS.USER_DEMO,
    title: "Cartuchera de tela con cierre",
    description: "Cartuchera de tela estampada con cierre en buen estado. Perfecta para lápices y marcadores.",
    categoryId: catId("Cartucheras"),
    price: 1500,
    listingStatus: "offered",
    productStatus: "good",
    disabled: false,
    buyerId: IDS.USER_CARLOS,
    offeredCredits: 1200,
    createdAt: daysAgo(5),
    media: [img("loop-demo-cartuchera")],
  },
  {
    id: "00000000-0000-4000-8000-000000001103",
    sellerId: IDS.USER_CARLOS,
    title: "Set de geometría completo",
    description: "Regla, escuadra, transportador y compás en estuche original. Se usó dos años.",
    categoryId: catId("Reglas, escuadras y compases"),
    price: 800,
    listingStatus: "published",
    productStatus: "good",
    disabled: false,
    buyerId: null,
    offeredCredits: null,
    createdAt: daysAgo(2),
    media: [img("loop-demo-geometria")],
  },
  {
    id: "00000000-0000-4000-8000-000000001104",
    sellerId: IDS.USER_CARLOS,
    title: "Cuadernos A4 tapa dura (x3)",
    description: "Tres cuadernos A4 tapa dura, rayados, sin usar. Ideales para secundaria.",
    categoryId: catId("Cuadernos"),
    price: 2000,
    listingStatus: "published",
    productStatus: "like_new",
    disabled: false,
    buyerId: null,
    offeredCredits: null,
    createdAt: daysAgo(4),
    media: [img("loop-demo-cuadernos")],
  },
  {
    id: "00000000-0000-4000-8000-000000001105",
    sellerId: IDS.USER_LUCIA,
    title: "Mochila escolar azul",
    description: "Mochila azul con dos compartimentos y soporte acolchado. Tiene un pequeño desgaste en la base.",
    categoryId: catId("Mochilas"),
    price: 8000,
    listingStatus: "published",
    productStatus: "fair",
    disabled: false,
    buyerId: null,
    offeredCredits: null,
    createdAt: daysAgo(6),
    media: [img("loop-demo-mochila-1"), img("loop-demo-mochila-2")],
  },
  {
    id: "00000000-0000-4000-8000-000000001106",
    sellerId: IDS.USER_LUCIA,
    title: "Botella de agua térmica",
    description: "Botella térmica de acero inoxidable, 500 ml. Mantiene el agua fría todo el día.",
    categoryId: catId("Botellas de agua y loncheras"),
    price: 1200,
    listingStatus: "published",
    productStatus: "like_new",
    disabled: false,
    buyerId: null,
    offeredCredits: null,
    createdAt: daysAgo(1),
    media: [img("loop-demo-botella")],
  },
  {
    id: "00000000-0000-4000-8000-000000001107",
    sellerId: IDS.USER_MARTIN,
    title: "Acuarelas x12 colores",
    description: "Caja de acuarelas de 12 colores, usadas un par de veces. Incluye pincel.",
    categoryId: catId("Material artístico"),
    price: 1800,
    listingStatus: "published",
    productStatus: "good",
    disabled: false,
    buyerId: null,
    offeredCredits: null,
    createdAt: daysAgo(7),
    media: [img("loop-demo-acuarelas")],
  },
  {
    id: "00000000-0000-4000-8000-000000001108",
    sellerId: IDS.USER_MARTIN,
    title: "Zapatos de uniforme talle 33",
    description: "Zapatos negros de vestir para uniforme, talle 33. En buen estado, suela sin desgaste.",
    categoryId: catId("Zapatos escolares"),
    price: 9000,
    listingStatus: "accepted",
    productStatus: "fair",
    disabled: false,
    buyerId: IDS.USER_DEMO,
    offeredCredits: 7500,
    createdAt: daysAgo(9),
    media: [img("loop-demo-zapatos")],
  },
  {
    id: "00000000-0000-4000-8000-000000001109",
    sellerId: IDS.USER_JULIAN,
    title: "Marcadores de colores (estuche x10)",
    description: "Estuche de 10 marcadores escolares, casi todos con tinta. Se cambiaron algunos por nuevos.",
    categoryId: catId("Marcadores y resaltadores"),
    price: 1000,
    listingStatus: "published",
    productStatus: "good",
    disabled: false,
    buyerId: null,
    offeredCredits: null,
    createdAt: daysAgo(12),
    media: [img("loop-demo-marcadores")],
  },
  {
    id: "00000000-0000-4000-8000-000000001110",
    sellerId: IDS.USER_SOFIA,
    title: "Carpeta A4 con repuestos",
    description: "Carpeta A4 lisa con repuestos de hojas rayadas y cuadriculadas. Como nueva.",
    categoryId: catId("Carpetas y repuestos de hojas"),
    price: 2500,
    listingStatus: "published",
    productStatus: "like_new",
    disabled: false,
    buyerId: null,
    offeredCredits: null,
    createdAt: daysAgo(8),
    media: [img("loop-demo-carpeta")],
  },
  {
    id: "00000000-0000-4000-8000-000000001111",
    sellerId: IDS.USER_LUCIA,
    title: "Lápices de colores x24",
    description: "Caja de 24 lápices de colores, algunos levemente gastados. Todos funcionan.",
    categoryId: catId("Lápices y lapiceras"),
    price: 1400,
    listingStatus: "received",
    productStatus: "good",
    disabled: false,
    buyerId: IDS.USER_DEMO,
    offeredCredits: 1100,
    createdAt: daysAgo(10),
    media: [img("loop-demo-lapices")],
  },
];

export interface MissionTemplateSeed extends MissionTemplate {
  id: UUID;
}

export const DEMO_MISSION_TEMPLATES: MissionTemplateSeed[] = [
  {
    id: "00000000-0000-4000-8000-000000001201",
    key: "first_listing",
    title: "Publicá tu primer artículo",
    description: "Sumá un artículo al catálogo y ayudá a otra familia.",
    rewardCredits: 200,
    active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000001202",
    key: "complete_profile",
    title: "Completá tu perfil",
    description: "Agregá tu foto de perfil y tus colegios.",
    rewardCredits: 100,
    active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000001203",
    key: "three_loops",
    title: "Hacé 3 Loops",
    description: "Completá tres intercambios de artículos.",
    rewardCredits: 500,
    active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000001204",
    key: "donate",
    title: "Ayudá a tu comunidad",
    description: "Doná Loopies a otro usuario.",
    rewardCredits: 300,
    active: true,
  },
];

export interface UserMissionRecord {
  id: UUID;
  userId: UUID;
  missionTemplateId: UUID;
  completed: boolean;
  completedAt: string | null;
  progress: { total: number; current: number };
}

export const DEMO_USER_MISSIONS: UserMissionRecord[] = [
  {
    id: "00000000-0000-4000-8000-000000001301",
    userId: IDS.USER_DEMO,
    missionTemplateId: DEMO_MISSION_TEMPLATES[0].id,
    completed: true,
    completedAt: daysAgo(4),
    progress: { total: 1, current: 1 },
  },
  {
    id: "00000000-0000-4000-8000-000000001302",
    userId: IDS.USER_DEMO,
    missionTemplateId: DEMO_MISSION_TEMPLATES[1].id,
    completed: true,
    completedAt: daysAgo(6),
    progress: { total: 1, current: 1 },
  },
  {
    id: "00000000-0000-4000-8000-000000001303",
    userId: IDS.USER_DEMO,
    missionTemplateId: DEMO_MISSION_TEMPLATES[2].id,
    completed: false,
    completedAt: null,
    progress: { total: 3, current: 1 },
  },
  {
    id: "00000000-0000-4000-8000-000000001304",
    userId: IDS.USER_DEMO,
    missionTemplateId: DEMO_MISSION_TEMPLATES[3].id,
    completed: false,
    completedAt: null,
    progress: { total: 1, current: 0 },
  },
];

export interface MessageRecord {
  id: UUID;
  senderId: UUID;
  recipientId: UUID;
  text: string;
  attachedListingId?: UUID | null;
  createdAt: string;
  /** Interno: el tipo público `Message` no expone el estado de lectura. */
  isRead: boolean;
}

export const DEMO_MESSAGES: MessageRecord[] = [
  {
    id: "00000000-0000-4000-8000-000000001401",
    senderId: IDS.USER_SOFIA,
    recipientId: IDS.USER_DEMO,
    text: "¡Hola Ana! ¿El buzo gris todavía está disponible?",
    attachedListingId: DEMO_LISTINGS[0].id,
    createdAt: daysAgo(2, 2),
    isRead: true,
  },
  {
    id: "00000000-0000-4000-8000-000000001402",
    senderId: IDS.USER_DEMO,
    recipientId: IDS.USER_SOFIA,
    text: "¡Hola Sofía! Sí, todavía está disponible.",
    createdAt: daysAgo(2, 1),
    isRead: true,
  },
  {
    id: "00000000-0000-4000-8000-000000001403",
    senderId: IDS.USER_SOFIA,
    recipientId: IDS.USER_DEMO,
    text: "Genial, ¿lo puedo pasar a buscar el viernes?",
    createdAt: hoursAgo(5),
    isRead: false,
  },
  {
    id: "00000000-0000-4000-8000-000000001404",
    senderId: IDS.USER_DEMO,
    recipientId: IDS.USER_MARTIN,
    text: "Hola Martín, ¿los cuadernos son de tapa dura?",
    attachedListingId: DEMO_LISTINGS[3].id,
    createdAt: daysAgo(3, 4),
    isRead: true,
  },
  {
    id: "00000000-0000-4000-8000-000000001405",
    senderId: IDS.USER_MARTIN,
    recipientId: IDS.USER_DEMO,
    text: "Sí, los tres son tapa dura y están sin usar.",
    createdAt: daysAgo(3, 3),
    isRead: true,
  },
];

export type NotificationSeedPayload =
  | MissionNotificationPayloadBase
  | LoopNotificationPayloadBase
  | DonationNotificationPayloadBase
  | AdminNotificationPayloadBase;

export interface NotificationRecord {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  createdAt: string;
  isRead: boolean;
  readAt: string | null;
  payload: NotificationSeedPayload;
}

export const DEMO_NOTIFICATIONS: NotificationRecord[] = [
  {
    id: "00000000-0000-4000-8000-000000001501",
    userId: IDS.USER_DEMO,
    type: "mission",
    createdAt: daysAgo(4, 2),
    isRead: true,
    readAt: daysAgo(4),
    payload: { userMissionId: DEMO_USER_MISSIONS[0].id },
  },
  {
    id: "00000000-0000-4000-8000-000000001502",
    userId: IDS.USER_DEMO,
    type: "loop",
    createdAt: daysAgo(2, 6),
    isRead: false,
    readAt: null,
    payload: {
      listingId: DEMO_LISTINGS[1].id,
      buyerId: IDS.USER_CARLOS,
      toListingStatus: "offered",
      toOfferedCredits: 1200,
      type: "new_offer",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000001503",
    userId: IDS.USER_DEMO,
    type: "donation",
    createdAt: daysAgo(1, 3),
    isRead: false,
    readAt: null,
    payload: { donorUserId: IDS.USER_JULIAN, amount: 100, message: null },
  },
];

export interface WishRecord {
  id: UUID;
  userId: UUID;
  categoryId: UUID;
  comment: string | null;
}

export const DEMO_WISHES: WishRecord[] = [
  {
    id: "00000000-0000-4000-8000-000000001601",
    userId: IDS.USER_DEMO,
    categoryId: catId("Mochilas"),
    comment: "Busco una mochila de tela para primer grado.",
  },
  {
    id: "00000000-0000-4000-8000-000000001602",
    userId: IDS.USER_DEMO,
    categoryId: catId("Cuadernos"),
    comment: null,
  },
];

export const DEMO_GLOBAL_STATS: Stats = {
  kgWaste: CATEGORY_STATS.kgWaste * 1000,
  kgCo2: CATEGORY_STATS.kgCo2 * 1000,
  lH2o: CATEGORY_STATS.lH2o * 100,
};
