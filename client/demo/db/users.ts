import { IDS } from "../ids";
import { DEMO_COMMUNITY, DEMO_SCHOOLS } from "./community";

const EMPTY_STATS: Stats = { kgWaste: 0, kgCo2: 0, lH2o: 0 };

interface UserSeed {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  creditsBalance?: number;
  schoolNames: string[];
  avatarSeed?: string | null;
}

const buildUser = (seed: UserSeed): PrivateUser => {
  const schools = DEMO_SCHOOLS.filter((s) => seed.schoolNames.includes(s.name));
  const profileMedia = seed.avatarSeed
    ? {
        id: `${seed.id}-avatar`,
        url: `https://picsum.photos/seed/${seed.avatarSeed}/300/300`,
        mime: "image/jpeg",
        mediaType: "image",
      }
    : null;
  return {
    id: seed.id,
    email: seed.email,
    phone: seed.phone ?? null,
    firstName: seed.firstName,
    lastName: seed.lastName,
    profileMediaId: profileMedia?.id ?? null,
    communityId: DEMO_COMMUNITY.id,
    credits: { balance: seed.creditsBalance ?? 300, locked: 0 },
    stats: { ...EMPTY_STATS },
    profileMedia,
    schools,
    community: DEMO_COMMUNITY,
  };
};

export const DEMO_USERS: PrivateUser[] = [
  buildUser({
    id: IDS.USER_DEMO,
    email: "ana@demo.edu",
    firstName: "Ana",
    lastName: "Gómez",
    phone: "11 2345-6789",
    creditsBalance: 1500,
    schoolNames: ["Escuela Primaria Demo", "Escuela Secundaria Demo"],
    avatarSeed: "loop-demo-ana",
  }),
  buildUser({
    id: IDS.USER_CARLOS,
    email: "carlos@demo.edu",
    firstName: "Carlos",
    lastName: "Fernández",
    creditsBalance: 900,
    schoolNames: ["Escuela Secundaria Demo"],
  }),
  buildUser({
    id: IDS.USER_LUCIA,
    email: "lucia@demo.edu",
    firstName: "Lucía",
    lastName: "Martínez",
    creditsBalance: 1200,
    schoolNames: ["Instituto Técnico Demo"],
  }),
  buildUser({
    id: IDS.USER_MARTIN,
    email: "martin@demo.edu",
    firstName: "Martín",
    lastName: "Rodríguez",
    creditsBalance: 700,
    schoolNames: ["Escuela Secundaria Demo"],
    avatarSeed: "loop-demo-martin",
  }),
  buildUser({
    id: IDS.USER_SOFIA,
    email: "sofia@demo.edu",
    firstName: "Sofía",
    lastName: "López",
    creditsBalance: 2000,
    schoolNames: ["Escuela Primaria Demo"],
  }),
  buildUser({
    id: IDS.USER_JULIAN,
    email: "julian@demo.edu",
    firstName: "Julián",
    lastName: "Torres",
    creditsBalance: 450,
    schoolNames: ["Instituto Técnico Demo"],
  }),
];

export const demoUserByEmail = (email: string) =>
  DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
