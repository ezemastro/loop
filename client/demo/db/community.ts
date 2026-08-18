import { DEFAULT_COLORS } from "@/config";
import { IDS } from "../ids";

const mediaFor = (id: UUID, seed: string): Media => ({
  id,
  url: `https://picsum.photos/seed/${seed}/600/600`,
  mime: "image/jpeg",
  mediaType: "image",
});

export const DEMO_COMMUNITY_MEDIA = mediaFor("00000000-0000-4000-8000-000000000001-1", "loop-demo-community");

const themeColors = {
  primary: DEFAULT_COLORS.PRIMARY,
  secondary: DEFAULT_COLORS.SECONDARY,
  tertiary: DEFAULT_COLORS.TERTIARY,
  mainText: DEFAULT_COLORS.MAIN_TEXT,
  secondaryText: DEFAULT_COLORS.SECONDARY_TEXT,
  credits: DEFAULT_COLORS.CREDITS,
  creditsLight: DEFAULT_COLORS.CREDITS_LIGHT,
  stroke: DEFAULT_COLORS.STROKE,
  background: DEFAULT_COLORS.BACKGROUND,
  alert: DEFAULT_COLORS.ALERT,
};

export const DEMO_COMMUNITY: Community = {
  id: IDS.COMMUNITY,
  slug: "demo",
  name: "Comunidad Demo",
  mediaId: DEMO_COMMUNITY_MEDIA.id,
  theme: { colors: themeColors },
  meta: null,
  active: true,
  media: DEMO_COMMUNITY_MEDIA,
};

export const DEMO_SCHOOLS: School[] = [
  {
    id: IDS.SCHOOL_PRIMARY,
    name: "Escuela Primaria Demo",
    mediaId: "00000000-0000-4000-8000-000000000101-1",
    communityId: IDS.COMMUNITY,
    meta: null,
    media: mediaFor("00000000-0000-4000-8000-000000000101-1", "loop-demo-school-1"),
  },
  {
    id: IDS.SCHOOL_SECONDARY,
    name: "Escuela Secundaria Demo",
    mediaId: "00000000-0000-4000-8000-000000000102-1",
    communityId: IDS.COMMUNITY,
    meta: null,
    media: mediaFor("00000000-0000-4000-8000-000000000102-1", "loop-demo-school-2"),
  },
  {
    id: IDS.SCHOOL_TECHNICAL,
    name: "Instituto Técnico Demo",
    mediaId: "00000000-0000-4000-8000-000000000103-1",
    communityId: IDS.COMMUNITY,
    meta: null,
    media: mediaFor("00000000-0000-4000-8000-000000000103-1", "loop-demo-school-3"),
  },
];
