import { columnsAt, GRID_CELL_CLASS } from "../components/bases/ListingGrid";

/**
 * Column math for `ListingGrid` (design.md D2). See
 * `specs/listing-discovery-grid/spec.md` — "Column count per range".
 */
describe("ListingGrid column math", () => {
  describe("columnsAt(breakpoint)", () => {
    it.each([
      ["base", 1],
      ["md", 2],
      ["lg", 3],
      ["xl", 4],
    ] as const)("columnsAt(%s) === %i", (bp, expected) => {
      expect(columnsAt(bp)).toBe(expected);
    });
  });

  describe("GRID_CELL_CLASS", () => {
    it("contains exactly the matching w-full/w-1/2/w-1/3/w-1/4 fraction tokens", () => {
      expect(GRID_CELL_CLASS).toContain("w-full");
      expect(GRID_CELL_CLASS).toContain("md:w-1/2");
      expect(GRID_CELL_CLASS).toContain("lg:w-1/3");
      expect(GRID_CELL_CLASS).toContain("xl:w-1/4");
    });
  });
});
