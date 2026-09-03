import { renderWithAct } from "./helpers/renderWithAct";
import Listing from "../components/cards/Listing";

/**
 * `cards/Listing.tsx` renders `CategoryBadge`, which calls `useWishes()` (`@tanstack/react-query`)
 * unconditionally. That hook needs a `QueryClientProvider` and fires a real network request on
 * mount; mocking the hook at its own boundary avoids both instead of standing up a provider this
 * suite has no other use for. `expo-router`'s `useRouter` is used directly by `Listing.tsx` itself.
 */
jest.mock("@/hooks/useWishes", () => ({ useWishes: () => ({ data: undefined }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const CATEGORY = {
  id: "category-1",
  name: "Libros",
  parentId: null,
  description: null,
  price: null,
  icon: null,
  stats: null,
  parents: null,
  children: null,
} as unknown as Category;

const SELLER = {
  id: "seller-1",
  firstName: "Ana",
  lastName: "Gómez",
  profileMedia: null,
  schools: [],
} as unknown as PublicUser;

// `Listing` the imported component (value namespace) and `Listing` the ambient interface (type
// namespace) coexist without collision -- same pattern used inside `cards/Listing.tsx` itself.
const baseListing = (media: unknown) =>
  ({
    id: "listing-1",
    sellerId: "seller-1",
    title: "Mochila escolar",
    description: null,
    categoryId: "category-1",
    price: 5,
    listingStatus: "published",
    productStatus: "good",
    disabled: false,
    buyerId: null,
    offeredCredits: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    seller: SELLER,
    category: CATEGORY,
    buyer: null,
    media,
  }) as unknown as Listing;

describe("Listing card -- missing media does not throw", () => {
  // `Listing.tsx:50` used to do `listing.media.length` unguarded (design.md D6); a listing
  // hydrated without `media` blanked the card instead of falling back to a placeholder.
  it.each([
    ["grid", undefined],
    ["compact", undefined],
    ["grid", []],
    ["compact", []],
  ] as const)("variant=%s, media=%p renders without throwing", async (variant, media) => {
    const tree = await renderWithAct(<Listing listing={baseListing(media)} variant={variant} />);

    expect(tree.toJSON()).not.toBeNull();
  });
});
